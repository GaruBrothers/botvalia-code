import type { Message } from '../../types/message.js'
import type { AssistantMessage } from '../../types/message.js'
import type { ToolUseContext } from '../../Tool.js'
import type { QuerySource } from '../../constants/querySource.js'

type Stats = {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: {
    totalSpawns: number
    totalErrors: number
    totalEmptySpawns: number
    emptySpawnWarningEmitted: boolean
    lastError?: string
  }
}

const stats: Stats = {
  collapsedSpans: 0,
  collapsedMessages: 0,
  stagedSpans: 0,
  health: {
    totalSpawns: 0,
    totalErrors: 0,
    totalEmptySpawns: 0,
    emptySpawnWarningEmitted: false,
    lastError: undefined,
  },
}

const listeners = new Set<() => void>()

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getStats(): Stats {
  return stats
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export function initContextCollapse(): void {}

export function resetContextCollapse(): void {}

export async function applyCollapsesIfNeeded(
  messages: Message[],
  _toolUseContext: ToolUseContext,
  _querySource?: QuerySource,
): Promise<{
  messages: Message[]
  changed: boolean
}> {
  return { messages, changed: false }
}

export function isWithheldPromptTooLong(
  _message: unknown,
  _isPromptTooLongMessage: (message: AssistantMessage) => boolean,
  _querySource?: QuerySource,
): boolean {
  return false
}

export function recoverFromOverflow(
  messages: Message[],
  _querySource?: QuerySource,
): {
  messages: Message[]
  committed: number
} {
  return { messages, committed: 0 }
}
