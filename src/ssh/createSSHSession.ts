export type SSHSession = {
  remoteCwd: string
  createManager: (...args: unknown[]) => unknown
}

export class SSHSessionError extends Error {}

function createBaseSession(cwd = process.cwd()): SSHSession {
  return {
    remoteCwd: cwd,
    createManager: () => ({}),
  }
}

export async function createSSHSession(
  options?: { cwd?: string },
): Promise<SSHSession> {
  return createBaseSession(options?.cwd)
}

export function createLocalSSHSession(options?: { cwd?: string }): SSHSession {
  return createBaseSession(options?.cwd)
}
