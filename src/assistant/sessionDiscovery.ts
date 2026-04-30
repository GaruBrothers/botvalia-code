export type AssistantSession = {
  id: string
  sessionId?: string
  title?: string
  cwd?: string
  updatedAt?: string | number
  [key: string]: unknown
}

export async function discoverAssistantSessions(): Promise<AssistantSession[]> {
  return []
}
