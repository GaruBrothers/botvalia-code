import { errorMessage } from '../utils/errors.js'
import {
  startRuntimeWebSocketServer,
  type RunningRuntimeWebSocketServer,
  type RuntimeWebSocketServerConfig,
} from './runtimeWsServer.js'

export type RuntimeServerStatus =
  | { status: 'stopped' }
  | { status: 'starting' }
  | { status: 'running'; server: RunningRuntimeWebSocketServer }
  | { status: 'failed'; error: Error }

let activeRuntimeServer: RunningRuntimeWebSocketServer | undefined
let runtimeServerStartPromise:
  | Promise<RunningRuntimeWebSocketServer>
  | undefined
let lastRuntimeServerError: Error | undefined

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error))
}

export function getRuntimeServerStatus(): RuntimeServerStatus {
  if (activeRuntimeServer) {
    return {
      status: 'running',
      server: activeRuntimeServer,
    }
  }

  if (runtimeServerStartPromise) {
    return { status: 'starting' }
  }

  if (lastRuntimeServerError) {
    return {
      status: 'failed',
      error: lastRuntimeServerError,
    }
  }

  return { status: 'stopped' }
}

export async function ensureRuntimeServer(
  config: RuntimeWebSocketServerConfig = {},
): Promise<RunningRuntimeWebSocketServer> {
  if (activeRuntimeServer) {
    return activeRuntimeServer
  }

  if (runtimeServerStartPromise) {
    return runtimeServerStartPromise
  }

  lastRuntimeServerError = undefined
  runtimeServerStartPromise = startRuntimeWebSocketServer(config)
    .then(server => {
      activeRuntimeServer = server
      return server
    })
    .catch(error => {
      lastRuntimeServerError = normalizeError(error)
      throw lastRuntimeServerError
    })
    .finally(() => {
      runtimeServerStartPromise = undefined
    })

  return runtimeServerStartPromise
}

export async function stopRuntimeServer(): Promise<boolean> {
  const server =
    activeRuntimeServer ||
    (runtimeServerStartPromise ? await runtimeServerStartPromise : undefined)

  if (!server) {
    return false
  }

  await server.stop()

  if (activeRuntimeServer === server) {
    activeRuntimeServer = undefined
  }
  lastRuntimeServerError = undefined

  return true
}
