import type { PermissionMode } from '../types/permissions.js'
import { SSHSessionManager, type SSHSessionManagerCallbacks } from './SSHSessionManager.js'

const SSH_UNSUPPORTED_MESSAGE =
  'SSH remote mode is not available in this reconstructed BotValia Code build.'

export type SSHSessionProcess = {
  exitCode: number | null
  signalCode: string | null
  pid?: number
}

export type SSHSessionProxy = {
  stop: () => void
}

export type SSHSession = {
  remoteCwd: string
  proc: SSHSessionProcess
  proxy: SSHSessionProxy
  createManager: (callbacks: SSHSessionManagerCallbacks) => SSHSessionManager
  getStderrTail: () => string
}

export type CreateSSHSessionOptions = {
  host?: string
  cwd?: string
  localVersion?: string
  permissionMode?: PermissionMode | string
  dangerouslySkipPermissions?: boolean
  extraCliArgs?: string[]
}

export type CreateSSHSessionProgressCallbacks = {
  onProgress?: (message: string) => void
}

export class SSHSessionError extends Error {}

function createUnsupportedSession(
  cwd = process.cwd(),
  stderrTail = SSH_UNSUPPORTED_MESSAGE,
): SSHSession {
  const proc: SSHSessionProcess = {
    exitCode: 1,
    signalCode: null,
  }

  return {
    remoteCwd: cwd,
    proc,
    proxy: {
      stop() {},
    },
    createManager: callbacks =>
      new SSHSessionManager(callbacks, {
        unsupportedMessage: stderrTail,
      }),
    getStderrTail: () => stderrTail,
  }
}

export async function createSSHSession(
  options?: CreateSSHSessionOptions,
  progress?: CreateSSHSessionProgressCallbacks,
): Promise<SSHSession> {
  progress?.onProgress?.('SSH remote compatibility shim active')
  return createUnsupportedSession(options?.cwd)
}

export function createLocalSSHSession(
  options?: CreateSSHSessionOptions,
): SSHSession {
  return createUnsupportedSession(options?.cwd)
}
