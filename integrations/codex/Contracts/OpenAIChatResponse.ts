import type { OpenAIMessage } from './OpenAIMessage.js'

export type OpenAIUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type OpenAIChatResponseChoice = {
  index: number
  message: OpenAIMessage
  finish_reason: string | null
}

export type OpenAIChatResponse = {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: OpenAIChatResponseChoice[]
  usage: OpenAIUsage
}

export type OpenAIChatCompletionChunk = {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: Partial<OpenAIMessage>
    finish_reason: string | null
  }>
  usage?: OpenAIUsage | null
}
