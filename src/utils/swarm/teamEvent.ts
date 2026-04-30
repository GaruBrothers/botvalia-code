import { jsonParse, jsonStringify } from '../slowOperations.js'

export const TEAM_EVENT_ENVELOPE_KIND = 'team_event'
export const TEAM_EVENT_ENVELOPE_VERSION = 1

export type TeamEvent = {
  type: string
  [key: string]: unknown
}

export type TeamEventEnvelope<TEvent extends TeamEvent = TeamEvent> = {
  kind: typeof TEAM_EVENT_ENVELOPE_KIND
  version: typeof TEAM_EVENT_ENVELOPE_VERSION
  event: TEvent
}

export type TeamEventEncoding = 'envelope' | 'legacy'

export type ParsedTeamEvent<TEvent extends TeamEvent = TeamEvent> = {
  encoding: TeamEventEncoding
  envelope: TeamEventEnvelope<TEvent> | null
  event: TEvent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isTeamEvent(value: unknown): value is TeamEvent {
  return isRecord(value) && typeof value.type === 'string'
}

export function isTeamEventEnvelope<TEvent extends TeamEvent = TeamEvent>(
  value: unknown,
): value is TeamEventEnvelope<TEvent> {
  return (
    isRecord(value) &&
    value.kind === TEAM_EVENT_ENVELOPE_KIND &&
    value.version === TEAM_EVENT_ENVELOPE_VERSION &&
    isTeamEvent(value.event)
  )
}

export function createTeamEventEnvelope<TEvent extends TeamEvent>(
  event: TEvent,
): TeamEventEnvelope<TEvent> {
  return {
    kind: TEAM_EVENT_ENVELOPE_KIND,
    version: TEAM_EVENT_ENVELOPE_VERSION,
    event,
  }
}

export function serializeTeamEvent<TEvent extends TeamEvent>(
  event: TEvent,
): string {
  return jsonStringify(createTeamEventEnvelope(event))
}

export function extractTeamEvent<TEvent extends TeamEvent = TeamEvent>(
  value: unknown,
): ParsedTeamEvent<TEvent> | null {
  if (isTeamEventEnvelope<TEvent>(value)) {
    return {
      encoding: 'envelope',
      envelope: value,
      event: value.event,
    }
  }

  if (isTeamEvent(value)) {
    return {
      encoding: 'legacy',
      envelope: null,
      event: value as TEvent,
    }
  }

  return null
}

export function parseTeamEventText<TEvent extends TeamEvent = TeamEvent>(
  text: string,
): ParsedTeamEvent<TEvent> | null {
  try {
    return extractTeamEvent<TEvent>(jsonParse(text))
  } catch {
    return null
  }
}

export function unwrapTeamEvent<TEvent extends TeamEvent = TeamEvent>(
  textOrValue: string | unknown,
): TEvent | null {
  const parsed =
    typeof textOrValue === 'string'
      ? parseTeamEventText<TEvent>(textOrValue)
      : extractTeamEvent<TEvent>(textOrValue)

  return parsed?.event ?? null
}
