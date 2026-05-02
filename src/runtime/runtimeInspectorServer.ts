import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { access, cp, readdir, rm, stat } from 'fs/promises'
import { constants as fsConstants } from 'fs'
import { createServer } from 'net'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INSPECTOR_UI_DIRECTORY = resolve(REPO_ROOT, 'BotValia-CodeUI')
const INSPECTOR_RUNTIME_DIST_DIR = '.runtime-next'
const INSPECTOR_READY_TIMEOUT_MS = 90_000
const INSPECTOR_READY_POLL_MS = 500
const MAX_LOG_LINES = 80
const INSPECTOR_SOURCE_PATHS = [
  'app',
  'components',
  'hooks',
  'lib',
  'public',
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'next.config.mjs',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
] as const

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

function preferRuntimeUiSource(): boolean {
  const rawValue = process.env.BOTVALIA_RUNTIME_UI_PREFER_SOURCE?.trim().toLowerCase()
  return rawValue === '1' || rawValue === 'true' || rawValue === 'yes' || rawValue === 'on'
}

function getInspectorBuildDirectory(): string {
  return resolve(INSPECTOR_UI_DIRECTORY, INSPECTOR_RUNTIME_DIST_DIR)
}

function getInspectorEnvironment(
  additionalEnvironment: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...additionalEnvironment,
    NEXT_TELEMETRY_DISABLED: '1',
    BROWSER: 'none',
    BOTVALIA_NEXT_DIST_DIR: INSPECTOR_RUNTIME_DIST_DIR,
  }
}

async function getNewestModificationTime(targetPath: string): Promise<number> {
  try {
    const targetStats = await stat(targetPath)
    let newestMtime = targetStats.mtimeMs

    if (!targetStats.isDirectory()) {
      return newestMtime
    }

    const entries = await readdir(targetPath, { withFileTypes: true })
    for (const entry of entries) {
      newestMtime = Math.max(
        newestMtime,
        await getNewestModificationTime(resolve(targetPath, entry.name)),
      )
    }

    return newestMtime
  } catch {
    return 0
  }
}

async function isStandaloneBuildFresh(): Promise<boolean> {
  const buildMarkerPath = resolve(getInspectorBuildDirectory(), 'BUILD_ID')
  const buildTimestamp = await getNewestModificationTime(buildMarkerPath)
  if (buildTimestamp === 0) {
    return false
  }

  let newestSourceTimestamp = 0
  for (const sourcePath of INSPECTOR_SOURCE_PATHS) {
    newestSourceTimestamp = Math.max(
      newestSourceTimestamp,
      await getNewestModificationTime(resolve(INSPECTOR_UI_DIRECTORY, sourcePath)),
    )
  }

  return buildTimestamp >= newestSourceTimestamp
}

async function findStandaloneServerPath(): Promise<string | undefined> {
  if (preferRuntimeUiSource() && !(await isStandaloneBuildFresh())) {
    return undefined
  }

  const standaloneDirectory = resolve(getInspectorBuildDirectory(), 'standalone')
  const directServerPath = resolve(standaloneDirectory, 'server.js')

  try {
    await access(directServerPath, fsConstants.R_OK)
    return directServerPath
  } catch {
    // continue and look for the nested standalone output path
  }

  try {
    const entries = await readdir(standaloneDirectory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const nestedServerPath = resolve(standaloneDirectory, entry.name, 'server.js')
      try {
        await access(nestedServerPath, fsConstants.R_OK)
        return nestedServerPath
      } catch {
        // try the next candidate
      }
    }
  } catch {
    // standalone output is optional; the caller will fall back to next dev
  }

  return undefined
}

async function copyIfPresent(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await access(sourcePath, fsConstants.R_OK)
  } catch {
    return
  }

  await cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
  })
}

async function ensureStandaloneAssets(
  standaloneServerPath: string,
): Promise<void> {
  const standaloneAppDirectory = dirname(standaloneServerPath)
  const standaloneBuildDirectory = resolve(
    standaloneAppDirectory,
    INSPECTOR_RUNTIME_DIST_DIR,
  )
  const inspectorBuildDirectory = getInspectorBuildDirectory()

  await copyIfPresent(
    resolve(inspectorBuildDirectory, 'static'),
    resolve(standaloneBuildDirectory, 'static'),
  )

  await copyIfPresent(
    resolve(INSPECTOR_UI_DIRECTORY, 'public'),
    resolve(standaloneAppDirectory, 'public'),
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

async function runInspectorUiBuild(logs: string[]): Promise<void> {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  await rm(getInspectorBuildDirectory(), {
    recursive: true,
    force: true,
  })
  const child = spawn(npmCommand, ['run', 'build'], {
    cwd: INSPECTOR_UI_DIRECTORY,
    env: getInspectorEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout?.on('data', chunk => appendLog(logs, chunk))
  child.stderr?.on('data', chunk => appendLog(logs, chunk))
  child.on('error', error => {
    appendLog(logs, error.message)
  })

  const exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit, rejectExit) => {
      child.once('error', rejectExit)
      child.once('exit', (code, signal) => resolveExit({ code, signal }))
    },
  )

  if (exitResult.code !== 0) {
    throw new Error(
      `No pude compilar BotValia-CodeUI para el runtime (code=${exitResult.code ?? 'null'}, signal=${exitResult.signal ?? 'none'}).${formatFailureLogs(logs)}`,
    )
  }
}

async function resolveInspectorEntrypoint(logs: string[]): Promise<string | undefined> {
  let standaloneServerPath = await findStandaloneServerPath()
  if (standaloneServerPath) {
    return standaloneServerPath
  }

  if (preferRuntimeUiSource()) {
    return undefined
  }

  await runInspectorUiBuild(logs)
  standaloneServerPath = await findStandaloneServerPath()

  if (!standaloneServerPath) {
    throw new Error(
      `La build de BotValia-CodeUI terminó, pero no apareció server.js en standalone.${formatFailureLogs(logs)}`,
    )
  }

  return standaloneServerPath
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

async function waitForInspectorProcessBoot(
  processState: InspectorProcessState,
): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < 15_000) {
    if (processState.child.exitCode !== null) {
      throw new Error(
        `BotValia-CodeUI terminó antes de arrancar.${formatFailureLogs(processState.logs)}`,
      )
    }

    if (
      processState.logs.some(
        line =>
          line.includes('Local:') ||
          line.includes('Ready in') ||
          line.includes('Ready on') ||
          line.includes('Starting...'),
      )
    ) {
      return
    }

    await delay(200)
  }

  throw new Error(
    `BotValia-CodeUI no confirmó arranque inicial a tiempo.${formatFailureLogs(
      processState.logs,
    )}`,
  )
}

function prewarmInspectorRoute(url: string): void {
  void fetch(url, {
    signal: AbortSignal.timeout(60_000),
  }).catch(() => {
    // Best effort only: the browser will perform the real navigation next.
  })
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
  const standaloneServerPath = await resolveInspectorEntrypoint(logs)
  if (standaloneServerPath) {
    await ensureStandaloneAssets(standaloneServerPath)
  }
  const child = spawn(
    standaloneServerPath ? process.execPath : npmCommand,
    standaloneServerPath
      ? [standaloneServerPath]
      : ['run', 'dev', '--', '--hostname', host, '--port', String(port)],
    {
      cwd: standaloneServerPath
        ? dirname(standaloneServerPath)
        : INSPECTOR_UI_DIRECTORY,
      env: getInspectorEnvironment({
        HOSTNAME: host,
        PORT: String(port),
        NODE_ENV: standaloneServerPath ? 'production' : process.env.NODE_ENV,
      }),
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

  if (standaloneServerPath) {
    await waitForInspectorReady(url, processState)
  } else {
    await waitForInspectorProcessBoot(processState)
    prewarmInspectorRoute(url)
    await waitForInspectorReady(url, processState)
  }

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
