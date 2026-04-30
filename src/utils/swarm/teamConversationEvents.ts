import { randomUUID } from 'crypto'
import { z } from 'zod/v4'
import { parseTeamEventText } from './teamEvent.js'

export const TeamConversationEventKindSchema = z.enum([
  'question',
  'answer',
  'task',
  'status',
  'handoff',
  'result',
])

export const TeamConversationEventPrioritySchema = z.enum([
  'low',
  'normal',
  'high',
])

export const TeamConversationEventSchema = z.object({
  type: z.literal('team_event'),
  event_id: z.string(),
  thread_id: z.string(),
  reply_to: z.string().optional(),
  topic: z.string().optional(),
  kind: TeamConversationEventKindSchema,
  priority: TeamConversationEventPrioritySchema.default('normal'),
  from: z.string(),
  to: z.string(),
  body: z.string(),
  timestamp: z.string(),
  requires_response: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type TeamConversationEvent = z.infer<
  typeof TeamConversationEventSchema
>

export function createTeamConversationEvent(params: {
  from: string
  to: string
  body: string
  kind: TeamConversationEvent['kind']
  topic?: string
  thread_id?: string
  reply_to?: string
  priority?: TeamConversationEvent['priority']
  requires_response?: boolean
  metadata?: Record<string, unknown>
}): TeamConversationEvent {
  return {
    type: 'team_event',
    event_id: randomUUID(),
    thread_id: params.thread_id ?? randomUUID(),
    reply_to: params.reply_to,
    topic: params.topic,
    kind: params.kind,
    priority: params.priority ?? 'normal',
    from: params.from,
    to: params.to,
    body: params.body,
    timestamp: new Date().toISOString(),
    requires_response: params.requires_response,
    metadata: params.metadata,
  }
}

export function parseTeamConversationEvent(
  value: unknown,
): TeamConversationEvent | null {
  const parsed = TeamConversationEventSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parseTeamConversationEventText(
  text: string,
): TeamConversationEvent | null {
  const parsed = parseTeamEventText(text)
  if (!parsed) {
    return null
  }
  return parseTeamConversationEvent(parsed.event)
}

function buildHeadline(event: TeamConversationEvent): string {
  const direction = `${event.from} -> ${event.to}`
  const topic = event.topic ? ` · ${event.topic}` : ''
  const thread = ` · thread ${event.thread_id.slice(0, 8)}`
  return `[team_event:${event.kind}] ${direction}${topic}${thread}`
}

export function formatTeamConversationEventForDisplay(
  event: TeamConversationEvent,
): string {
  const lines = [buildHeadline(event)]

  if (event.reply_to) {
    lines.push(`reply_to: ${event.reply_to}`)
  }

  if (event.priority !== 'normal') {
    lines.push(`priority: ${event.priority}`)
  }

  if (event.requires_response) {
    lines.push('requires_response: true')
  }

  lines.push(event.body)
  return lines.join('\n')
}

export function getTeamConversationEventSummary(
  event: TeamConversationEvent,
): string {
  const base =
    event.topic?.trim() ||
    event.body
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 72)

  return `[${event.kind}] ${base || `${event.from} -> ${event.to}`}`
}
