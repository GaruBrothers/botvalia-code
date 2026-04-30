export type LiveSessionInfo = {
  sessionId?: string
  kind?: 'interactive' | 'background' | 'daemon' | string
}

export async function createUdsClient() {
  return null
}

export async function listAllLiveSessions(): Promise<LiveSessionInfo[]> {
  return []
}
