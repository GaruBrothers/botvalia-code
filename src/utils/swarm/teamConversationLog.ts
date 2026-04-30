import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { logForDebugging } from '../debug.js'
import { getErrnoCode } from '../errors.js'
import * as lockfile from '../lockfile.js'
import { jsonStringify } from '../slowOperations.js'
import { getTeamDir } from './teamHelpers.js'
import {
  type TeamConversationEvent,
  parseTeamConversationEvent,
} from './teamConversationEvents.js'

const LOCK_OPTIONS = {
  retries: {
    retries: 10,
    minTimeout: 5,
    maxTimeout: 100,
  },
}

export type SwarmThreadSummary = {
  threadId: string
  topic?: string
  participants: string[]
  lastKind: TeamConversationEvent['kind']
  lastAt: string
  lastBody: string
  priority: TeamConversationEvent['priority']
  open: boolean
  waitingOn?: {
    from: string
    to: string
    eventId: string
  }
}

export type SwarmWaitingEdge = {
  threadId: string
  topic?: string
  from: string
  to: string
  eventId: string
  body: string
  priority: TeamConversationEvent['priority']
  createdAt: string
}

function getConversationLogPath(teamName: string): string {
  return join(getTeamDir(teamName), 'team-events.jsonl')
}

async function ensureConversationLog(teamName: string): Promise<string> {
  const teamDir = getTeamDir(teamName)
  await mkdir(teamDir, { recursive: true })

  const logPath = getConversationLogPath(teamName)
  try {
    await writeFile(logPath, '', { encoding: 'utf-8', flag: 'wx' })
  } catch (error) {
    const code = getErrnoCode(error)
    if (code !== 'EEXIST') {
      throw error
    }
  }

  return logPath
}

export async function appendTeamConversationEvent(
  teamName: string,
  event: TeamConversationEvent,
): Promise<void> {
  const logPath = await ensureConversationLog(teamName)
  const lockFilePath = `${logPath}.lock`

  let release: (() => Promise<void>) | undefined
  try {
    release = await lockfile.lock(logPath, {
      lockfilePath: lockFilePath,
      ...LOCK_OPTIONS,
    })

    await appendFile(logPath, `${jsonStringify(event)}\n`, 'utf-8')
  } catch (error) {
    logForDebugging(
      `[SwarmLog] Failed to append event for team ${teamName}: ${String(error)}`,
    )
  } finally {
    if (release) {
      await release()
    }
  }
}

export async function readTeamConversationEvents(
  teamName: string,
  limit = 500,
): Promise<TeamConversationEvent[]> {
  const logPath = getConversationLogPath(teamName)

  try {
    const content = await readFile(logPath, 'utf-8')
    const lines = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)

    const events: TeamConversationEvent[] = []
    for (const line of lines) {
      try {
        const parsed = parseTeamConversationEvent(JSON.parse(line))
        if (parsed) {
          events.push(parsed)
        }
      } catch {
        // ignore malformed legacy lines
      }
    }

    return events.slice(-limit)
  } catch (error) {
    const code = getErrnoCode(error)
    if (code === 'ENOENT') {
      return []
    }

    logForDebugging(
      `[SwarmLog] Failed to read events for team ${teamName}: ${String(error)}`,
    )
    return []
  }
}

function sortEventsAscending(
  events: TeamConversationEvent[],
): TeamConversationEvent[] {
  return [...events].sort((a, b) => {
    const timeA = Date.parse(a.timestamp)
    const timeB = Date.parse(b.timestamp)
    return timeA - timeB
  })
}

function isRequestLike(event: TeamConversationEvent): boolean {
  return (
    event.requires_response === true ||
    event.kind === 'question' ||
    event.kind === 'task' ||
    event.kind === 'handoff'
  )
}

function isResolutionLike(event: TeamConversationEvent): boolean {
  return (
    event.kind === 'answer' ||
    event.kind === 'result' ||
    event.kind === 'status'
  )
}

function findWaitingEdge(
  threadEvents: TeamConversationEvent[],
): SwarmWaitingEdge | undefined {
  const ordered = sortEventsAscending(threadEvents)

  for (let index = ordered.length - 1; index >= 0; index--) {
    const candidate = ordered[index]
    if (!isRequestLike(candidate) || candidate.to === '*') {
      continue
    }

    const hasReply = ordered.slice(index + 1).some(event => {
      if (event.thread_id !== candidate.thread_id) {
        return false
      }

      if (event.reply_to && event.reply_to === candidate.event_id) {
        return true
      }

      return (
        isResolutionLike(event) &&
        event.from === candidate.to &&
        event.to === candidate.from
      )
    })

    if (!hasReply) {
      return {
        threadId: candidate.thread_id,
        topic: candidate.topic,
        from: candidate.from,
        to: candidate.to,
        eventId: candidate.event_id,
        body: candidate.body,
        priority: candidate.priority,
        createdAt: candidate.timestamp,
      }
    }
  }

  return undefined
}

export function buildSwarmWaitingEdges(
  events: TeamConversationEvent[],
): SwarmWaitingEdge[] {
  const grouped = new Map<string, TeamConversationEvent[]>()

  for (const event of events) {
    const threadEvents = grouped.get(event.thread_id) ?? []
    threadEvents.push(event)
    grouped.set(event.thread_id, threadEvents)
  }

  return [...grouped.values()]
    .map(findWaitingEdge)
    .filter((edge): edge is SwarmWaitingEdge => edge !== undefined)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export function buildSwarmThreadSummaries(
  events: TeamConversationEvent[],
): SwarmThreadSummary[] {
  const grouped = new Map<string, TeamConversationEvent[]>()

  for (const event of events) {
    const threadEvents = grouped.get(event.thread_id) ?? []
    threadEvents.push(event)
    grouped.set(event.thread_id, threadEvents)
  }

  return [...grouped.entries()]
    .map(([threadId, threadEvents]) => {
      const ordered = sortEventsAscending(threadEvents)
      const lastEvent = ordered[ordered.length - 1]
      const participants = [...new Set(ordered.flatMap(event => [event.from, event.to]))]
      const waitingOn = findWaitingEdge(ordered)

      return {
        threadId,
        topic:
          lastEvent.topic ||
          ordered.find(event => event.topic?.trim())?.topic ||
          undefined,
        participants,
        lastKind: lastEvent.kind,
        lastAt: lastEvent.timestamp,
        lastBody: lastEvent.body,
        priority: lastEvent.priority,
        open: waitingOn !== undefined,
        waitingOn:
          waitingOn &&
          ({
            from: waitingOn.from,
            to: waitingOn.to,
            eventId: waitingOn.eventId,
          }),
      }
    })
    .sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))
}
