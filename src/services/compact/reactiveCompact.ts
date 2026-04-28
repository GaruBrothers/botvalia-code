import type { CacheSafeParams } from '../../utils/forkedAgent.js'
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

export async function runReactiveCompact<T>(messages: T): Promise<T> {
  return messages
}

export function isReactiveOnlyMode(): boolean {
  return false
}

export async function reactiveCompactOnPromptTooLong(
  _messages: unknown,
  _cacheSafeParams: CacheSafeParams,
  _options: {
    customInstructions?: string | null
    trigger: ReactiveCompactTrigger
  },
): Promise<ReactiveCompactOutcome> {
  return { ok: false, reason: 'exhausted' }
}
