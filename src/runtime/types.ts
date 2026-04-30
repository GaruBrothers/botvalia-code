import type { AppState } from '../state/AppStateStore.js'
import type { TaskState } from '../tasks/types.js'
import type { Message } from '../types/message.js'
import type { ModelSetting } from '../utils/model/model.js'

export type RuntimeSessionId = string

export type RuntimeSessionStatus =
  | 'idle'
  | 'running'
  | 'requires_action'
  | 'completed'
  | 'interrupted'
  | 'errored'

export type RuntimeTaskSummary = {
  id: string
  status: string
  kind?: string
  title?: string
  isBackgrounded?: boolean
}

export type RuntimeSwarmSummary = {
  teamName?: string
  isLeader: boolean
  teammateNames: string[]
}

export type RuntimeSessionSnapshot = {
  sessionId: RuntimeSessionId
  cwd: string
  status: RuntimeSessionStatus
  messageCount: number
  taskCount: number
  mainLoopModel: ModelSetting
  mainLoopModelForSession: ModelSetting
  swarm: RuntimeSwarmSummary
}

export type RuntimeMessageSummary = {
  uuid: string
  timestamp: string
  type: Message['type']
  label: string
  text: string
  isMeta?: boolean
}

export type RuntimeSessionDetail = {
  snapshot: RuntimeSessionSnapshot
  messages: RuntimeMessageSummary[]
  tasks: RuntimeTaskSummary[]
}

export type RuntimeSendMessageInput = {
  text: string
  uuid?: string
  isMeta?: boolean
}

export type RuntimeSessionConfig = {
  sessionId: RuntimeSessionId
  cwd: string
  getAppState: () => AppState
  getMessages?: () => readonly Message[]
  submitMessage?: (input: RuntimeSendMessageInput) => Promise<void>
  interrupt?: () => void
  initialStatus?: RuntimeSessionStatus
}

function getTaskTitle(task: TaskState): string | undefined {
  const titleCandidate =
    ('description' in task && typeof task.description === 'string'
      ? task.description
      : undefined) ||
    ('title' in task && typeof task.title === 'string' ? task.title : undefined) ||
    ('command' in task && typeof task.command === 'string'
      ? task.command
      : undefined)

  return titleCandidate?.trim() || undefined
}

function getTaskKind(task: TaskState): string | undefined {
  const kindCandidate =
    ('type' in task && typeof task.type === 'string' ? task.type : undefined) ||
    ('taskType' in task && typeof task.taskType === 'string'
      ? task.taskType
      : undefined)

  return kindCandidate?.trim() || undefined
}

export function toRuntimeTaskSummary(task: TaskState): RuntimeTaskSummary {
  return {
    id: task.id,
    status: task.status,
    kind: getTaskKind(task),
    title: getTaskTitle(task),
    isBackgrounded:
      'isBackgrounded' in task && typeof task.isBackgrounded === 'boolean'
        ? task.isBackgrounded
        : undefined,
  }
}

function summarizeContentBlocks(blocks: unknown[]): string {
  return blocks
    .map(block => {
      if (!block || typeof block !== 'object') {
        return ''
      }

      const candidate = block as {
        type?: unknown
        text?: unknown
        thinking?: unknown
      }

      if (typeof candidate.text === 'string') {
        return candidate.text
      }

      if (typeof candidate.thinking === 'string') {
        return '[thinking]'
      }

      if (typeof candidate.type === 'string') {
        return `[${candidate.type}]`
      }

      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function summarizeMessageText(message: Message): string {
  if (message.type === 'user') {
    const content = message.message.content
    return typeof content === 'string' ? content : summarizeContentBlocks(content)
  }

  if (message.type === 'assistant') {
    return summarizeContentBlocks(message.message.content)
  }

  if (message.type === 'system') {
    return message.content || message.message || ''
  }

  if (message.type === 'progress') {
    return JSON.stringify(message.data)
  }

  if (message.type === 'attachment') {
    return (
      message.attachment.message ||
      message.attachment.stdout ||
      message.attachment.stderr ||
      message.path ||
      message.attachment.type ||
      ''
    )
  }

  return ''
}

export function toRuntimeMessageSummary(message: Message): RuntimeMessageSummary {
  const label =
    message.type === 'system'
      ? message.subtype
        ? `system:${message.subtype}`
        : 'system'
      : message.type === 'attachment'
        ? `attachment:${message.attachment.type || 'unknown'}`
        : message.type

  return {
    uuid: message.uuid,
    timestamp: message.timestamp,
    type: message.type,
    label,
    text: summarizeMessageText(message),
    isMeta: message.isMeta,
  }
}

export function createRuntimeSessionSnapshot(params: {
  sessionId: RuntimeSessionId
  cwd: string
  status: RuntimeSessionStatus
  appState: AppState
  messages: readonly Message[]
}): RuntimeSessionSnapshot {
  const { sessionId, cwd, status, appState, messages } = params
  const teammateNames = Object.values(appState.teamContext?.teammates || {}).map(
    teammate => teammate.name,
  )

  return {
    sessionId,
    cwd,
    status,
    messageCount: messages.length,
    taskCount: Object.keys(appState.tasks).length,
    mainLoopModel: appState.mainLoopModel,
    mainLoopModelForSession: appState.mainLoopModelForSession,
    swarm: {
      teamName: appState.teamContext?.teamName,
      isLeader: appState.teamContext?.isLeader ?? false,
      teammateNames,
    },
  }
}

export function createRuntimeSessionDetail(params: {
  snapshot: RuntimeSessionSnapshot
  messages: readonly Message[]
  tasks: RuntimeTaskSummary[]
}): RuntimeSessionDetail {
  return {
    snapshot: params.snapshot,
    messages: params.messages.slice(-40).map(toRuntimeMessageSummary),
    tasks: params.tasks,
  }
}
