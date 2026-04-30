export type ServerConfig = {
  port: number
  host: string
  authToken: string
  unix?: string
  workspace?: string
  idleTimeoutMs: number
  maxSessions: number
}

export type RunningServer = {
  port?: number
  stop: (force?: boolean) => void
}

export function startServer(
  config: ServerConfig,
  ..._args: unknown[]
): RunningServer {
  return {
    port: config.port,
    stop() {},
  }
}
