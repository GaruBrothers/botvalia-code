import type {
  PermissionBehavior,
  PermissionUpdate,
} from '../../types/permissions.js'
import type {
  ExitReason,
  HookEvent,
  SDKAssistantMessageError,
} from './coreTypes.js'

export type { PermissionUpdate }

export type BaseHookInput = {
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode?: string
  agent_id?: string
  agent_type?: string
}

export type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PreToolUse'
  tool_name: string
  tool_input: unknown
  tool_use_id: string
}

export type PermissionRequestHookInput = BaseHookInput & {
  hook_event_name: 'PermissionRequest'
  tool_name: string
  tool_input: unknown
  permission_suggestions?: PermissionUpdate[]
}

export type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUse'
  tool_name: string
  tool_input: unknown
  tool_response: unknown
  tool_use_id: string
}

export type PostToolUseFailureHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUseFailure'
  tool_name: string
  tool_input: unknown
  tool_use_id: string
  error: string
  is_interrupt?: boolean
}

export type PermissionDeniedHookInput = BaseHookInput & {
  hook_event_name: 'PermissionDenied'
  tool_name: string
  tool_input: unknown
  tool_use_id: string
  reason: string
}

export type NotificationHookInput = BaseHookInput & {
  hook_event_name: 'Notification'
  message: string
  title?: string
  notification_type: string
}

export type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: 'UserPromptSubmit'
  prompt: string
}

export type SessionStartHookInput = BaseHookInput & {
  hook_event_name: 'SessionStart'
  source: 'startup' | 'resume' | 'clear' | 'compact'
  agent_type?: string
  model?: string
}

export type SetupHookInput = BaseHookInput & {
  hook_event_name: 'Setup'
  trigger: 'init' | 'maintenance'
}

export type StopHookInput = BaseHookInput & {
  hook_event_name: 'Stop'
  stop_hook_active: boolean
  last_assistant_message?: string
}

export type StopFailureHookInput = BaseHookInput & {
  hook_event_name: 'StopFailure'
  error: SDKAssistantMessageError
  error_details?: string
  last_assistant_message?: string
}

export type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStart'
  agent_id: string
  agent_type: string
}

export type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStop'
  stop_hook_active: boolean
  agent_id: string
  agent_transcript_path: string
  agent_type: string
  last_assistant_message?: string
}

export type PreCompactHookInput = BaseHookInput & {
  hook_event_name: 'PreCompact'
  trigger: 'manual' | 'auto'
  custom_instructions: string | null
}

export type PostCompactHookInput = BaseHookInput & {
  hook_event_name: 'PostCompact'
  trigger: 'manual' | 'auto'
  compact_summary: string
}

export type TeammateIdleHookInput = BaseHookInput & {
  hook_event_name: 'TeammateIdle'
  teammate_name: string
  team_name: string
}

export type TaskCreatedHookInput = BaseHookInput & {
  hook_event_name: 'TaskCreated'
  task_id: string
  task_subject: string
  task_description?: string
  teammate_name?: string
  team_name?: string
}

export type TaskCompletedHookInput = BaseHookInput & {
  hook_event_name: 'TaskCompleted'
  task_id: string
  task_subject: string
  task_description?: string
  teammate_name?: string
  team_name?: string
}

export type ElicitationHookInput = BaseHookInput & {
  hook_event_name: 'Elicitation'
  mcp_server_name: string
  message: string
  mode?: 'form' | 'url'
  url?: string
  elicitation_id?: string
  requested_schema?: Record<string, unknown>
}

export type ElicitationResultHookInput = BaseHookInput & {
  hook_event_name: 'ElicitationResult'
  mcp_server_name: string
  elicitation_id?: string
  mode?: 'form' | 'url'
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

export type ConfigChangeSource =
  | 'user_settings'
  | 'project_settings'
  | 'local_settings'
  | 'policy_settings'
  | 'skills'

export type ConfigChangeHookInput = BaseHookInput & {
  hook_event_name: 'ConfigChange'
  source: ConfigChangeSource
  file_path?: string
}

export type InstructionsLoadReason =
  | 'session_start'
  | 'nested_traversal'
  | 'path_glob_match'
  | 'include'
  | 'compact'

export type InstructionsMemoryType = 'User' | 'Project' | 'Local' | 'Managed'

export type InstructionsLoadedHookInput = BaseHookInput & {
  hook_event_name: 'InstructionsLoaded'
  file_path: string
  memory_type: InstructionsMemoryType
  load_reason: InstructionsLoadReason
  globs?: string[]
  trigger_file_path?: string
  parent_file_path?: string
}

export type WorktreeCreateHookInput = BaseHookInput & {
  hook_event_name: 'WorktreeCreate'
  name: string
}

export type WorktreeRemoveHookInput = BaseHookInput & {
  hook_event_name: 'WorktreeRemove'
  worktree_path: string
}

export type CwdChangedHookInput = BaseHookInput & {
  hook_event_name: 'CwdChanged'
  old_cwd: string
  new_cwd: string
}

export type FileChangedHookInput = BaseHookInput & {
  hook_event_name: 'FileChanged'
  file_path: string
  event: 'change' | 'add' | 'unlink'
}

export type SessionEndHookInput = BaseHookInput & {
  hook_event_name: 'SessionEnd'
  reason: ExitReason
}

export type HookInput =
  | PreToolUseHookInput
  | PermissionRequestHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | PermissionDeniedHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SetupHookInput
  | StopHookInput
  | StopFailureHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PostCompactHookInput
  | TeammateIdleHookInput
  | TaskCreatedHookInput
  | TaskCompletedHookInput
  | ElicitationHookInput
  | ElicitationResultHookInput
  | ConfigChangeHookInput
  | InstructionsLoadedHookInput
  | WorktreeCreateHookInput
  | WorktreeRemoveHookInput
  | CwdChangedHookInput
  | FileChangedHookInput
  | SessionEndHookInput

export type PreToolUseHookSpecificOutput = {
  hookEventName: 'PreToolUse'
  permissionDecision?: PermissionBehavior
  permissionDecisionReason?: string
  updatedInput?: Record<string, unknown>
  additionalContext?: string
}

export type UserPromptSubmitHookSpecificOutput = {
  hookEventName: 'UserPromptSubmit'
  additionalContext?: string
}

export type SessionStartHookSpecificOutput = {
  hookEventName: 'SessionStart'
  additionalContext?: string
  initialUserMessage?: string
  watchPaths?: string[]
}

export type SetupHookSpecificOutput = {
  hookEventName: 'Setup'
  additionalContext?: string
}

export type SubagentStartHookSpecificOutput = {
  hookEventName: 'SubagentStart'
  additionalContext?: string
}

export type PostToolUseHookSpecificOutput = {
  hookEventName: 'PostToolUse'
  additionalContext?: string
  updatedMCPToolOutput?: unknown
}

export type PostToolUseFailureHookSpecificOutput = {
  hookEventName: 'PostToolUseFailure'
  additionalContext?: string
}

export type PermissionDeniedHookSpecificOutput = {
  hookEventName: 'PermissionDenied'
  retry?: boolean
}

export type NotificationHookSpecificOutput = {
  hookEventName: 'Notification'
  additionalContext?: string
}

export type PermissionRequestResult =
  | {
      behavior: 'allow'
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
    }
  | {
      behavior: 'deny'
      message?: string
      interrupt?: boolean
    }

export type PermissionRequestHookSpecificOutput = {
  hookEventName: 'PermissionRequest'
  decision: PermissionRequestResult
}

export type ElicitationHookSpecificOutput = {
  hookEventName: 'Elicitation'
  action?: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

export type ElicitationResultHookSpecificOutput = {
  hookEventName: 'ElicitationResult'
  action?: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

export type CwdChangedHookSpecificOutput = {
  hookEventName: 'CwdChanged'
  watchPaths?: string[]
}

export type FileChangedHookSpecificOutput = {
  hookEventName: 'FileChanged'
  watchPaths?: string[]
}

export type WorktreeCreateHookSpecificOutput = {
  hookEventName: 'WorktreeCreate'
  worktreePath: string
}

export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput
  | SessionStartHookSpecificOutput
  | SetupHookSpecificOutput
  | SubagentStartHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | PostToolUseFailureHookSpecificOutput
  | PermissionDeniedHookSpecificOutput
  | NotificationHookSpecificOutput
  | PermissionRequestHookSpecificOutput
  | ElicitationHookSpecificOutput
  | ElicitationResultHookSpecificOutput
  | CwdChangedHookSpecificOutput
  | FileChangedHookSpecificOutput
  | WorktreeCreateHookSpecificOutput

export type SyncHookJSONOutput = {
  continue?: boolean
  suppressOutput?: boolean
  stopReason?: string
  decision?: 'approve' | 'block'
  reason?: string
  systemMessage?: string
  hookSpecificOutput?: HookSpecificOutput
}

export type AsyncHookJSONOutput = {
  async: true
  asyncTimeout?: number
}

export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput

export type { HookEvent }
