import type {
  ContentBlock,
  ContentBlockParam,
  RawMessageStreamEvent,
  RedactedThinkingBlock,
  RedactedThinkingBlockParam,
  ThinkingBlock,
  ThinkingBlockParam,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaRawMessageStreamEvent,
  BetaStopReason,
  BetaUsage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'

export type MessageOrigin = {
  kind?: string
  [key: string]: unknown
}

export type MessageContentBlock =
  | ContentBlock
  | ContentBlockParam
  | BetaContentBlock
  | BetaContentBlockParam
  | ThinkingBlock
  | ThinkingBlockParam
  | RedactedThinkingBlock
  | RedactedThinkingBlockParam
  | ToolUseBlock
  | ToolUseBlockParam
  | ToolResultBlockParam

export type UserMessageContentBlock = ContentBlockParam

type MessageUUID = string

type MessageMetadata = {
  uuid: MessageUUID
  timestamp: string
}

export type MessageBase = MessageMetadata & {
  parentUuid?: MessageUUID | null
  logicalParentUuid?: MessageUUID | null
  createdAt?: string
  isMeta?: boolean
  isVirtual?: boolean
  isVisibleInTranscriptOnly?: boolean
  isCompactSummary?: boolean
  isApiErrorMessage?: boolean
  toolUseResult?: unknown
  toolUseID?: string
  parentToolUseID?: string
  sourceToolUseID?: string
  sourceToolAssistantUUID?: MessageUUID
  requestId?: string
  imagePasteIds?: number[]
  permissionMode?: unknown
  summarizeMetadata?: {
    messagesSummarized: number
    userContext?: string
    direction?: PartialCompactDirection
  }
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  origin?: MessageOrigin
  [key: string]: unknown
}

export type MessageAttachment = {
  type: string
  hookName?: string
  hookEvent?: string
  toolUseID?: string
  content?: unknown
  stdout?: string
  stderr?: string
  exitCode?: number
  durationMs?: number
  command?: string
  commandMode?: string
  source_uuid?: MessageUUID
  truncated?: boolean
  isMeta?: boolean
  message?: string
  [key: string]: unknown
}

export type AttachmentMessage<
  TAttachment extends MessageAttachment = MessageAttachment,
> = MessageBase & {
  type: 'attachment'
  path?: string
  attachment: TAttachment
}

export type AssistantMessagePayload<
  TContentBlock extends MessageContentBlock = MessageContentBlock,
> = {
  id: string
  role: 'assistant'
  content: TContentBlock[]
  model?: string
  type?: string
  stop_reason?: BetaStopReason | null
  stop_sequence?: string | null
  usage?: BetaUsage | null
  context_management?: unknown
  container?: unknown
  [key: string]: unknown
}

export type UserMessagePayload<
  TContentBlock extends MessageContentBlock = MessageContentBlock,
> = {
  role: 'user'
  content: string | TContentBlock[]
  [key: string]: unknown
}

export type UserMessage<
  TContentBlock extends UserMessageContentBlock = UserMessageContentBlock,
> = MessageBase & {
  type: 'user'
  message: UserMessagePayload<TContentBlock>
}

export type AssistantMessage<
  TContentBlock extends MessageContentBlock = MessageContentBlock,
> = MessageBase & {
  type: 'assistant'
  message: AssistantMessagePayload<TContentBlock>
  apiError?: string
  error?: unknown
  errorDetails?: string
  advisorModel?: string
}

export type ProgressPayload = {
  type: string
  [key: string]: unknown
}

export type ProgressMessage<P = ProgressPayload> = MessageBase & {
  type: 'progress'
  data: P
  toolUseID: string
  parentToolUseID: string
}

export type SystemMessageLevel = 'info' | 'warning' | 'error' | string

export type CompactMetadata = {
  trigger: 'manual' | 'auto'
  preTokens: number
  userContext?: string
  messagesSummarized?: number
  preservedSegment?: {
    headUuid: string
    anchorUuid: string
    tailUuid: string
  }
  preCompactDiscoveredTools?: string[]
  [key: string]: unknown
}

export type MicrocompactMetadata = {
  trigger: 'auto'
  preTokens: number
  tokensSaved: number
  compactedToolIds: string[]
  clearedAttachmentUUIDs: string[]
  [key: string]: unknown
}

export type StopHookInfo = {
  command?: string
  promptText?: string
  durationMs?: number
  [key: string]: unknown
}

export type SystemMessage = MessageBase & {
  type: 'system'
  subtype?: string
  level?: SystemMessageLevel
  content?: string
  message?: string
}

export type SystemLocalCommandMessage = SystemMessage & {
  subtype: 'local_command'
}

export type SystemBridgeStatusMessage = SystemMessage & {
  subtype: 'bridge_status'
  url?: string
  upgradeNudge?: string
}

export type SystemTurnDurationMessage = SystemMessage & {
  subtype: 'turn_duration'
  durationMs: number
  budgetTokens?: number
  budgetLimit?: number
  budgetNudges?: number
  messageCount?: number
}

export type SystemThinkingMessage = SystemMessage

export type SystemMemorySavedMessage = SystemMessage & {
  subtype: 'memory_saved'
  writtenPaths: string[]
}

export type SystemStopHookSummaryMessage = SystemMessage & {
  subtype: 'stop_hook_summary'
  hookCount: number
  hookInfos: StopHookInfo[]
  hookErrors: string[]
  preventedContinuation: boolean
  stopReason?: string
  hasOutput: boolean
  hookLabel?: string
  totalDurationMs?: number
}

export type SystemInformationalMessage = SystemMessage & {
  subtype?: 'informational' | string
}

export type SystemCompactBoundaryMessage = SystemMessage & {
  subtype: 'compact_boundary'
  compactMetadata: CompactMetadata
}

export type SystemMicrocompactBoundaryMessage = SystemMessage & {
  subtype: 'microcompact_boundary'
  microcompactMetadata: MicrocompactMetadata
}

export type SystemPermissionRetryMessage = SystemMessage & {
  subtype: 'permission_retry'
  commands: string[]
}

export type SystemScheduledTaskFireMessage = SystemMessage & {
  subtype: 'scheduled_task_fire'
}

export type SystemAwaySummaryMessage = SystemMessage & {
  subtype: 'away_summary'
}

export type SystemAgentsKilledMessage = SystemMessage & {
  subtype: 'agents_killed'
}

export type SystemApiMetricsMessage = SystemMessage & {
  subtype: 'api_metrics'
  ttftMs: number
  otps: number
  isP50?: boolean
  hookDurationMs?: number
  turnDurationMs?: number
  toolDurationMs?: number
  classifierDurationMs?: number
  toolCount?: number
  hookCount?: number
  classifierCount?: number
  configWriteCount?: number
}

export type SystemAPIErrorMessage = SystemMessage & {
  error?: unknown
}

export type SystemFileSnapshotMessage = SystemMessage

export type HookResultMessage =
  | AttachmentMessage
  | SystemMessage
  | UserMessage
  | ProgressMessage

export type ToolUseSummaryMessage = MessageBase & {
  type: 'tool_use_summary'
  summary: string
  precedingToolUseIds: string[]
}

export type StreamEnvelopeEvent =
  | RawMessageStreamEvent
  | BetaRawMessageStreamEvent

export type StreamEvent = {
  type: 'stream_event'
  event: StreamEnvelopeEvent
  ttftMs?: number
}

export type RequestStartEvent = {
  type: 'stream_request_start'
}

export type PartialCompactDirection = 'older' | 'newer' | 'both' | string

export type NormalizedAssistantMessage<
  TContentBlock extends MessageContentBlock = MessageContentBlock,
> = AssistantMessage<TContentBlock> & {
  message: AssistantMessagePayload<TContentBlock> & {
    content: [TContentBlock]
  }
}

export type NormalizedUserMessage<
  TContentBlock extends UserMessageContentBlock = UserMessageContentBlock,
> = UserMessage<TContentBlock> & {
  message: UserMessagePayload<TContentBlock> & {
    content: [TContentBlock]
  }
}

export type GroupedToolUseMessage<
  TContentBlock extends ToolUseBlock | ToolUseBlockParam =
    | ToolUseBlock
    | ToolUseBlockParam,
> = MessageBase & {
  type: 'grouped_tool_use'
  toolName: string
  messages: NormalizedAssistantMessage<TContentBlock>[]
  results: NormalizedUserMessage[]
  displayMessage: NormalizedAssistantMessage<TContentBlock>
  messageId: string
}

export type CollapsibleMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | GroupedToolUseMessage

export type CollapsedReadSearchGroup = MessageBase & {
  type: 'collapsed_read_search'
  searchCount: number
  readCount: number
  listCount: number
  replCount: number
  memorySearchCount: number
  memoryReadCount: number
  memoryWriteCount: number
  readFilePaths: string[]
  searchArgs: string[]
  latestDisplayHint?: string
  messages: CollapsibleMessage[]
  displayMessage: CollapsibleMessage
  teamMemorySearchCount?: number
  teamMemoryReadCount?: number
  teamMemoryWriteCount?: number
  mcpCallCount?: number
  mcpServerNames?: string[]
  bashCount?: number
  gitOpBashCount?: number
  commits?: Array<{ sha: string; kind: string }>
  pushes?: Array<{ branch: string }>
  branches?: Array<{ ref: string; action: string }>
  prs?: Array<{ number: number; url?: string; action: string }>
  hookTotalMs?: number
  hookCount?: number
  hookInfos?: StopHookInfo[]
  relevantMemories?: Array<{
    path: string
    content: string
    mtimeMs: number
  }>
}

export type TombstoneMessage = MessageBase & {
  type: 'tombstone'
  message: Message
}

export type NormalizedMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | ProgressMessage
  | SystemMessage
  | AttachmentMessage

export type RenderableMessage =
  | NormalizedMessage
  | GroupedToolUseMessage
  | CollapsedReadSearchGroup

export type Message =
  | UserMessage
  | AssistantMessage
  | ProgressMessage
  | SystemMessage
  | AttachmentMessage

