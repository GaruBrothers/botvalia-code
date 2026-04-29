export type ScopedLspServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string | undefined>
  workspaceFolder?: string
  extensionToLanguage?: Record<string, string>
  initializationOptions?: Record<string, unknown>
  startupTimeout?: number
  maxRestarts?: number
  restartOnCrash?: boolean
  shutdownTimeout?: number
}

export type LspServerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'
