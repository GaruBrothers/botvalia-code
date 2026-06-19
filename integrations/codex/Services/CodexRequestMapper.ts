import type { OpenAIChatRequest } from '../Contracts/OpenAIChatRequest.js'
import type { OpenAIMessage } from '../Contracts/OpenAIMessage.js'
import type { CodexOptions } from '../Configuration/CodexOptions.js'

export type BotValiaBridgeRequest = {
  prompt: string
  systemPrompt?: string
  model: string
  strategy: string
  maxTokens?: number
  stream: boolean
  toolsRequested: boolean
}

const STRATEGY_PREFIX: Record<string, string> = {
  coding: 'Coding task',
  architecture: 'Architecture and design task',
  cheap: 'Cost-sensitive task',
  free: 'Free-model task',
  local: 'Local-model task',
  reasoning: 'Reasoning task',
}

function contentToText(content: OpenAIMessage['content']): string {
  if (content === undefined || content === null) return ''
  if (typeof content === 'string') return content
  return content
    .map(part => {
      if (part && typeof part === 'object' && part.type === 'text') {
        return typeof part.text === 'string' ? part.text : ''
      }
      return JSON.stringify(part)
    })
    .filter(Boolean)
    .join('\n')
}

function messageToPromptLine(message: OpenAIMessage): string {
  const text = contentToText(message.content)
  if (!text) return ''
  if (message.role === 'user') return text
  if (message.role === 'assistant') return `Assistant: ${text}`
  if (message.role === 'tool') return `Tool result${message.tool_call_id ? ` (${message.tool_call_id})` : ''}: ${text}`
  if (message.role === 'function') return `Function result${message.name ? ` (${message.name})` : ''}: ${text}`
  return text
}

export class CodexRequestMapper {
  constructor(private readonly options: CodexOptions) {}

  map(request: OpenAIChatRequest): BotValiaBridgeRequest {
    const systemMessages = request.messages.filter(message => message.role === 'system')
    const conversationMessages = request.messages.filter(message => message.role !== 'system')
    const requestedStrategy =
      request.botvalia_strategy ||
      request.strategy ||
      this.resolveStrategyFromModel(request.model) ||
      this.options.defaultStrategy
    const systemPrompt = systemMessages
      .map(message => contentToText(message.content))
      .filter(Boolean)
      .join('\n\n')
    const body = conversationMessages
      .map(messageToPromptLine)
      .filter(Boolean)
      .join('\n\n')
    const prefix = STRATEGY_PREFIX[requestedStrategy] ?? 'BotValia task'
    const toolNotice =
      (request.tools?.length || request.functions?.length) && !this.options.allowTools
        ? '\n\nNote: the client supplied tool/function schemas, but this bridge is configured with allowTools=false, so execute the request without external tool side effects.'
        : ''

    return {
      prompt: `[${prefix}]\n${body}${toolNotice}`.trim(),
      systemPrompt: systemPrompt || undefined,
      model: this.resolveModel(request.model, requestedStrategy),
      strategy: requestedStrategy,
      maxTokens: request.max_completion_tokens ?? request.max_tokens,
      stream: Boolean(request.stream),
      toolsRequested: Boolean(request.tools?.length || request.functions?.length),
    }
  }

  private resolveStrategyFromModel(model: string | undefined): string | undefined {
    if (!model) return undefined
    const match = this.options.models.find(candidate => candidate.id === model)
    return match?.strategy
  }

  private resolveModel(model: string | undefined, strategy: string): string {
    const configured =
      this.options.models.find(candidate => candidate.id === model) ||
      this.options.models.find(candidate => candidate.strategy === strategy)
    return configured?.route || configured?.id || model || this.options.virtualModel
  }
}
