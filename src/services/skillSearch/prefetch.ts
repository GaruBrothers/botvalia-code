import type { ToolUseContext } from '../../Tool.js'
import type { Attachment } from '../../utils/attachments.js'
import type { Message } from '../../types/message.js'

export type SkillDiscoveryPrefetch = Promise<Attachment[]>

export function startSkillDiscoveryPrefetch(
  _signal: AbortSignal | null,
  _messages: Message[],
  _toolUseContext: ToolUseContext,
): SkillDiscoveryPrefetch {
  return Promise.resolve([])
}

export async function collectSkillDiscoveryPrefetch(
  pending: SkillDiscoveryPrefetch,
): Promise<Attachment[]> {
  return pending
}

export function getTurnZeroSkillDiscovery(
  _input: string,
  _messages: Message[],
  _toolUseContext: ToolUseContext,
): Promise<Attachment[]> {
  return Promise.resolve([])
}

export async function prefetchSkillSearch(): Promise<void> {}
