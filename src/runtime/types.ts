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
export type RuntimeLeaseId = string

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

export type RuntimeSessionChannelOwner = {
  channel: RuntimeSessionChannel
  clientId?: string
  leaseId?: RuntimeLeaseId
  claimedAt: string
  leaseExpiresAt?: string
  takeoverAt?: string
}

export type RuntimeSessionSnapshot = {
  sessionId: RuntimeSessionId
  cwd: string
  title: string
  isArchived: boolean
  isPinned: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  status: RuntimeSessionStatus
  hasLiveRuntime: boolean
  activeChannel: RuntimeSessionChannel
  activeChannelUpdatedAt: string
  channelOwner: RuntimeSessionChannelOwner | null
  leaseExpiresAt?: string
  permissionMode: PermissionMode
  isBypassPermissionsModeAvailable: boolean
  isAutoModeAvailable: boolean
  messageCount: number
  taskCount: number
  mainLoopModel: ModelSetting
  mainLoopModelForSession: ModelSetting
  swarm: RuntimeSwarmSummary
}

export type RuntimeMessageBlock =
  | {
      type: 'text' | 'markdown'
      text: string
    }
  | {
      type: 'thinking' | 'redacted_thinking'
      text: string
    }
  | {
      type: 'tool_use'
      toolUseId?: string
      toolName?: string
      text: string
      inputPreview?: string
    }
  | {
      type: 'tool_result'
      toolUseId?: string
      text: string
    }
  | {
      type: 'attachment_reference'
      attachmentType?: string
      path?: string
      text: string
    }
  | {
      type: 'json'
      text: string
    }

export type RuntimeMessageSummary = {
  uuid: string
  timestamp: string
  type: Message['type']
  label: string
  text: string
  blocks: RuntimeMessageBlock[]
  isMeta?: boolean
}

export type RuntimeSessionEventSeverity = 'info' | 'warn' | 'error'

export type RuntimeSessionEventRecord = {
  id: string
  timestamp: string
  source: 'runtime' | 'service' | 'session-store'
  severity: RuntimeSessionEventSeverity
  eventType: string
  message: string
}

export type RuntimeModelOption = {
  value: ModelSetting
  label: string
  description: string
}

export type RuntimeSessionDetail = {
  snapshot: RuntimeSessionSnapshot
  messages: RuntimeMessageSummary[]
  tasks: RuntimeTaskSummary[]
  swarmThreads: SwarmThreadSummary[]
  swarmWaitingEdges: SwarmWaitingEdge[]
  events: RuntimeSessionEventRecord[]
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
  setSessionModel?: (model: ModelSetting) => Promise<void> | void
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

function toRuntimeMessageBlocks(blocks: unknown[]): RuntimeMessageBlock[] {
  return blocks.flatMap(block => {
    if (!block || typeof block !== 'object') {
      return []
    }

    const candidate = block as {
      type?: unknown
      text?: unknown
      thinking?: unknown
      id?: unknown
      name?: unknown
      input?: unknown
      tool_use_id?: unknown
      content?: unknown
      path?: unknown
    }

    if (typeof candidate.text === 'string') {
      const type =
        candidate.type === 'text' || candidate.type === 'markdown'
          ? candidate.type
          : 'markdown'
      return [{ type, text: candidate.text }]
    }

    if (typeof candidate.thinking === 'string') {
      return [
        {
          type:
            candidate.type === 'redacted_thinking'
              ? 'redacted_thinking'
              : 'thinking',
          text: candidate.thinking,
        },
      ]
    }

    if (candidate.type === 'tool_use') {
      return [
        {
          type: 'tool_use',
          toolUseId: typeof candidate.id === 'string' ? candidate.id : undefined,
          toolName:
            typeof candidate.name === 'string' ? candidate.name : undefined,
          inputPreview:
            candidate.input === undefined
              ? undefined
              : JSON.stringify(candidate.input),
          text:
            typeof candidate.name === 'string'
              ? `[tool_use] ${candidate.name}`
              : '[tool_use]',
        },
      ]
    }

    if (candidate.type === 'tool_result') {
      return [
        {
          type: 'tool_result',
          toolUseId:
            typeof candidate.tool_use_id === 'string'
              ? candidate.tool_use_id
              : undefined,
          text:
            typeof candidate.content === 'string'
              ? candidate.content
              : candidate.content === undefined
                ? '[tool_result]'
                : JSON.stringify(candidate.content),
        },
      ]
    }

    if (typeof candidate.type === 'string') {
      return [{ type: 'markdown', text: `[${candidate.type}]` }]
    }

    return []
  })
}

function summarizeContentBlocks(blocks: unknown[]): string {
  return toRuntimeMessageBlocks(blocks)
    .map(block => {
      if ('toolName' in block && block.toolName) {
        return block.text
      }

      return block.text
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
    blocks:
      message.type === 'user'
        ? typeof message.message.content === 'string'
          ? [{ type: 'markdown', text: message.message.content }]
          : toRuntimeMessageBlocks(message.message.content)
        : message.type === 'assistant'
          ? toRuntimeMessageBlocks(message.message.content)
          : message.type === 'system'
            ? [{ type: 'markdown', text: message.content || message.message || '' }]
            : message.type === 'attachment'
              ? [
                  {
                    type: 'attachment_reference',
                    attachmentType: message.attachment.type,
                    path: message.path,
                    text:
                      message.attachment.message ||
                      message.attachment.stdout ||
                      message.attachment.stderr ||
                      message.path ||
                      message.attachment.type ||
                      '',
                  },
                ]
              : [{ type: 'json', text: JSON.stringify(message.data) }],
    isMeta: message.isMeta,
  }
}

export function createRuntimeSessionSnapshot(params: {
  sessionId: RuntimeSessionId
  cwd: string
  title: string
  isArchived: boolean
  isPinned: boolean
  notes?: string
  createdAt: string
  updatedAt: string
  status: RuntimeSessionStatus
  hasLiveRuntime?: boolean
  activeChannel: RuntimeSessionChannel
  activeChannelUpdatedAt: string
  channelOwner: RuntimeSessionChannelOwner | null
  appState: AppState
  messages: readonly Message[]
}): RuntimeSessionSnapshot {
  const {
    sessionId,
    cwd,
    title,
    isArchived,
    isPinned,
    notes,
    createdAt,
    updatedAt,
    status,
    hasLiveRuntime = true,
    activeChannel,
    activeChannelUpdatedAt,
    channelOwner,
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
    title,
    isArchived,
    isPinned,
    notes,
    createdAt,
    updatedAt,
    status,
    hasLiveRuntime,
    activeChannel,
    activeChannelUpdatedAt,
    channelOwner,
    leaseExpiresAt: channelOwner?.leaseExpiresAt,
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
  events?: RuntimeSessionEventRecord[]
}): RuntimeSessionDetail {
  return {
    snapshot: params.snapshot,
    messages: params.messages.slice(-40).map(toRuntimeMessageSummary),
    tasks: params.tasks,
    swarmThreads: params.swarmThreads ?? [],
    swarmWaitingEdges: params.swarmWaitingEdges ?? [],
    events: params.events ?? [],
  }
}
