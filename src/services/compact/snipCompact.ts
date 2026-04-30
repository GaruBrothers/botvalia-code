import type { Message, SystemMessage } from '../../types/message.js'

export const SNIP_NUDGE_TEXT =
  'Some earlier messages were compacted to preserve context. Ask if you want the full earlier trail revisited.'

export function snipCompactIfNeeded(messages: Message[], _options?: unknown): {
  messages: Message[]
  changed: boolean
  tokensFreed: number
  boundaryMessage?: SystemMessage
} {
  return { messages, changed: false, tokensFreed: 0 }
}

export function isSnipBoundaryMessage(): boolean {
  return false
}

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function isSnipMarkerMessage(_message?: Message): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}
