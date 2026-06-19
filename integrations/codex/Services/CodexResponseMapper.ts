import { randomUUID } from 'crypto'
import type {
  OpenAIChatCompletionChunk,
  OpenAIChatResponse,
  OpenAIUsage,
} from '../Contracts/OpenAIChatResponse.js'
import type { OpenAIModelResponse } from '../Contracts/OpenAIModelResponse.js'
import type { CodexOptions } from '../Configuration/CodexOptions.js'

type SdkUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type SdkResult = {
  type: 'result'
  subtype?: string
  result?: string
  is_error?: boolean
  stop_reason?: string | null
  usage?: SdkUsage
  errors?: string[]
}

type SdkAssistant = {
  type: 'assistant'
  message?: {
    content?: Array<{ type?: string; text?: string } | Record<string, unknown>>
    stop_reason?: string | null
    usage?: SdkUsage
  }
}

type SdkStreamEvent = {
  type: 'stream_event'
  event?: {
    type?: string
    delta?: { type?: string; text?: string; stop_reason?: string | null }
    content_block?: { type?: string; text?: string }
    usage?: SdkUsage
  }
}

export function mapUsage(usage: SdkUsage | undefined): OpenAIUsage {
  const prompt = (usage?.input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0)
  const completion = usage?.output_tokens ?? 0
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  }
}

export class CodexResponseMapper {
  constructor(private readonly options: CodexOptions) {}

  modelsResponse(): OpenAIModelResponse {
    const created = Math.floor(Date.now() / 1000)
    return {
      object: 'list',
      data: this.options.models.map(model => ({
        id: model.id,
        object: 'model',
        created,
        owned_by: 'botvalia',
      })),
    }
  }

  chatResponse(params: {
    id?: string
    model: string
    text: string
    usage?: SdkUsage
    finishReason?: string | null
  }): OpenAIChatResponse {
    return {
      id: params.id || `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: params.text,
          },
          finish_reason: this.mapFinishReason(params.finishReason),
        },
      ],
      usage: mapUsage(params.usage),
    }
  }

  errorResponse(message: string, status = 500): Response {
    return Response.json(
      {
        error: {
          message,
          type: status === 401 ? 'authentication_error' : 'server_error',
          code: status,
        },
      },
      { status },
    )
  }

  chunk(params: {
    id: string
    model: string
    delta?: string
    role?: 'assistant'
    finishReason?: string | null
    usage?: SdkUsage | null
  }): OpenAIChatCompletionChunk {
    return {
      id: params.id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: params.model,
      choices: [
        {
          index: 0,
          delta: {
            ...(params.role ? { role: params.role } : {}),
            ...(params.delta ? { content: params.delta } : {}),
          },
          finish_reason: this.mapFinishReason(params.finishReason),
        },
      ],
      ...(params.usage !== undefined ? { usage: params.usage ? mapUsage(params.usage) : null } : {}),
    }
  }

  extractAssistantText(message: unknown): string {
    const assistant = message as SdkAssistant
    if (assistant.type !== 'assistant' || !Array.isArray(assistant.message?.content)) {
      return ''
    }
    return assistant.message.content
      .map(block => {
        if (block && typeof block === 'object' && block.type === 'text') {
          return typeof block.text === 'string' ? block.text : ''
        }
        return ''
      })
      .join('')
  }

  extractStreamDelta(message: unknown): string {
    const event = (message as SdkStreamEvent).event
    if (!event) return ''
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return event.delta.text ?? ''
    }
    if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
      return event.content_block.text ?? ''
    }
    return ''
  }

  extractResult(message: unknown): SdkResult | undefined {
    const result = message as SdkResult
    return result.type === 'result' ? result : undefined
  }

  private mapFinishReason(reason: string | null | undefined): string | null {
    if (!reason) return null
    if (reason === 'end_turn') return 'stop'
    if (reason === 'max_tokens') return 'length'
    if (reason === 'tool_use') return 'tool_calls'
    return reason
  }
}
