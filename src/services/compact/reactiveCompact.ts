import type { Message } from '../../types/message.js'
import type { CacheSafeParams } from '../../utils/forkedAgent.js'
import type { QuerySource } from '../../constants/querySource.js'
import type { CompactionResult } from './compact.js'

export type ReactiveCompactTrigger = 'manual' | 'auto'

export type ReactiveCompactOutcome =
  | {
      ok: true
      result: CompactionResult
      reason?: never
    }
  | {
      ok: false
      reason:
        | 'too_few_groups'
        | 'aborted'
        | 'exhausted'
        | 'error'
        | 'media_unstrippable'
      result?: never
    }

export type ReactiveCompactAttempt = {
  hasAttempted: boolean
  querySource: QuerySource
  aborted: boolean
  messages: Message[]
  cacheSafeParams: CacheSafeParams
}

export async function runReactiveCompact<T>(messages: T): Promise<T> {
  return messages
}

export function isReactiveOnlyMode(): boolean {
  return false
}

export function isReactiveCompactEnabled(): boolean {
  return false
}

export function isWithheldPromptTooLong(_message: unknown): boolean {
  return false
}

export function isWithheldMediaSizeError(_message: unknown): boolean {
  return false
}

export async function tryReactiveCompact(
  _attempt: ReactiveCompactAttempt,
): Promise<CompactionResult | null> {
  return null
}

export async function reactiveCompactOnPromptTooLong(
  _messages: Message[],
  _cacheSafeParams: CacheSafeParams,
  _options: {
    customInstructions?: string | null
    trigger: ReactiveCompactTrigger
  },
): Promise<ReactiveCompactOutcome> {
  return { ok: false, reason: 'exhausted' }
}
