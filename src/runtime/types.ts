import type { AppState } from '../state/AppStateStore.js'
import type { TaskState } from '../tasks/types.js'
import type { Message } from '../types/message.js'
import type { PermissionMode } from '../types/permissions.js'
import type { ModelSetting } from '../utils/model/model.js'
import type {
  SwarmThreadSummary,
  SwarmWaitingEdge,
} from '../utils/swarm/teamConversationLog.js'

export type RuntimeSessionId = string
export type RuntimeSessionChannel = 'cli' | 'web-ui'

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
  owner?: string
  assigneeName?: string
}

export type RuntimeExecutionSource =
  | 'sdk-stream'
  | 'sdk-message'
  | 'assistant-message'
  | 'message-result'
  | 'app-state'
  | 'session-runtime'

export type RuntimeThinkingSummary = {
  messageUuid?: string
  blockType?: 'thinking' | 'redacted_thinking'
  source: RuntimeExecutionSource
}

export type RuntimeTaskUsageSummary = {
  totalTokens?: number
  toolUses?: number
  durationMs?: number
}

export type RuntimeTaskEventPayload = {
  task: RuntimeTaskSummary
  source: RuntimeExecutionSource
  toolUseId?: string
  workflowName?: string
  prompt?: string
  description?: string
  summary?: string
  progressText?: string
  usage?: RuntimeTaskUsageSummary
  lastToolName?: string
}

export type RuntimeToolEventPayload = {
  toolUseId: string
  toolName: string
  source: RuntimeExecutionSource
  parentToolUseId?: string | null
  taskId?: string
  elapsedTimeSeconds?: number
  summary?: string
  inputPreview?: string
  outputPreview?: string
}

export type RuntimeAgentEventPayload = {
  kind:
    | 'task_started'
    | 'task_progress'
    | 'task_completed'
    | 'tool_started'
    | 'tool_completed'
    | 'updated'
  source: RuntimeExecutionSource
  agentId?: string
  agentName?: string
  taskId?: string
  taskTitle?: string
  detail?: string
}

export type RuntimeSwarmSummary = {
  teamName?: string
  isLeader: boolean
  teammateNames: string[]
  teammates: RuntimeSwarmTeammateSummary[]
}

export type RuntimeSwarmTeammateSummary = {
  id: string
  name: string
  agentType?: string
  color?: string
  cwd?: string
  worktreePath?: string
  tmuxSessionName?: string
  tmuxPaneId?: string
}

export type RuntimeSwarmEventPayload = {
  kind:
    | 'updated'
    | 'task_started'
    | 'task_progress'
    | 'task_completed'
    | 'tool_started'
    | 'tool_completed'
  source: RuntimeExecutionSource
  swarm: RuntimeSwarmSummary
  taskId?: string
  taskTitle?: string
  toolUseId?: string
  toolName?: string
}

export type RuntimeSessionSnapshot = {
  sessionId: RuntimeSessionId
  cwd: string
  status: RuntimeSessionStatus
  activeChannel: RuntimeSessionChannel
  activeChannelUpdatedAt: string
  permissionMode: PermissionMode
  isBypassPermissionsModeAvailable: boolean
  isAutoModeAvailable: boolean
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
  swarmThreads: SwarmThreadSummary[]
  swarmWaitingEdges: SwarmWaitingEdge[]
}

export type RuntimeSendMessageInput = {
  text: string
  uuid?: string
  isMeta?: boolean
  channel?: 'cli' | 'web-ui'
}

export type RuntimeSessionConfig = {
  sessionId: RuntimeSessionId
  cwd: string
  getAppState: () => AppState
  getMessages?: () => readonly Message[]
  submitMessage?: (input: RuntimeSendMessageInput) => Promise<void>
  setPermissionMode?: (mode: PermissionMode) => Promise<void> | void
  interrupt?: () => void
  initialStatus?: RuntimeSessionStatus
  initialActiveChannel?: RuntimeSessionChannel
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
  const ownerCandidate =
    ('owner' in task && typeof task.owner === 'string' ? task.owner : undefined) ||
    ('identity' in task &&
    task.identity &&
    typeof task.identity === 'object' &&
    'agentName' in task.identity &&
    typeof task.identity.agentName === 'string'
      ? task.identity.agentName
      : undefined)

  return {
    id: task.id,
    status: task.status,
    kind: getTaskKind(task),
    title: getTaskTitle(task),
    isBackgrounded:
      'isBackgrounded' in task && typeof task.isBackgrounded === 'boolean'
        ? task.isBackgrounded
        : undefined,
    owner: ownerCandidate?.trim() || undefined,
    assigneeName: ownerCandidate?.trim() || undefined,
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
  activeChannel: RuntimeSessionChannel
  activeChannelUpdatedAt: string
  appState: AppState
  messages: readonly Message[]
}): RuntimeSessionSnapshot {
  const {
    sessionId,
    cwd,
    status,
    activeChannel,
    activeChannelUpdatedAt,
    appState,
    messages,
  } = params
  const teammates = Object.entries(appState.teamContext?.teammates || {}).map(
    ([teammateId, teammate]) => ({
      id: teammateId,
      name: teammate.name,
      agentType: teammate.agentType,
      color: teammate.color,
      cwd: teammate.cwd,
      worktreePath: teammate.worktreePath,
      tmuxSessionName: teammate.tmuxSessionName,
      tmuxPaneId: teammate.tmuxPaneId,
    }),
  )
  const teammateNames = teammates.map(teammate => teammate.name)

  return {
    sessionId,
    cwd,
    status,
    activeChannel,
    activeChannelUpdatedAt,
    permissionMode: appState.toolPermissionContext.mode,
    isBypassPermissionsModeAvailable:
      appState.toolPermissionContext.isBypassPermissionsModeAvailable,
    isAutoModeAvailable: !!appState.toolPermissionContext.isAutoModeAvailable,
    messageCount: messages.length,
    taskCount: Object.keys(appState.tasks).length,
    mainLoopModel: appState.mainLoopModel,
    mainLoopModelForSession: appState.mainLoopModelForSession,
    swarm: {
      teamName: appState.teamContext?.teamName,
      isLeader: appState.teamContext?.isLeader ?? false,
      teammateNames,
      teammates,
    },
  }
}

export function createRuntimeSessionDetail(params: {
  snapshot: RuntimeSessionSnapshot
  messages: readonly Message[]
  tasks: RuntimeTaskSummary[]
  swarmThreads?: SwarmThreadSummary[]
  swarmWaitingEdges?: SwarmWaitingEdge[]
}): RuntimeSessionDetail {
  return {
    snapshot: params.snapshot,
    messages: params.messages.slice(-40).map(toRuntimeMessageSummary),
    tasks: params.tasks,
    swarmThreads: params.swarmThreads ?? [],
    swarmWaitingEdges: params.swarmWaitingEdges ?? [],
  }
}
