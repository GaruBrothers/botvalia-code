import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { randomUUID } from 'crypto'
import type { OpenAIChatRequest } from '../Contracts/OpenAIChatRequest.js'
import type { CodexOptions } from '../Configuration/CodexOptions.js'
import { CodexRequestMapper } from './CodexRequestMapper.js'
import { CodexResponseMapper } from './CodexResponseMapper.js'

export type BotValiaRunnerMessage = Record<string, unknown>

export type BotValiaRunner = (params: {
  args: string[]
  stdin: string
  cwd: string
  signal: AbortSignal
}) => AsyncIterable<BotValiaRunnerMessage>

export function createSubprocessRunner(command: string): BotValiaRunner {
  return async function* run(params) {
    const child = spawn(command, params.args, {
      cwd: params.cwd,
      env: {
        ...process.env,
        BOTVALIA_SHOW_ACTIVE_MODEL: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stderr: string[] = []
    params.signal.addEventListener('abort', () => child.kill())
    child.stdin.end(params.stdin)
    child.stderr.on('data', chunk => stderr.push(String(chunk)))

    const rl = createInterface({ input: child.stdout })
    for await (const line of rl) {
      let trimmed = String(line).trim()
      // Strip SSE prefix that botvalia emits in stream-json mode
      if (trimmed.startsWith('data: ')) trimmed = trimmed.slice(6)
      if (!trimmed || trimmed === '[DONE]') continue
      try {
        yield JSON.parse(trimmed) as BotValiaRunnerMessage
      } catch {
        yield {
          type: 'system',
          subtype: 'bridge_unparsed_stdout',
          content: trimmed,
        }
      }
    }

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', code => resolve(code))
    })
    if (exitCode !== 0) {
      throw new Error(stderr.join('').trim() || `BotValia runner exited with code ${exitCode}`)
    }
  }
}

export class CodexCompatibilityService {
  readonly requestMapper: CodexRequestMapper
  readonly responseMapper: CodexResponseMapper

  constructor(
    private readonly options: CodexOptions,
    private readonly runner: BotValiaRunner = createSubprocessRunner(options.runnerCommand),
  ) {
    this.requestMapper = new CodexRequestMapper(options)
    this.responseMapper = new CodexResponseMapper(options)
  }

  listModels(): Response {
    return Response.json(this.responseMapper.modelsResponse())
  }

  async chatCompletion(request: OpenAIChatRequest, signal: AbortSignal): Promise<Response> {
    const mapped = this.requestMapper.map(request)
    const timestamp = new Date().toISOString()
    // biome-ignore lint/suspicious/noConsole:: CLI command status output
    console.log(`[${timestamp}] [Codex Bridge] Processing non-streaming chatCompletion: model=${request.model} -> strategy=${mapped.strategy} -> routedModel=${mapped.model}`)
    if (mapped.stream) {
      return this.streamChatCompletion(request, signal)
    }

    let text = ''
    let usage: Record<string, number> | undefined
    let finishReason: string | null | undefined
    for await (const message of this.runBotValia(request, signal)) {
      // Extract from type='assistant' messages (non-stream format)
      const assistantText = this.responseMapper.extractAssistantText(message)
      if (assistantText) text += assistantText

      // Extract from type='stream_event' messages (stream-json format, always used)
      const streamDelta = this.responseMapper.extractStreamDelta(message)
      if (streamDelta) text += streamDelta

      const result = this.responseMapper.extractResult(message)
      if (result) {
        if (result.is_error) {
          const errTimestamp = new Date().toISOString()
          // biome-ignore lint/suspicious/noConsole:: CLI command status output
          console.error(`[${errTimestamp}] [Codex Bridge] Runner returned error: ${result.errors?.join('\n') || result.result}`)
          return this.responseMapper.errorResponse(
            result.errors?.join('\n') || result.result || 'BotValia request failed',
            502,
          )
        }
        // Prefer result.result if present, otherwise keep accumulated stream text
        text = result.result || text
        usage = result.usage as Record<string, number> | undefined
        finishReason = result.stop_reason
      }
    }

    const doneTimestamp = new Date().toISOString()
    // biome-ignore lint/suspicious/noConsole:: CLI command status output
    console.log(`[${doneTimestamp}] [Codex Bridge] Non-streaming chatCompletion complete: length=${text.length} chars`)
    return Response.json(
      this.responseMapper.chatResponse({
        model: mapped.model,
        text,
        usage,
        finishReason,
      }),
    )
  }

  streamChatCompletion(request: OpenAIChatRequest, signal: AbortSignal): Response {
    const mapped = this.requestMapper.map(request)
    const id = `chatcmpl-${randomUUID()}`
    const encoder = new TextEncoder()
    const responseMapper = this.responseMapper
    const service = this
    const includeUsage = request.stream_options?.include_usage === true
    const timestamp = new Date().toISOString()
    // biome-ignore lint/suspicious/noConsole:: CLI command status output
    console.log(`[${timestamp}] [Codex Bridge] Processing streaming chatCompletion: model=${request.model} -> strategy=${mapped.strategy} -> routedModel=${mapped.model}`)
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }
        send(responseMapper.chunk({ id, model: mapped.model, role: 'assistant' }))
        try {
          let chunksSent = 0
          for await (const message of service.runBotValia(request, signal)) {
            const delta = responseMapper.extractStreamDelta(message)
            if (delta) {
              send(responseMapper.chunk({ id, model: mapped.model, delta }))
              chunksSent++
            }
            const result = responseMapper.extractResult(message)
            if (result) {
              if (result.is_error) {
                const errTimestamp = new Date().toISOString()
                // biome-ignore lint/suspicious/noConsole:: CLI command status output
                console.error(`[${errTimestamp}] [Codex Bridge] Streaming runner returned error: ${result.errors?.join('\n') || result.result}`)
                send({
                  error: {
                    message: result.errors?.join('\n') || result.result || 'BotValia request failed',
                    type: 'server_error',
                  },
                })
                break
              }
              send(responseMapper.chunk({
                id,
                model: mapped.model,
                finishReason: result.stop_reason,
                usage: includeUsage ? result.usage as Record<string, number> : undefined,
              }))
            }
          }
          const endTimestamp = new Date().toISOString()
          // biome-ignore lint/suspicious/noConsole:: CLI command status output
          console.log(`[${endTimestamp}] [Codex Bridge] Streaming chatCompletion complete. Chunks sent: ${chunksSent}`)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          const errTimestamp = new Date().toISOString()
          // biome-ignore lint/suspicious/noConsole:: CLI command status output
          console.error(`[${errTimestamp}] [Codex Bridge] Stream error: ${error}`)
          send({
            error: {
              message: error instanceof Error ? error.message : String(error),
              type: 'server_error',
            },
          })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  }

  private async *runBotValia(
    request: OpenAIChatRequest,
    signal: AbortSignal,
  ): AsyncIterable<BotValiaRunnerMessage> {
    const mapped = this.requestMapper.map(request)
    const args = [
      ...this.options.runnerArgs,
      '-p',
      '--verbose',
      '--bare',
      '--no-session-persistence',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--model',
      mapped.model,
      '--permission-mode',
      this.options.allowTools ? 'acceptEdits' : 'plan',
      '--tools',
      this.options.allowTools ? 'default' : '',
      '--max-turns',
      '1',
      ...(mapped.systemPrompt ? ['--system-prompt', mapped.systemPrompt] : []),
    ]
    const timestamp = new Date().toISOString()
    // biome-ignore lint/suspicious/noConsole:: CLI command status output
    console.log(`[${timestamp}] [Codex Bridge] Spawning internal runner process: cmd="${this.options.runnerCommand}", args=${JSON.stringify(args)}`)
    yield* this.runner({
      args,
      stdin: mapped.prompt,
      cwd: this.options.cwd,
      signal,
    })
  }
}
