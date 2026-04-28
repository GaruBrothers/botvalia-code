import type {
  McpServerConfigForProcessTransport,
  McpServerStatus,
  ModelInfo,
  RewindFilesResult,
  SDKMessage,
  SDKSessionInfo,
  SDKStatus,
} from './coreTypes.js'
import type { PermissionMode } from '../../types/permissions.js'

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

export type SDKControlCancelRequest = {
  subtype: 'cancel'
  [key: string]: unknown
}

export type SDKControlPermissionRequest = {
  subtype: 'permission'
  [key: string]: unknown
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
  | SDKControlCancelRequest
  | SDKControlPermissionRequest

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
}

export type SDKControlResponse = {
  type: 'control_response'
  request_id?: string
  response:
    | SDKControlSuccessResponse
    | SDKControlErrorResponse
    | Record<string, unknown>
}

export type SDKPartialAssistantMessage = {
  type: 'assistant'
  [key: string]: unknown
}

export type StdinMessage =
  | SDKMessage
  | SDKControlResponse
  | SDKControlRequest

export type StdoutMessage =
  | SDKMessage
  | SDKControlResponse
  | {
      type:
        | 'stream_event'
        | 'keep_alive'
        | 'streamlined_text'
        | 'streamlined_tool_use_summary'
      [key: string]: unknown
    }
