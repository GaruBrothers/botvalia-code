import { existsSync, readFileSync, readdirSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getProjectDir, getProjectsDir } from '../utils/sessionStorage.js'
import type {
  RuntimeSessionDetail,
  RuntimeSessionEventRecord,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'

const RUNTIME_SESSION_RECORD_SUFFIX = '.runtime-session.json'
const MAX_PERSISTED_EVENTS = 200

type PersistedRuntimeSessionRecord = {
  version: 1
  snapshot: RuntimeSessionSnapshot
  events: RuntimeSessionEventRecord[]
}

export type RuntimeSessionRecord = {
  snapshot: RuntimeSessionSnapshot
  events: RuntimeSessionEventRecord[]
  path: string
}

function getRecordPath(
  sessionId: RuntimeSessionId,
  cwd: string,
): string {
  return join(
    getProjectDir(cwd),
    `${sessionId}${RUNTIME_SESSION_RECORD_SUFFIX}`,
  )
}

function normalizeEvents(
  events: RuntimeSessionEventRecord[] | undefined,
): RuntimeSessionEventRecord[] {
  return (events ?? [])
    .filter(event => !!event && typeof event.id === 'string')
    .slice(-MAX_PERSISTED_EVENTS)
}

function normalizeSnapshotFromDisk(
  snapshot: RuntimeSessionSnapshot,
): RuntimeSessionSnapshot {
  return {
    ...snapshot,
    hasLiveRuntime: false,
    channelOwner: null,
    leaseExpiresAt: undefined,
  }
}

function normalizeRecordFromDisk(
  raw: PersistedRuntimeSessionRecord,
  path: string,
): RuntimeSessionRecord | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    raw.version !== 1 ||
    !raw.snapshot ||
    typeof raw.snapshot !== 'object' ||
    typeof raw.snapshot.sessionId !== 'string' ||
    typeof raw.snapshot.cwd !== 'string'
  ) {
    return null
  }

  return {
    snapshot: normalizeSnapshotFromDisk(raw.snapshot),
    events: normalizeEvents(raw.events),
    path,
  }
}

function parseRecordSync(path: string): RuntimeSessionRecord | null {
  if (!existsSync(path)) {
    return null
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as PersistedRuntimeSessionRecord
    return normalizeRecordFromDisk(raw, path)
  } catch {
    return null
  }
}

async function parseRecord(path: string): Promise<RuntimeSessionRecord | null> {
  try {
    const raw = JSON.parse(
      await readFile(path, 'utf8'),
    ) as PersistedRuntimeSessionRecord
    return normalizeRecordFromDisk(raw, path)
  } catch {
    return null
  }
}

export function readRuntimeSessionRecordSync(
  sessionId: RuntimeSessionId,
  cwd: string,
): RuntimeSessionRecord | null {
  return parseRecordSync(getRecordPath(sessionId, cwd))
}

export async function readRuntimeSessionRecord(
  sessionId: RuntimeSessionId,
  cwd: string,
): Promise<RuntimeSessionRecord | null> {
  return parseRecord(getRecordPath(sessionId, cwd))
}

export async function writeRuntimeSessionRecord(
  snapshot: RuntimeSessionSnapshot,
  events: RuntimeSessionEventRecord[],
): Promise<RuntimeSessionRecord> {
  const path = getRecordPath(snapshot.sessionId, snapshot.cwd)
  const payload: PersistedRuntimeSessionRecord = {
    version: 1,
    snapshot,
    events: normalizeEvents(events),
  }

  await mkdir(getProjectDir(snapshot.cwd), { recursive: true })
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf8')

  return {
    snapshot: normalizeSnapshotFromDisk(snapshot),
    events: normalizeEvents(events),
    path,
  }
}

export async function listRuntimeSessionRecords(): Promise<RuntimeSessionRecord[]> {
  const projectsDir = getProjectsDir()
  let projectEntries: string[]

  try {
    projectEntries = await readdir(projectsDir)
  } catch {
    return []
  }

  const records = await Promise.all(
    projectEntries.map(async projectEntry => {
      const projectPath = join(projectsDir, projectEntry)
      let files: string[]

      try {
        files = await readdir(projectPath)
      } catch {
        return []
      }

      const recordPaths = files
        .filter(file => file.endsWith(RUNTIME_SESSION_RECORD_SUFFIX))
        .map(file => join(projectPath, file))

      const parsed = await Promise.all(recordPaths.map(parseRecord))
      return parsed.filter((record): record is RuntimeSessionRecord => !!record)
    }),
  )

  return records
    .flat()
    .sort((left, right) =>
      Date.parse(right.snapshot.updatedAt) - Date.parse(left.snapshot.updatedAt),
    )
}

export function listRuntimeSessionRecordsSync(): RuntimeSessionRecord[] {
  const projectsDir = getProjectsDir()
  let projectEntries: string[]

  try {
    projectEntries = readdirSync(projectsDir)
  } catch {
    return []
  }

  return projectEntries
    .flatMap(projectEntry => {
      const projectPath = join(projectsDir, projectEntry)
      let files: string[]

      try {
        files = readdirSync(projectPath)
      } catch {
        return []
      }

      return files
        .filter(file => file.endsWith(RUNTIME_SESSION_RECORD_SUFFIX))
        .map(file => parseRecordSync(join(projectPath, file)))
        .filter((record): record is RuntimeSessionRecord => !!record)
    })
    .sort((left, right) =>
      Date.parse(right.snapshot.updatedAt) - Date.parse(left.snapshot.updatedAt),
    )
}

export async function findRuntimeSessionRecord(
  sessionId: RuntimeSessionId,
): Promise<RuntimeSessionRecord | null> {
  const records = await listRuntimeSessionRecords()
  return records.find(record => record.snapshot.sessionId === sessionId) ?? null
}

export function findRuntimeSessionRecordSync(
  sessionId: RuntimeSessionId,
): RuntimeSessionRecord | null {
  const records = listRuntimeSessionRecordsSync()
  return records.find(record => record.snapshot.sessionId === sessionId) ?? null
}

export function createRuntimeSessionDetailFromRecord(
  snapshot: RuntimeSessionSnapshot,
  events: RuntimeSessionEventRecord[],
): RuntimeSessionDetail {
  return {
    snapshot,
    messages: [],
    tasks: [],
    swarmThreads: [],
    swarmWaitingEdges: [],
    events,
  }
}
