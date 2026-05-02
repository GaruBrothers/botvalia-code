import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { access } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { createServer } from 'net'
import { resolve } from 'path'
import treeKill from 'tree-kill'
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

const INSPECTOR_UI_DIRECTORY = resolve(process.cwd(), 'BotValia-CodeUI')
const INSPECTOR_READY_TIMEOUT_MS = 90_000
const INSPECTOR_READY_POLL_MS = 500
const MAX_LOG_LINES = 80

type InspectorProcessState = {
  child: ChildProcess
  logs: string[]
  stopRequested: boolean
}

let activeRuntimeInspectorServer: RunningRuntimeInspectorServer | undefined
let runtimeInspectorServerStartPromise:
  | Promise<RunningRuntimeInspectorServer>
  | undefined
let lastRuntimeInspectorServerError: Error | undefined

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error))
}

function appendLog(logs: string[], chunk: Buffer | string | null | undefined): void {
  if (!chunk) {
    return
  }

  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return
  }

  logs.push(...lines)
  if (logs.length > MAX_LOG_LINES) {
    logs.splice(0, logs.length - MAX_LOG_LINES)
  }
}

function formatFailureLogs(logs: string[]): string {
  if (logs.length === 0) {
    return ''
  }

  return `\n\nLogs recientes de BotValia-CodeUI:\n${logs.join('\n')}`
}

async function ensureUiDirectoryReady(): Promise<void> {
  await access(INSPECTOR_UI_DIRECTORY, fsConstants.R_OK)
  await access(
    resolve(INSPECTOR_UI_DIRECTORY, 'package.json'),
    fsConstants.R_OK,
  )
  await access(
    resolve(INSPECTOR_UI_DIRECTORY, 'node_modules'),
    fsConstants.R_OK,
  )
}

async function reservePort(host: string): Promise<number> {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      const port =
        address && typeof address === 'object' ? address.port : undefined

      server.close(closeError => {
        if (closeError) {
          reject(closeError)
          return
        }

        if (!port) {
          reject(new Error('No pude reservar un puerto para BotValia-CodeUI.'))
          return
        }

        resolvePort(port)
      })
    })
  })
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolveDelay => setTimeout(resolveDelay, ms))
}

async function waitForInspectorReady(
  url: string,
  processState: InspectorProcessState,
): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < INSPECTOR_READY_TIMEOUT_MS) {
    if (processState.child.exitCode !== null) {
      throw new Error(
        `BotValia-CodeUI terminó antes de quedar lista.${formatFailureLogs(processState.logs)}`,
      )
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2_500),
      })

      if (response.ok || response.status < 500) {
        return
      }
    } catch {
      // keep polling until the app is reachable or the timeout expires
    }

    await delay(INSPECTOR_READY_POLL_MS)
  }

  throw new Error(
    `BotValia-CodeUI no quedó disponible en ${url} dentro del tiempo esperado.${formatFailureLogs(
      processState.logs,
    )}`,
  )
}

async function stopInspectorProcess(
  processState: InspectorProcessState,
): Promise<void> {
  processState.stopRequested = true

  const { child } = processState
  if (!child.pid || child.exitCode !== null) {
    return
  }

  await new Promise<void>(resolveStop => {
    treeKill(child.pid!, 'SIGTERM', () => resolveStop())
  })
}

async function startRuntimeInspectorServer(
  config: RuntimeInspectorServerConfig = {},
): Promise<RunningRuntimeInspectorServer> {
  await ensureUiDirectoryReady()

  const host = config.host ?? '127.0.0.1'
  const port = config.port ?? (await reservePort(host))
  const url = `http://${host}:${port}`
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const logs: string[] = []
  const child = spawn(
    npmCommand,
    ['run', 'dev', '--', '--hostname', host, '--port', String(port)],
    {
      cwd: INSPECTOR_UI_DIRECTORY,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        BROWSER: 'none',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )

  const processState: InspectorProcessState = {
    child,
    logs,
    stopRequested: false,
  }

  child.stdout?.on('data', chunk => appendLog(logs, chunk))
  child.stderr?.on('data', chunk => appendLog(logs, chunk))
  child.on('error', error => {
    appendLog(logs, error.message)
  })

  child.on('exit', (code, signal) => {
    if (processState.stopRequested) {
      return
    }

    const message = `BotValia-CodeUI salió inesperadamente (code=${code ?? 'null'}, signal=${signal ?? 'none'}).${formatFailureLogs(logs)}`
    lastRuntimeInspectorServerError = new Error(message)

    if (activeRuntimeInspectorServer?.url === url) {
      activeRuntimeInspectorServer = undefined
    }
  })

  await waitForInspectorReady(url, processState)

  const runningServer: RunningRuntimeInspectorServer = {
    host,
    port,
    url,
    stop: async () => {
      await stopInspectorProcess(processState)
      if (activeRuntimeInspectorServer?.url === url) {
        activeRuntimeInspectorServer = undefined
      }
      lastRuntimeInspectorServerError = undefined
    },
  }

  return runningServer
}

export function getRuntimeInspectorServerStatus(): RuntimeInspectorStatus {
  if (activeRuntimeInspectorServer) {
    return {
      status: 'running',
      server: activeRuntimeInspectorServer,
    }
  }

  if (runtimeInspectorServerStartPromise) {
    return { status: 'starting' }
  }

  if (lastRuntimeInspectorServerError) {
    return {
      status: 'failed',
      error: lastRuntimeInspectorServerError,
    }
  }

  return { status: 'stopped' }
}

export async function ensureRuntimeInspectorServer(
  config: RuntimeInspectorServerConfig = {},
): Promise<RunningRuntimeInspectorServer> {
  if (activeRuntimeInspectorServer) {
    return activeRuntimeInspectorServer
  }

  if (runtimeInspectorServerStartPromise) {
    return runtimeInspectorServerStartPromise
  }

  lastRuntimeInspectorServerError = undefined
  runtimeInspectorServerStartPromise = startRuntimeInspectorServer(config)
    .then(server => {
      activeRuntimeInspectorServer = server
      return server
    })
    .catch(error => {
      lastRuntimeInspectorServerError = normalizeError(error)
      throw lastRuntimeInspectorServerError
    })
    .finally(() => {
      runtimeInspectorServerStartPromise = undefined
    })

  return runtimeInspectorServerStartPromise
}

export async function stopRuntimeInspectorServer(): Promise<boolean> {
  const server =
    activeRuntimeInspectorServer ||
    (runtimeInspectorServerStartPromise
      ? await runtimeInspectorServerStartPromise
      : undefined)

  if (!server) {
    lastRuntimeInspectorServerError = undefined
    return false
  }

  await server.stop()
  return true
}
