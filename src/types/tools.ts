import type {
  AssistantMessage,
  NormalizedUserMessage,
} from './message.js'

type ProgressTranscriptMessage = AssistantMessage | NormalizedUserMessage

export type ToolProgressData = {
  type: string
  kind?: string
  [key: string]: unknown
}

export type ShellProgress = ToolProgressData & {
  type: 'bash_progress' | 'powershell_progress'
  output?: string
  fullOutput?: string
  elapsedTimeSeconds: number
  totalLines?: number
  totalBytes?: number
  taskId: string
  timeoutMs?: number
}

export type BashProgress = ShellProgress & {
  type: 'bash_progress'
}

export type PowerShellProgress = ShellProgress & {
  type: 'powershell_progress'
}

export type MCPProgress = ToolProgressData & {
  type: 'mcp_progress'
  status?: string
  serverName?: string
  toolName?: string
  elapsedTimeMs?: number
  progress?: number
  total?: number
  progressMessage?: string
}

export type SkillToolProgress = ToolProgressData & {
  type: 'skill_progress'
  agentId?: string
  prompt?: string
  message: ProgressTranscriptMessage
}

export type TaskOutputProgress = ToolProgressData
export type WebSearchProgress = ToolProgressData
export type AgentToolProgress = ToolProgressData & {
  type: 'agent_progress'
  agentId?: string
  prompt?: string
  message: ProgressTranscriptMessage
}
export type REPLToolProgress = ToolProgressData
export type SdkWorkflowProgress = ToolProgressData
