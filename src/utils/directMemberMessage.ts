import { isLocalAgentTask, queuePendingMessage } from '../tasks/LocalAgentTask/LocalAgentTask.js'
import type { AppState } from '../state/AppState.js'

type DirectMessageTarget = {
  recipientName: string
  message: string
}

type DirectMessageAppState = Pick<
  AppState,
  'teamContext' | 'agentNameRegistry' | 'tasks'
>

type SetAppStateLike = (f: (prev: AppState) => AppState) => void

type ResolvedDirectRecipient =
  | {
      type: 'teammate'
      recipientName: string
      teamName: string
    }
  | {
      type: 'named_agent'
      recipientName: string
      agentId: string
    }

function parseDirectMessageLine(input: string): DirectMessageTarget | null {
  const match = input.match(/^@([\w-]+)\s+(.+)$/s)
  if (!match) return null

  const [, recipientName, message] = match
  if (!recipientName || !message) return null

  const trimmedMessage = message.trim()
  if (!trimmedMessage) return null

  return { recipientName, message: trimmedMessage }
}

/**
 * Parse one or more `@agent-name message` lines for direct messaging.
 * Returns null if any non-empty line is not a direct-message instruction.
 */
export function parseDirectMemberMessages(
  input: string,
): DirectMessageTarget[] | null {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  const parsedLines = lines.map(parseDirectMessageLine)
  if (parsedLines.some(line => !line)) {
    return null
  }

  return parsedLines as DirectMessageTarget[]
}

/**
 * Parse `@agent-name message` syntax for a single direct message.
 */
export function parseDirectMemberMessage(
  input: string,
): DirectMessageTarget | null {
  const messages = parseDirectMemberMessages(input)
  return messages?.length === 1 ? messages[0] : null
}

export type DirectMessageResult =
  | { success: true; recipientName: string; delivery: 'teammate' | 'named_agent' }
  | {
      success: false
      error: 'no_team_context' | 'unknown_recipient' | 'agent_unavailable'
      recipientName?: string
    }

export type DirectMessageBatchResult =
  | {
      success: true
      deliveries: Array<{
        recipientName: string
        delivery: 'teammate' | 'named_agent'
      }>
    }
  | {
      success: false
      error: 'no_team_context' | 'unknown_recipient' | 'agent_unavailable'
      recipientName?: string
    }

type WriteToMailboxFn = (
  recipientName: string,
  message: { from: string; text: string; timestamp: string },
  teamName: string,
) => Promise<void>

function resolveDirectRecipient(
  recipientName: string,
  appState: DirectMessageAppState,
  writeToMailbox?: WriteToMailboxFn,
  setAppState?: SetAppStateLike,
): DirectMessageResult | (ResolvedDirectRecipient & { success: true }) {
  const teamContext = appState.teamContext
  const teammate = Object.values(teamContext?.teammates ?? {}).find(
    t => t.name === recipientName,
  )

  if (teammate && teamContext && writeToMailbox) {
    return {
      success: true,
      type: 'teammate',
      recipientName,
      teamName: teamContext.teamName,
    }
  }

  const namedAgentId = appState.agentNameRegistry.get(recipientName)
  if (namedAgentId) {
    const task = appState.tasks[namedAgentId]
    if (isLocalAgentTask(task) && task.status === 'running' && setAppState) {
      return {
        success: true,
        type: 'named_agent',
        recipientName,
        agentId: namedAgentId,
      }
    }

    return {
      success: false,
      error: 'agent_unavailable',
      recipientName,
    }
  }

  if (!teamContext || !writeToMailbox) {
    return { success: false, error: 'no_team_context' }
  }

  return { success: false, error: 'unknown_recipient', recipientName }
}

/**
 * Send a direct message to a teammate or a named running agent, bypassing the model.
 */
export async function sendDirectMemberMessage(
  recipientName: string,
  message: string,
  appState: DirectMessageAppState,
  writeToMailbox?: WriteToMailboxFn,
  setAppState?: SetAppStateLike,
): Promise<DirectMessageResult> {
  const resolved = resolveDirectRecipient(
    recipientName,
    appState,
    writeToMailbox,
    setAppState,
  )

  if (!resolved.success) {
    return resolved
  }

  if (resolved.type === 'named_agent') {
    queuePendingMessage(resolved.agentId, message, setAppState!)
    return { success: true, recipientName, delivery: 'named_agent' }
  }

  await writeToMailbox!(
    resolved.recipientName,
    {
      from: 'user',
      text: message,
      timestamp: new Date().toISOString(),
    },
    resolved.teamName,
  )

  return { success: true, recipientName, delivery: 'teammate' }
}

/**
 * Send multiple direct messages atomically: validate all recipients first,
 * then dispatch the whole batch.
 */
export async function sendDirectMemberMessages(
  messages: DirectMessageTarget[],
  appState: DirectMessageAppState,
  writeToMailbox?: WriteToMailboxFn,
  setAppState?: SetAppStateLike,
): Promise<DirectMessageBatchResult> {
  const resolvedRecipients: Array<
    ResolvedDirectRecipient & { success: true; message: string }
  > = []

  for (const message of messages) {
    const resolved = resolveDirectRecipient(
      message.recipientName,
      appState,
      writeToMailbox,
      setAppState,
    )

    if (!resolved.success) {
      return resolved
    }

    resolvedRecipients.push({
      ...resolved,
      message: message.message,
    })
  }

  await Promise.all(
    resolvedRecipients.map(async resolved => {
      if (resolved.type === 'named_agent') {
        queuePendingMessage(resolved.agentId, resolved.message, setAppState!)
        return
      }

      await writeToMailbox!(
        resolved.recipientName,
        {
          from: 'user',
          text: resolved.message,
          timestamp: new Date().toISOString(),
        },
        resolved.teamName,
      )
    }),
  )

  return {
    success: true,
    deliveries: resolvedRecipients.map(resolved => ({
      recipientName: resolved.recipientName,
      delivery: resolved.type,
    })),
  }
}

export function getDirectMessageFailureText(
  result: {
    error: 'no_team_context' | 'unknown_recipient' | 'agent_unavailable'
    recipientName?: string
  },
  options: { isBatch?: boolean } = {},
): string {
  switch (result.error) {
    case 'agent_unavailable':
      return `@${result.recipientName ?? 'agent'} exists, but it is not running right now.`
    case 'unknown_recipient':
      return `Couldn't route @${result.recipientName ?? 'agent'}. Use an active teammate or a running named agent.`
    case 'no_team_context':
      return options.isBatch
        ? 'Direct @tasks need active teammates or running named agents.'
        : 'No active teammates are available for direct @messaging.'
  }
}
