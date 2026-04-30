import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getProjectRoot } from '../../bootstrap/state.js'
import { getCwd } from '../cwd.js'
import { logError } from '../log.js'

export type ModelRouteCooldownReason =
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_model'
  | 'unavailable'
  | 'auth'

export type ModelRouteQueueCandidate = {
  model: string
  routeSpec?: string
}

type PersistedCooldownEntry = {
  cooldownUntil: number
  reason: ModelRouteCooldownReason
  updatedAt: number
  model: string
  routeSpec?: string
}

type PersistedCooldownState = {
  version: 1
  routes: Record<string, PersistedCooldownEntry>
}

const MODEL_ROUTE_COOLDOWN_FILENAME = 'model-route-cooldowns.json'

const DEFAULT_COOLDOWN_MS_BY_REASON: Record<ModelRouteCooldownReason, number> = {
  rate_limit: 15 * 60 * 1000,
  overloaded: 10 * 60 * 1000,
  invalid_model: 6 * 60 * 60 * 1000,
  unavailable: 30 * 60 * 1000,
  auth: 30 * 60 * 1000,
}

function createEmptyState(): PersistedCooldownState {
  return {
    version: 1,
    routes: {},
  }
}

function getProjectRootForCooldowns(): string {
  try {
    return getProjectRoot()
  } catch {
    return getCwd()
  }
}

function getCooldownStatePath(): string {
  return join(
    getProjectRootForCooldowns(),
    '.claude',
    MODEL_ROUTE_COOLDOWN_FILENAME,
  )
}

function normalizeRouteSpec(routeSpec: string | undefined): string | undefined {
  const trimmed = routeSpec?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeModel(model: string): string {
  return model.trim()
}

function getCandidateKey(
  candidate: ModelRouteQueueCandidate,
): string | undefined {
  const routeSpec = normalizeRouteSpec(candidate.routeSpec)
  if (routeSpec) {
    return `route:${routeSpec}`
  }

  const model = normalizeModel(candidate.model)
  return model ? `model:${model}` : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readCooldownState(): PersistedCooldownState {
  try {
    const raw = readFileSync(getCooldownStatePath(), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !isRecord(parsed.routes)) {
      return createEmptyState()
    }

    const routes: Record<string, PersistedCooldownEntry> = {}
    for (const [key, value] of Object.entries(parsed.routes)) {
      if (!isRecord(value)) {
        continue
      }

      const cooldownUntil = value.cooldownUntil
      const updatedAt = value.updatedAt
      const reason = value.reason
      const model = value.model
      const routeSpec = value.routeSpec

      if (
        typeof cooldownUntil !== 'number' ||
        !Number.isFinite(cooldownUntil) ||
        typeof updatedAt !== 'number' ||
        !Number.isFinite(updatedAt) ||
        typeof reason !== 'string' ||
        typeof model !== 'string'
      ) {
        continue
      }

      if (
        reason !== 'rate_limit' &&
        reason !== 'overloaded' &&
        reason !== 'invalid_model' &&
        reason !== 'unavailable' &&
        reason !== 'auth'
      ) {
        continue
      }

      routes[key] = {
        cooldownUntil,
        updatedAt,
        reason,
        model,
        ...(typeof routeSpec === 'string' && routeSpec.trim()
          ? { routeSpec: routeSpec.trim() }
          : {}),
      }
    }

    return {
      version: 1,
      routes,
    }
  } catch (error) {
    if (
      !(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
    ) {
      logError(error)
    }
    return createEmptyState()
  }
}

function writeCooldownState(state: PersistedCooldownState): void {
  try {
    mkdirSync(join(getProjectRootForCooldowns(), '.claude'), {
      recursive: true,
    })
    writeFileSync(
      getCooldownStatePath(),
      JSON.stringify(state, null, 2) + '\n',
      'utf-8',
    )
  } catch (error) {
    logError(error)
  }
}

function pruneExpiredEntries(
  state: PersistedCooldownState,
  now: number,
): PersistedCooldownState {
  const nextState = createEmptyState()
  for (const [key, entry] of Object.entries(state.routes)) {
    if (entry.cooldownUntil > now) {
      nextState.routes[key] = entry
    }
  }
  return nextState
}

function getActiveCooldownEntry(
  candidate: ModelRouteQueueCandidate,
  state: PersistedCooldownState,
  now: number,
): PersistedCooldownEntry | undefined {
  const key = getCandidateKey(candidate)
  if (!key) {
    return undefined
  }

  const entry = state.routes[key]
  if (!entry || entry.cooldownUntil <= now) {
    return undefined
  }

  return entry
}

export function reorderModelRouteQueue<T extends ModelRouteQueueCandidate>(
  candidates: T[],
  now = Date.now(),
): T[] {
  if (candidates.length <= 1) {
    return [...candidates]
  }

  const state = pruneExpiredEntries(readCooldownState(), now)
  const active: Array<{ candidate: T; index: number }> = []
  const cooled: Array<{
    candidate: T
    index: number
    cooldownUntil: number
  }> = []

  candidates.forEach((candidate, index) => {
    const entry = getActiveCooldownEntry(candidate, state, now)
    if (entry) {
      cooled.push({
        candidate,
        index,
        cooldownUntil: entry.cooldownUntil,
      })
      return
    }

    active.push({ candidate, index })
  })

  cooled.sort((left, right) => {
    if (left.cooldownUntil !== right.cooldownUntil) {
      return left.cooldownUntil - right.cooldownUntil
    }
    return left.index - right.index
  })

  return [
    ...active.map(entry => entry.candidate),
    ...cooled.map(entry => entry.candidate),
  ]
}

export function reorderProviderRouteChain(routeSpecs: string[]): string[] {
  return reorderModelRouteQueue(
    routeSpecs.map(routeSpec => ({
      model: routeSpec,
      routeSpec,
    })),
  ).map(candidate => candidate.routeSpec ?? candidate.model)
}

export function markModelRouteCooldown(
  candidate: ModelRouteQueueCandidate,
  reason: ModelRouteCooldownReason,
  cooldownMs = DEFAULT_COOLDOWN_MS_BY_REASON[reason],
): void {
  const key = getCandidateKey(candidate)
  if (!key) {
    return
  }

  const now = Date.now()
  const state = pruneExpiredEntries(readCooldownState(), now)
  const normalizedModel = normalizeModel(candidate.model)
  if (!normalizedModel) {
    return
  }

  const routeSpec = normalizeRouteSpec(candidate.routeSpec)
  const cooldownUntil = now + Math.max(1, cooldownMs)
  const previous = state.routes[key]

  state.routes[key] = {
    cooldownUntil: Math.max(previous?.cooldownUntil ?? 0, cooldownUntil),
    updatedAt: now,
    reason,
    model: normalizedModel,
    ...(routeSpec ? { routeSpec } : {}),
  }

  writeCooldownState(state)
}
