import { randomUUID } from 'crypto'
import type { CodexCompatibilityService } from '../Services/CodexCompatibilityService.js'

// OpenAI Responses API request shape (subset used by Codex CLI)
export type ResponsesApiRequest = {
  model: string
  input: string | Array<{ role: string; content: string | Array<{ type: string; text: string }> }>
  instructions?: string
  stream?: boolean
  previous_response_id?: string
  tools?: unknown[]
  temperature?: number
  max_output_tokens?: number
}

export class ResponsesController {
  constructor(private readonly service: CodexCompatibilityService) {}

  async create(request: Request): Promise<Response> {
    const body = (await request.json()) as ResponsesApiRequest
    const signal = request.signal

    // Normalise input → messages array for our internal mapper
    const messages = this.normaliseInput(body)

    // Inject instructions as system message if present
    if (body.instructions) {
      messages.unshift({ role: 'system', content: body.instructions })
    }

    // Always use non-streaming internally — we re-wrap as Responses API SSE below
    const chatPayload = {
      model: body.model,
      messages,
      stream: false,
      temperature: body.temperature,
      max_tokens: body.max_output_tokens,
    }

    const chatResponse = await this.service.chatCompletion(chatPayload, signal)

    const responseId = `resp_${randomUUID().replace(/-/g, '')}`
    const msgId     = `msg_${randomUUID().replace(/-/g, '')}`
    const createdAt = Math.floor(Date.now() / 1000)

    if (!chatResponse.ok) {
      const errText = await chatResponse.text().catch(() => 'unknown error')
      return this.sseStream([
        this.sseEvent('error', { message: errText, code: 'upstream_error' }),
      ])
    }

    const chatBody = (await chatResponse.json()) as {
      id: string
      choices: Array<{ message: { content: string } }>
      model: string
      usage?: unknown
    }

    const text  = chatBody.choices?.[0]?.message?.content ?? ''
    const model = chatBody.model ?? body.model

    // Map Chat Completions usage → Responses API usage (required fields)
    const rawUsage = (chatBody.usage ?? {}) as Record<string, number>
    const usage = {
      input_tokens:  rawUsage.prompt_tokens    ?? rawUsage.input_tokens    ?? 0,
      output_tokens: rawUsage.completion_tokens ?? rawUsage.output_tokens   ?? 0,
      total_tokens:  rawUsage.total_tokens ?? 0,
      input_tokens_details:  { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    }

    // Build the complete response object (used in response.completed event)
    const completedResponse = {
      id: responseId,
      object: 'response',
      created_at: createdAt,
      model,
      status: 'completed',
      output: [
        {
          id: msgId,
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text }],
        },
      ],
      usage,
    }


    // Emit SSE events matching the OpenAI Responses API streaming format.
    // IMPORTANT: send text only ONCE (in output_text.delta) to avoid Codex
    // Desktop rendering duplicates from done/completed events.
    const events = [
      // 1. Response lifecycle start
      this.sseEvent('response.created', {
        response: { ...completedResponse, status: 'in_progress', output: [] },
      }),
      this.sseEvent('response.in_progress', {
        response: { ...completedResponse, status: 'in_progress', output: [] },
      }),
      // 2. Output item structure
      this.sseEvent('response.output_item.added', {
        output_index: 0,
        item: { id: msgId, type: 'message', status: 'in_progress', role: 'assistant', content: [] },
      }),
      this.sseEvent('response.content_part.added', {
        item_id: msgId, output_index: 0, content_index: 0,
        part: { type: 'output_text', text: '' },
      }),
      // 3. THE TEXT — sent exactly once as a delta
      this.sseEvent('response.output_text.delta', {
        item_id: msgId, output_index: 0, content_index: 0,
        delta: text,
      }),
      // 4. Close events — NO text to avoid double render
      this.sseEvent('response.output_text.done', {
        item_id: msgId, output_index: 0, content_index: 0,
        text: '',   // empty: already rendered via delta above
      }),
      this.sseEvent('response.output_item.done', {
        output_index: 0,
        item: { id: msgId, type: 'message', status: 'completed', role: 'assistant', content: [] },
      }),
      // 5. REQUIRED: response.completed with usage — content empty (text already shown)
      this.sseEvent('response.completed', { response: completedResponse }),
    ]

    return this.sseStream(events)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private sseEvent(type: string, data: Record<string, unknown>): string {
    return `data: ${JSON.stringify({ type, ...data })}\n\n`
  }

  private sseStream(events: string[]): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event))
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  private normaliseInput(
    body: ResponsesApiRequest,
  ): Array<{ role: string; content: string }> {
    if (typeof body.input === 'string') {
      return [{ role: 'user', content: body.input }]
    }
    return body.input.map(item => ({
      role: item.role,
      content: Array.isArray(item.content)
        ? item.content.map(c => ('text' in c ? c.text : '')).join('')
        : String(item.content),
    }))
  }
}
