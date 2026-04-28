import type {
  McpServerConfigForProcessTransport,
  McpServerStatus,
  ModelInfo,
  RewindFilesResult,
  SDKMessage,
  SDKPartialAssistantMessage as CoreSDKPartialAssistantMessage,
  SDKSessionInfo,
  SDKStatus,
} from './coreTypes.js'
import type { PermissionMode } from '../../types/permissions.js'
import type { HookInput, PermissionUpdate } from './hookTypes.js'

type SDKCommandSummary = {
  name: string
  description?: string
  argumentHint?: string
}

type SDKAgentSummary = {
  name: string
  description?: string
  model?: string
}

type SDKPluginSummary = {
  name: string
  path?: string
  source?: string
}

export type SDKControlInitializeRequest = {
  subtype: 'initialize'
  sdkMcpServers?: string[]
  promptSuggestions?: boolean
  agentProgressSummaries?: boolean
  [key: string]: unknown
}

export type SDKControlInterruptRequest = {
  subtype: 'interrupt'
}

export type SDKControlEndSessionRequest = {
  subtype: 'end_session'
  reason?: string
}

export type SDKControlSetPermissionModeRequest = {
  subtype: 'set_permission_mode'
  mode: PermissionMode
  ultraplan?: boolean
}

export type SDKControlSetModelRequest = {
  subtype: 'set_model'
  model?: string
}

export type SDKControlSetMaxThinkingTokensRequest = {
  subtype: 'set_max_thinking_tokens'
  max_thinking_tokens: number | null
}

export type SDKControlMcpStatusRequest = {
  subtype: 'mcp_status'
}

export type SDKControlGetContextUsageRequest = {
  subtype: 'get_context_usage'
}

export type SDKControlPermissionRequest = {
  subtype: 'can_use_tool'
  tool_name: string
  input: Record<string, unknown>
  permission_suggestions?: PermissionUpdate[]
  blocked_path?: string
  decision_reason?: string
  title?: string
  display_name?: string
  tool_use_id: string
  agent_id?: string
  description?: string
}

export type SDKControlHookCallbackRequest = {
  subtype: 'hook_callback'
  callback_id: string
  input: HookInput
  tool_use_id?: string
}

export type SDKControlMcpMessageRequest = {
  subtype: 'mcp_message'
  server_name: string
  message: unknown
}

export type SDKControlRewindFilesRequest = {
  subtype: 'rewind_files'
  user_message_id: string
  dry_run?: boolean
}

export type SDKControlCancelAsyncMessageRequest = {
  subtype: 'cancel_async_message'
  message_uuid: string
}

export type SDKControlSeedReadStateRequest = {
  subtype: 'seed_read_state'
  path: string
  mtime: number
}

export type SDKControlMcpSetServersRequest = {
  subtype: 'mcp_set_servers'
  servers: Record<string, McpServerConfigForProcessTransport>
}

export type SDKControlReloadPluginsRequest = {
  subtype: 'reload_plugins'
}

export type SDKControlMcpReconnectRequest = {
  subtype: 'mcp_reconnect'
  serverName: string
}

export type SDKControlMcpToggleRequest = {
  subtype: 'mcp_toggle'
  serverName: string
  enabled: boolean
}

export type SDKControlChannelEnableRequest = {
  subtype: 'channel_enable'
  serverName: string
}

export type SDKControlMcpAuthenticateRequest = {
  subtype: 'mcp_authenticate'
  serverName: string
}

export type SDKControlMcpOAuthCallbackUrlRequest = {
  subtype: 'mcp_oauth_callback_url'
  serverName: string
  callbackUrl: string
}

export type SDKControlClaudeAuthenticateRequest = {
  subtype: 'claude_authenticate'
  loginWithClaudeAi?: boolean
}

export type SDKControlClaudeOAuthCallbackRequest = {
  subtype: 'claude_oauth_callback'
  authorizationCode: string
  state: string
}

export type SDKControlClaudeOAuthWaitForCompletionRequest = {
  subtype: 'claude_oauth_wait_for_completion'
}

export type SDKControlMcpClearAuthRequest = {
  subtype: 'mcp_clear_auth'
  serverName: string
}

export type SDKControlApplyFlagSettingsRequest = {
  subtype: 'apply_flag_settings'
  settings: Record<string, unknown>
}

export type SDKControlGetSettingsRequest = {
  subtype: 'get_settings'
}

export type SDKControlStopTaskRequest = {
  subtype: 'stop_task'
  task_id: string
}

export type SDKControlElicitationRequest = {
  subtype: 'elicitation'
  mcp_server_name: string
  message: string
  mode?: 'form' | 'url'
  url?: string
  elicitation_id?: string
  requested_schema?: Record<string, unknown>
}

export type SDKControlGenerateSessionTitleRequest = {
  subtype: 'generate_session_title'
  description: string
  persist?: boolean
}

export type SDKControlSideQuestionRequest = {
  subtype: 'side_question'
  question: string
}

export type SDKControlRemoteControlRequest = {
  subtype: 'remote_control'
  enabled: boolean
}

export type SDKControlSetProactiveRequest = {
  subtype: 'set_proactive'
  enabled: boolean
}

export type SDKControlRequestInner =
  | SDKControlInitializeRequest
  | SDKControlInterruptRequest
  | SDKControlEndSessionRequest
  | SDKControlSetPermissionModeRequest
  | SDKControlSetModelRequest
  | SDKControlSetMaxThinkingTokensRequest
  | SDKControlMcpStatusRequest
  | SDKControlGetContextUsageRequest
  | SDKControlPermissionRequest
  | SDKControlHookCallbackRequest
  | SDKControlMcpMessageRequest
  | SDKControlRewindFilesRequest
  | SDKControlCancelAsyncMessageRequest
  | SDKControlSeedReadStateRequest
  | SDKControlMcpSetServersRequest
  | SDKControlReloadPluginsRequest
  | SDKControlMcpReconnectRequest
  | SDKControlMcpToggleRequest
  | SDKControlChannelEnableRequest
  | SDKControlMcpAuthenticateRequest
  | SDKControlMcpOAuthCallbackUrlRequest
  | SDKControlClaudeAuthenticateRequest
  | SDKControlClaudeOAuthCallbackRequest
  | SDKControlClaudeOAuthWaitForCompletionRequest
  | SDKControlMcpClearAuthRequest
  | SDKControlApplyFlagSettingsRequest
  | SDKControlGetSettingsRequest
  | SDKControlStopTaskRequest
  | SDKControlElicitationRequest
  | SDKControlGenerateSessionTitleRequest
  | SDKControlSideQuestionRequest
  | SDKControlRemoteControlRequest
  | SDKControlSetProactiveRequest

export type SDKControlRequest = {
  type: 'control_request'
  request_id: string
  request: SDKControlRequestInner
}

export type SDKControlInitializeResponse = {
  commands?: SDKCommandSummary[]
  agents?: SDKAgentSummary[]
  models?: ModelInfo[]
  mcpServers?: McpServerStatus[]
  account?: Record<string, unknown>
  session?: SDKSessionInfo
  status?: SDKStatus
  output_style?: string
  available_output_styles?: string[]
  pid?: number
  [key: string]: unknown
}

export type SDKControlMcpSetServersResponse = {
  added?: string[]
  removed?: string[]
  errors?: Record<string, string>
  [key: string]: unknown
}

export type SDKControlReloadPluginsResponse = {
  commands?: SDKCommandSummary[]
  agents?: SDKAgentSummary[]
  plugins?: SDKPluginSummary[]
  mcpServers?: McpServerStatus[]
  error_count?: number
  [key: string]: unknown
}

export type SDKControlRewindFilesResponse = RewindFilesResult & {
  [key: string]: unknown
}

export type SDKControlSuccessResponse = {
  subtype: 'success'
  request_id: string
  response?: Record<string, unknown>
}

export type SDKControlErrorResponse = {
  subtype: 'error'
  request_id: string
  error: string
  pending_permission_requests?: SDKControlRequest[]
}

export type SDKControlResponse = {
  type: 'control_response'
  request_id?: string
  response: SDKControlSuccessResponse | SDKControlErrorResponse
}

export type SDKControlCancelRequest = {
  type: 'control_cancel_request'
  request_id: string
}

export type SDKKeepAliveMessage = {
  type: 'keep_alive'
}

export type SDKUpdateEnvironmentVariablesMessage = {
  type: 'update_environment_variables'
  variables: Record<string, string>
}

export type SDKStreamlinedTextMessage = {
  type: 'streamlined_text'
  [key: string]: unknown
}

export type SDKStreamlinedToolUseSummaryMessage = {
  type: 'streamlined_tool_use_summary'
  [key: string]: unknown
}

export type SDKPostTurnSummaryMessage = {
  type: 'system'
  subtype: 'post_turn_summary'
  [key: string]: unknown
}

export type StdinMessage =
  | SDKMessage
  | SDKControlResponse
  | SDKControlRequest
  | SDKKeepAliveMessage
  | SDKUpdateEnvironmentVariablesMessage

export type SDKPartialAssistantMessage = CoreSDKPartialAssistantMessage

export type StdoutMessage =
  | SDKMessage
  | SDKControlRequest
  | SDKControlResponse
  | SDKControlCancelRequest
  | SDKKeepAliveMessage
  | SDKStreamlinedTextMessage
  | SDKStreamlinedToolUseSummaryMessage
  | SDKPostTurnSummaryMessage
