import { errorMessage } from '../utils/errors.js'

export type RuntimeInspectorServerConfig = {
  host?: string
  port?: number
}

export type RunningRuntimeInspectorServer = {
  host: string
  port: number
  url: string
  stop: () => Promise<void>
}

export type RuntimeInspectorStatus =
  | { status: 'stopped' }
  | { status: 'starting' }
  | { status: 'running'; server: RunningRuntimeInspectorServer }
  | { status: 'failed'; error: Error }

const RUNTIME_UI_REMOVED_MESSAGE =
  'La UI web del runtime fue retirada de este repo.'

let lastInspectorServerError: Error | undefined

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error))
}

function createRemovedUiError(): Error {
  return new Error(RUNTIME_UI_REMOVED_MESSAGE)
}

export function getRuntimeInspectorServerStatus(): RuntimeInspectorStatus {
  if (lastInspectorServerError) {
    return {
      status: 'failed',
      error: lastInspectorServerError,
    }
  }

  return { status: 'stopped' }
}

export async function ensureRuntimeInspectorServer(
  _config: RuntimeInspectorServerConfig = {},
): Promise<RunningRuntimeInspectorServer> {
  try {
    throw createRemovedUiError()
  } catch (error) {
    lastInspectorServerError = normalizeError(error)
    throw lastInspectorServerError
  }
}

export async function stopRuntimeInspectorServer(): Promise<boolean> {
  lastInspectorServerError = undefined
  return false
}
