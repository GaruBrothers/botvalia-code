export type OpenAIMessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function'

export type OpenAIMessageContentPart =
  | { type: 'text'; text: string }
  | Record<string, unknown>

export type OpenAIMessage = {
  role: OpenAIMessageRole
  content?: string | OpenAIMessageContentPart[] | null
  name?: string
  tool_call_id?: string
  tool_calls?: Array<Record<string, unknown>>
  function_call?: Record<string, unknown>
}
