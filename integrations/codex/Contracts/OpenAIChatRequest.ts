import type { OpenAIMessage } from './OpenAIMessage.js'

export type CodexBridgeStrategy =
  | 'coding'
  | 'architecture'
  | 'cheap'
  | 'free'
  | 'local'
  | 'reasoning'

export type OpenAIChatRequest = {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  max_completion_tokens?: number
  tools?: Array<Record<string, unknown>>
  tool_choice?: string | Record<string, unknown>
  functions?: Array<Record<string, unknown>>
  function_call?: string | Record<string, unknown>
  stop?: string | string[]
  user?: string
  n?: number
  stream_options?: {
    include_usage?: boolean
  }
  botvalia_strategy?: CodexBridgeStrategy
  strategy?: CodexBridgeStrategy
}
