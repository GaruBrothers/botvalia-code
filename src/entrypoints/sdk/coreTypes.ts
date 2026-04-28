// SDK Core Types - Common serializable types used by both SDK consumers and SDK builders.
//
// Types are generated from Zod schemas in coreSchemas.ts.
// To modify types:
// 1. Edit Zod schemas in coreSchemas.ts
// 2. Run: bun scripts/generate-sdk-types.ts
//
// Schemas are available in coreSchemas.ts for runtime validation but are not
// part of the public API.

import type {
  AssistantMessage as InternalAssistantMessage,
  UserMessage as InternalUserMessage,
} from '../../types/message.js'
import type {
  PermissionMode,
  PermissionResult,
} from '../../types/permissions.js'
import type { NonNullableUsage } from './sdkUtilityTypes.js'

// Re-export sandbox types for SDK consumers
export type {
  SandboxFilesystemConfig,
  SandboxIgnoreViolations,
  SandboxNetworkConfig,
  SandboxSettings,
} from '../sandboxTypes.js'

// Re-export utility types that can't be expressed as Zod schemas
export type { NonNullableUsage }
export type { PermissionMode, PermissionResult }

// Const arrays for runtime usage
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged',
  'FileChanged',
] as const

export const EXIT_REASONS = [
  'clear',
  'resume',
  'logout',
  'prompt_input_exit',
  'other',
  'bypass_permissions_disabled',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]
export type ExitReason = (typeof EXIT_REASONS)[number]

export type ModelUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
  maxOutputTokens: number
}

export type ModelInfo = {
  value: string
  displayName: string
  description: string
  supportsEffort?: boolean
  supportedEffortLevels?: Array<'low' | 'medium' | 'high' | 'max'>
  supportsAdaptiveThinking?: boolean
  supportsFastMode?: boolean
  supportsAutoMode?: boolean
}

export type McpStdioServerConfigForProcessTransport = {
  type?: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type McpSSEServerConfigForProcessTransport = {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpHttpServerConfigForProcessTransport = {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export type McpSdkServerConfigForProcessTransport = {
  type: 'sdk'
  name: string
}

export type McpServerConfigForProcessTransport =
  | McpStdioServerConfigForProcessTransport
  | McpSSEServerConfigForProcessTransport
  | McpHttpServerConfigForProcessTransport
  | McpSdkServerConfigForProcessTransport

export type McpServerStatus = {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  serverInfo?: {
    name: string
    version: string
  }
  error?: string
  config?:
    | McpServerConfigForProcessTransport
    | {
        type: 'claudeai-proxy'
        url: string
        id: string
      }
  scope?: string
  tools?: Array<{
    name: string
    description?: string
    annotations?: {
      readOnly?: boolean
      destructive?: boolean
      openWorld?: boolean
    }
  }>
  capabilities?: {
    experimental?: Record<string, unknown>
  }
}

export type RewindFilesResult = {
  canRewind: boolean
  error?: string
  filesChanged?: string[]
  insertions?: number
  deletions?: number
}

export type FastModeState = 'off' | 'cooldown' | 'on'
export type SDKStatus = 'compacting' | null
export type SDKAssistantMessageError =
  | 'authentication_failed'
  | 'billing_error'
  | 'rate_limit'
  | 'invalid_request'
  | 'server_error'
  | 'unknown'
  | 'max_output_tokens'

export type SDKRateLimitInfo = {
  status: 'allowed' | 'allowed_warning' | 'rejected'
  resetsAt?: number
  rateLimitType?:
    | 'five_hour'
    | 'seven_day'
    | 'seven_day_opus'
    | 'seven_day_sonnet'
    | 'overage'
  utilization?: number
  overageStatus?: 'allowed' | 'allowed_warning' | 'rejected'
  overageResetsAt?: number
  overageDisabledReason?:
    | 'overage_not_provisioned'
    | 'org_level_disabled'
    | 'org_level_disabled_until'
    | 'out_of_credits'
    | 'seat_tier_level_disabled'
    | 'member_level_disabled'
    | 'seat_tier_zero_credit_limit'
    | 'group_zero_credit_limit'
    | 'member_zero_credit_limit'
    | 'org_service_level_disabled'
    | 'org_service_zero_credit_limit'
    | 'no_limits_configured'
    | 'unknown'
  isUsingOverage?: boolean
  surpassedThreshold?: number
}

type SDKUserAPIMessage = InternalUserMessage['message']
type SDKAssistantAPIMessage = NonNullable<InternalAssistantMessage['message']>

export type SDKPermissionDenial = {
  tool_name: string
  tool_use_id: string
  tool_input: Record<string, unknown>
}

export type SDKUserMessage = {
  type: 'user'
  message: SDKUserAPIMessage
  parent_tool_use_id: string | null
  isSynthetic?: boolean
  tool_use_result?: unknown
  priority?: 'now' | 'next' | 'later'
  timestamp?: string
  uuid?: string
  session_id?: string
}

export type SDKUserMessageReplay = SDKUserMessage & {
  uuid: string
  session_id: string
  isReplay: true
}

export type SDKAssistantMessage = {
  type: 'assistant'
  message: SDKAssistantAPIMessage
  parent_tool_use_id: string | null
  error?: SDKAssistantMessageError
  uuid: string
  session_id: string
}

export type SDKPartialAssistantMessage = {
  type: 'stream_event'
  event: unknown
  parent_tool_use_id: string | null
  uuid: string
  session_id: string
}

export type SDKResultSuccess = {
  type: 'result'
  subtype: 'success'
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
  result: string
  stop_reason: string | null
  total_cost_usd: number
  usage: NonNullableUsage
  modelUsage: Record<string, ModelUsage>
  permission_denials: SDKPermissionDenial[]
  structured_output?: unknown
  fast_mode_state?: FastModeState
  uuid: string
  session_id: string
}

export type SDKResultError = {
  type: 'result'
  subtype:
    | 'error_during_execution'
    | 'error_max_turns'
    | 'error_max_budget_usd'
    | 'error_max_structured_output_retries'
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
  stop_reason: string | null
  total_cost_usd: number
  usage: NonNullableUsage
  modelUsage: Record<string, ModelUsage>
  permission_denials: SDKPermissionDenial[]
  errors: string[]
  fast_mode_state?: FastModeState
  uuid: string
  session_id: string
}

export type SDKResultMessage = SDKResultSuccess | SDKResultError

export type SDKSystemInitMessage = {
  type: 'system'
  subtype: 'init'
  agents?: string[]
  apiKeySource: string
  betas?: string[]
  claude_code_version: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{
    name: string
    status: string
  }>
  model: string
  permissionMode: PermissionMode
  slash_commands: string[]
  output_style: string
  skills: string[]
  plugins: Array<{
    name: string
    path: string
    source?: string
  }>
  fast_mode_state?: FastModeState
  uuid: string
  session_id: string
}

export type SDKCompactBoundaryMessage = {
  type: 'system'
  subtype: 'compact_boundary'
  compact_metadata: {
    trigger: 'manual' | 'auto'
    pre_tokens: number
    preserved_segment?: {
      head_uuid: string
      anchor_uuid: string
      tail_uuid: string
    }
  }
  uuid: string
  session_id: string
}

export type SDKStatusMessage = {
  type: 'system'
  subtype: 'status'
  status: SDKStatus
  permissionMode?: PermissionMode
  uuid: string
  session_id: string
}

export type SDKAPIRetryMessage = {
  type: 'system'
  subtype: 'api_retry'
  attempt: number
  max_retries: number
  retry_delay_ms: number
  error_status: number | null
  error: SDKAssistantMessageError
  uuid: string
  session_id: string
}

export type SDKLocalCommandOutputMessage = {
  type: 'system'
  subtype: 'local_command_output'
  content: string
  uuid: string
  session_id: string
}

export type SDKHookStartedMessage = {
  type: 'system'
  subtype: 'hook_started'
  hook_id: string
  hook_name: string
  hook_event: string
  uuid: string
  session_id: string
}

export type SDKHookProgressMessage = {
  type: 'system'
  subtype: 'hook_progress'
  hook_id: string
  hook_name: string
  hook_event: string
  stdout: string
  stderr: string
  output: string
  uuid: string
  session_id: string
}

export type SDKHookResponseMessage = {
  type: 'system'
  subtype: 'hook_response'
  hook_id: string
  hook_name: string
  hook_event: string
  output: string
  stdout: string
  stderr: string
  exit_code?: number
  outcome: 'success' | 'error' | 'cancelled'
  uuid: string
  session_id: string
}

export type SDKFilesPersistedEvent = {
  type: 'system'
  subtype: 'files_persisted'
  files: Array<{
    filename: string
    file_id: string
  }>
  failed: Array<{
    filename: string
    error: string
  }>
  processed_at: string
  uuid: string
  session_id: string
}

export type SDKTaskNotificationMessage = {
  type: 'system'
  subtype: 'task_notification'
  task_id: string
  tool_use_id?: string
  status: 'completed' | 'failed' | 'stopped'
  output_file: string
  summary: string
  usage?: {
    total_tokens: number
    tool_uses: number
    duration_ms: number
  }
  uuid: string
  session_id: string
}

export type SDKTaskStartedMessage = {
  type: 'system'
  subtype: 'task_started'
  task_id: string
  tool_use_id?: string
  description: string
  task_type?: string
  workflow_name?: string
  prompt?: string
  uuid: string
  session_id: string
}

export type SDKTaskProgressMessage = {
  type: 'system'
  subtype: 'task_progress'
  task_id: string
  tool_use_id?: string
  description: string
  usage: {
    total_tokens: number
    tool_uses: number
    duration_ms: number
  }
  last_tool_name?: string
  summary?: string
  uuid: string
  session_id: string
}

export type SDKSessionStateChangedMessage = {
  type: 'system'
  subtype: 'session_state_changed'
  state: 'idle' | 'running' | 'requires_action'
  uuid: string
  session_id: string
}

export type SDKElicitationCompleteMessage = {
  type: 'system'
  subtype: 'elicitation_complete'
  mcp_server_name: string
  elicitation_id: string
  uuid: string
  session_id: string
}

export type SDKSystemMessage =
  | SDKSystemInitMessage
  | SDKCompactBoundaryMessage
  | SDKStatusMessage
  | SDKAPIRetryMessage
  | SDKLocalCommandOutputMessage
  | SDKHookStartedMessage
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKFilesPersistedEvent
  | SDKTaskNotificationMessage
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKSessionStateChangedMessage
  | SDKElicitationCompleteMessage

export type SDKToolProgressMessage = {
  type: 'tool_progress'
  tool_use_id: string
  tool_name: string
  parent_tool_use_id: string | null
  elapsed_time_seconds: number
  task_id?: string
  uuid: string
  session_id: string
}

export type SDKAuthStatusMessage = {
  type: 'auth_status'
  isAuthenticating: boolean
  output: string[]
  error?: string
  uuid: string
  session_id: string
}

export type SDKToolUseSummaryMessage = {
  type: 'tool_use_summary'
  summary: string
  preceding_tool_use_ids: string[]
  uuid: string
  session_id: string
}

export type SDKRateLimitEvent = {
  type: 'rate_limit_event'
  rate_limit_info: SDKRateLimitInfo
  uuid: string
  session_id: string
}

export type SDKPromptSuggestionMessage = {
  type: 'prompt_suggestion'
  suggestion: string
  uuid: string
  session_id: string
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKToolProgressMessage
  | SDKAuthStatusMessage
  | SDKToolUseSummaryMessage
  | SDKRateLimitEvent
  | SDKPromptSuggestionMessage

export type SDKSessionInfo = {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  createdAt?: number
}
