export async function sendUdsMessage(): Promise<void> {}

export async function startUdsMessaging(
  _socketPath?: string,
  _options?: { isExplicit: boolean },
): Promise<void> {}

export function getDefaultUdsSocketPath(): string {
  return ''
}
