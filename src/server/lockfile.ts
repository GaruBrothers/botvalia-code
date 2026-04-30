export type RunningServerLock = {
  pid: number
  port?: number
  host?: string
  httpUrl: string
  startedAt?: number
}

export async function writeServerLock(
  ..._args: [RunningServerLock]
): Promise<void> {}

export async function removeServerLock(): Promise<void> {}

export async function probeRunningServer(): Promise<RunningServerLock | null> {
  return null
}
