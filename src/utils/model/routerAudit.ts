import {
  AUTO_ALL_MODEL_ALIAS,
  AUTO_OLLAMA_MODEL_ALIAS,
  AUTO_OPENROUTER_MODEL_ALIAS,
} from './model.js'
import {
  applyModelSelectionEnvironment,
  applyProviderRoute,
  getOllamaEndpointPool,
  getOpenRouterAuthTokenPool,
  parseProviderRoute,
  type ProviderRoute,
} from './providerRouting.js'

type RouterTier = 'fast' | 'complex' | 'code'
type InventorySource = 'live' | 'snapshot' | 'unavailable'
type AutoSelection =
  | typeof AUTO_ALL_MODEL_ALIAS
  | typeof AUTO_OPENROUTER_MODEL_ALIAS
  | typeof AUTO_OLLAMA_MODEL_ALIAS

export type RouterChains = Record<RouterTier, string[]>

export type RouterAuditRouteStatus =
  | 'available'
  | 'unknown'
  | 'unavailable'
  | 'ignored'

export type RouterAuditTierDiff = {
  tier: RouterTier
  current: string[]
  recommended: string[]
  changed: boolean
  movedToFront: string[]
  deprioritized: string[]
}

export type RouterAuditResult = {
  selection: AutoSelection
  manualMode: boolean
  selectionReason?: string
  current: RouterChains
  baseline: RouterChains
  recommended: RouterChains
  diffs: RouterAuditTierDiff[]
  openRouter: {
    source: InventorySource
    modelCount: number
    baseUrl: string
    models: string[]
    error?: string
  }
  ollama: {
    source: InventorySource
    modelCount: number
    endpoints: Array<{
      baseUrl: string
      source: 'api-tags' | 'v1-models' | 'unavailable'
      modelCount: number
      error?: string
    }>
    models: string[]
  }
  routeStatuses: Record<string, RouterAuditRouteStatus>
  ignoredRoutes: string[]
}

export type RouterUpdatePayload = {
  env: Record<string, string>
  changedKeys: string[]
}

const ROUTER_ENV_KEYS = [
  'BOTVALIA_MODEL_SELECTION',
  'BOTVALIA_FREE_ONLY_MODE',
  'BOTVALIA_DEFAULT_FALLBACK_MODELS',
  'BOTVALIA_FALLBACK_FOR_ALL_PRIMARY_MODELS',
  'FALLBACK_FOR_ALL_PRIMARY_MODELS',
  'BOTVALIA_MODEL_ROUTER_ENABLED',
  'BOTVALIA_MODEL_ROUTER_FAST_MODEL',
  'BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS',
  'BOTVALIA_MODEL_ROUTER_FAST_CHAIN',
  'BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL',
  'BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS',
  'BOTVALIA_MODEL_ROUTER_COMPLEX_CHAIN',
  'BOTVALIA_MODEL_ROUTER_CODE_MODEL',
  'BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS',
  'BOTVALIA_MODEL_ROUTER_CODE_CHAIN',
  'BOTVALIA_OPENROUTER_LIVE_FREE_MODELS',
  'BOTVALIA_MODEL_ROUTER_LAST_AUDIT_AT',
  'BOTVALIA_MODEL_ROUTER_LAST_AUDIT_SELECTION',
] as const

const OPENROUTER_SNAPSHOT_ENV_KEYS = [
  'BOTVALIA_OPENROUTER_LIVE_FREE_MODELS',
  'BOTVALIA_OPENROUTER_FREE_MODELS',
  'OPENROUTER_LIVE_FREE_MODELS',
] as const

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean),
    ),
  )
}

function splitEnvList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return []
  }

  return uniqueStrings(raw.split(/,|;|\n|\r\n/))
}

function equalChains(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function readTierChain(tier: RouterTier): string[] {
  const upper = tier.toUpperCase()
  const chain = splitEnvList(process.env[`BOTVALIA_MODEL_ROUTER_${upper}_CHAIN`])
  if (chain.length > 0) {
    return chain
  }

  const primary = process.env[`BOTVALIA_MODEL_ROUTER_${upper}_MODEL`]?.trim()
  const fallbacks = splitEnvList(
    process.env[`BOTVALIA_MODEL_ROUTER_${upper}_FALLBACKS`],
  )

  return uniqueStrings([...(primary ? [primary] : []), ...fallbacks])
}

function readRouterChainsFromEnv(): RouterChains {
  return {
    fast: readTierChain('fast'),
    complex: readTierChain('complex'),
    code: readTierChain('code'),
  }
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function withEnvSnapshot<T>(callback: () => T): T {
  const snapshot = { ...process.env }
  try {
    return callback()
  } finally {
    restoreEnv(snapshot)
  }
}

function getBaselineChains(selection: AutoSelection): RouterChains {
  return withEnvSnapshot(() => {
    applyModelSelectionEnvironment(selection)
    return readRouterChainsFromEnv()
  })
}

function inferSelectionFromChains(chains: RouterChains): AutoSelection {
  const routes = uniqueStrings([
    ...chains.fast,
    ...chains.complex,
    ...chains.code,
  ])

  if (routes.length === 0) {
    return AUTO_ALL_MODEL_ALIAS
  }

  const providers = new Set(
    routes
      .map(route => parseProviderRoute(route)?.kind)
      .filter((kind): kind is ProviderRoute['kind'] => Boolean(kind)),
  )

  if (providers.size === 1 && providers.has('openrouter')) {
    return AUTO_OPENROUTER_MODEL_ALIAS
  }

  if (providers.size === 1 && providers.has('ollama')) {
    return AUTO_OLLAMA_MODEL_ALIAS
  }

  return AUTO_ALL_MODEL_ALIAS
}

function resolveSelection(
  modelSetting: string | null | undefined,
): { selection: AutoSelection; manualMode: boolean; reason?: string } {
  if (
    modelSetting === AUTO_ALL_MODEL_ALIAS ||
    modelSetting === AUTO_OPENROUTER_MODEL_ALIAS ||
    modelSetting === AUTO_OLLAMA_MODEL_ALIAS
  ) {
    return {
      selection: modelSetting,
      manualMode: false,
    }
  }

  const envSelection = process.env.BOTVALIA_MODEL_SELECTION?.trim()
  if (
    envSelection === AUTO_ALL_MODEL_ALIAS ||
    envSelection === AUTO_OPENROUTER_MODEL_ALIAS ||
    envSelection === AUTO_OLLAMA_MODEL_ALIAS
  ) {
    return {
      selection: envSelection,
      manualMode: false,
      reason: `Using active router preset from BOTVALIA_MODEL_SELECTION (${envSelection}).`,
    }
  }

  const currentChains = readRouterChainsFromEnv()
  const inferred = inferSelectionFromChains(currentChains)
  return {
    selection: inferred,
    manualMode: true,
    reason:
      modelSetting && modelSetting !== inferred
        ? `Current model is pinned to ${modelSetting}; auditing ${inferred} router presets for future turns.`
        : `No automatic preset was active; auditing ${inferred} router presets for future turns.`,
  }
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function loadOpenRouterInventory(): Promise<RouterAuditResult['openRouter']> {
  const baseUrl =
    process.env.BOTVALIA_OPENROUTER_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim() ||
    'https://openrouter.ai/api'

  try {
    const authToken = getOpenRouterAuthTokenPool()[0]
    const headers: HeadersInit = {
      accept: 'application/json',
    }

    if (authToken) {
      headers.authorization = `Bearer ${authToken}`
    }

    const response = await fetchJsonWithTimeout(
      `${baseUrl.replace(/\/+$/, '')}/v1/models`,
      { headers },
      8000,
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: string
        pricing?: { prompt?: string; completion?: string }
      }>
    }

    const models = uniqueStrings(
      (payload.data ?? [])
        .flatMap(item => {
          const id = item.id?.trim()
          if (!id) {
            return []
          }

          const isFreeVariant = id.toLowerCase().endsWith(':free')
          const isFreeRouter = id === 'openrouter/free'
          const isZeroPrice =
            item.pricing?.prompt === '0' && item.pricing?.completion === '0'

          return isFreeVariant || isFreeRouter || isZeroPrice ? [id] : []
        }),
    )

    return {
      source: 'live',
      modelCount: models.length,
      models,
      baseUrl,
    }
  } catch (error) {
    const snapshotModels = uniqueStrings(
      OPENROUTER_SNAPSHOT_ENV_KEYS.flatMap(key => splitEnvList(process.env[key])),
    )

    if (snapshotModels.length > 0) {
      return {
        source: 'snapshot',
        modelCount: snapshotModels.length,
        models: snapshotModels,
        baseUrl,
        error: (error as Error).message,
      }
    }

    return {
      source: 'unavailable',
      modelCount: 0,
      models: [],
      baseUrl,
      error: (error as Error).message,
    }
  }
}

async function loadOllamaInventory(): Promise<RouterAuditResult['ollama']> {
  const endpoints = getOllamaEndpointPool()
  const seenModels = new Set<string>()
  const results = await Promise.all(
    endpoints.slice(0, 3).map(async endpoint => {
      const trimmedBaseUrl = endpoint.baseUrl.replace(/\/+$/, '')
      const headers: HeadersInit = {
        accept: 'application/json',
      }

      if (endpoint.apiKey?.trim() && endpoint.apiKey !== 'sk-local') {
        headers.authorization = `Bearer ${endpoint.apiKey}`
      }

      const attempts = [
        {
          source: 'api-tags' as const,
          url: `${trimmedBaseUrl}/api/tags`,
        },
        {
          source: 'v1-models' as const,
          url: `${trimmedBaseUrl}/v1/models`,
        },
      ]

      for (const attempt of attempts) {
        try {
          const response = await fetchJsonWithTimeout(
            attempt.url,
            { headers },
            3500,
          )

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const payload = (await response.json()) as {
            models?: Array<{ name?: string; id?: string }>
            data?: Array<{ id?: string }>
          }

          const modelNames = uniqueStrings(
            attempt.source === 'api-tags'
              ? (payload.models ?? [])
                  .map(model => model.name?.trim() || '')
                  .map(name =>
                    name.startsWith('ollama::')
                      ? name.slice('ollama::'.length)
                      : name,
                  )
              : [
                  ...(payload.models ?? []).map(model => model.id?.trim() || ''),
                  ...(payload.data ?? []).map(model => model.id?.trim() || ''),
                ].map(name =>
                  name.startsWith('ollama::')
                    ? name.slice('ollama::'.length)
                    : name,
                ),
          )

          modelNames.forEach(model => seenModels.add(model))

          return {
            baseUrl: endpoint.baseUrl,
            source: attempt.source,
            modelCount: modelNames.length,
          }
        } catch (error) {
          if (attempt.source === attempts.at(-1)?.source) {
            return {
              baseUrl: endpoint.baseUrl,
              source: 'unavailable' as const,
              modelCount: 0,
              error: (error as Error).message,
            }
          }
        }
      }

      return {
        baseUrl: endpoint.baseUrl,
        source: 'unavailable' as const,
        modelCount: 0,
      }
    }),
  )

  const liveEndpointCount = results.filter(
    endpoint => endpoint.source !== 'unavailable',
  ).length

  return {
    source: liveEndpointCount > 0 ? 'live' : 'unavailable',
    modelCount: seenModels.size,
    endpoints: results,
    models: Array.from(seenModels).sort(),
  }
}

function getExpectedProviders(selection: AutoSelection): Set<ProviderRoute['kind']> {
  if (selection === AUTO_OPENROUTER_MODEL_ALIAS) {
    return new Set(['openrouter'])
  }

  if (selection === AUTO_OLLAMA_MODEL_ALIAS) {
    return new Set(['ollama'])
  }

  return new Set(['openrouter', 'ollama'])
}

function classifyRouteStatus(
  route: string,
  openRouter: RouterAuditResult['openRouter'],
  ollama: RouterAuditResult['ollama'],
): RouterAuditRouteStatus {
  const parsed = parseProviderRoute(route)
  if (!parsed) {
    return 'ignored'
  }

  if (parsed.kind === 'anthropic') {
    return 'available'
  }

  if (parsed.kind === 'openrouter') {
    if (parsed.model === 'openrouter/free') {
      return 'available'
    }
    if (openRouter.source === 'unavailable') {
      return 'unknown'
    }
    return openRouter.models.includes(parsed.model)
      ? 'available'
      : 'unavailable'
  }

  if (ollama.source === 'unavailable') {
    return 'unknown'
  }

  return ollama.models.includes(parsed.model) ? 'available' : 'unavailable'
}

function sortRoutesForRecommendation(
  routes: string[],
  routeStatuses: Record<string, RouterAuditRouteStatus>,
): string[] {
  const rank = (status: RouterAuditRouteStatus): number => {
    switch (status) {
      case 'available':
        return 0
      case 'unknown':
        return 1
      case 'unavailable':
        return 2
      default:
        return 3
    }
  }

  return [...routes].sort((left, right) => {
    const leftRank = rank(routeStatuses[left] ?? 'unknown')
    const rightRank = rank(routeStatuses[right] ?? 'unknown')
    return leftRank - rightRank
  })
}

function buildTierDiff(
  tier: RouterTier,
  current: string[],
  recommended: string[],
): RouterAuditTierDiff {
  const currentIndices = new Map(current.map((route, index) => [route, index]))
  const recommendedIndices = new Map(
    recommended.map((route, index) => [route, index]),
  )

  return {
    tier,
    current,
    recommended,
    changed: !equalChains(current, recommended),
    movedToFront: recommended.filter(route => {
      const currentIndex = currentIndices.get(route)
      const recommendedIndex = recommendedIndices.get(route)
      return (
        currentIndex !== undefined &&
        recommendedIndex !== undefined &&
        recommendedIndex < currentIndex
      )
    }),
    deprioritized: recommended.filter(route => {
      const currentIndex = currentIndices.get(route)
      const recommendedIndex = recommendedIndices.get(route)
      return (
        currentIndex !== undefined &&
        recommendedIndex !== undefined &&
        recommendedIndex > currentIndex
      )
    }),
  }
}

export async function auditModelRouter(
  modelSetting: string | null | undefined,
): Promise<RouterAuditResult> {
  const selectionState = resolveSelection(modelSetting)
  const baseline = getBaselineChains(selectionState.selection)
  const current = readRouterChainsFromEnv()
  const effectiveCurrent: RouterChains = {
    fast: current.fast.length > 0 ? current.fast : baseline.fast,
    complex: current.complex.length > 0 ? current.complex : baseline.complex,
    code: current.code.length > 0 ? current.code : baseline.code,
  }

  const [openRouter, ollama] = await Promise.all([
    loadOpenRouterInventory(),
    loadOllamaInventory(),
  ])

  const expectedProviders = getExpectedProviders(selectionState.selection)
  const routeStatuses: Record<string, RouterAuditRouteStatus> = {}
  const ignoredRoutes = new Set<string>()

  const recommended = (['fast', 'complex', 'code'] as const).reduce(
    (acc, tier) => {
      const combinedRoutes = uniqueStrings([
        ...effectiveCurrent[tier],
        ...baseline[tier],
      ])

      const filteredRoutes = combinedRoutes.filter(route => {
        const parsed = parseProviderRoute(route)
        if (!parsed) {
          ignoredRoutes.add(route)
          routeStatuses[route] = 'ignored'
          return false
        }

        if (!expectedProviders.has(parsed.kind)) {
          ignoredRoutes.add(route)
          routeStatuses[route] = 'ignored'
          return false
        }

        routeStatuses[route] = classifyRouteStatus(route, openRouter, ollama)
        return true
      })

      acc[tier] = sortRoutesForRecommendation(filteredRoutes, routeStatuses)
      return acc
    },
    {
      fast: [] as string[],
      complex: [] as string[],
      code: [] as string[],
    },
  )

  const diffs = (['fast', 'complex', 'code'] as const).map(tier =>
    buildTierDiff(tier, effectiveCurrent[tier], recommended[tier]),
  )

  return {
    selection: selectionState.selection,
    manualMode: selectionState.manualMode,
    selectionReason: selectionState.reason,
    current: effectiveCurrent,
    baseline,
    recommended,
    diffs,
    openRouter,
    ollama,
    routeStatuses,
    ignoredRoutes: Array.from(ignoredRoutes),
  }
}

function buildRouterEnvFromAudit(audit: RouterAuditResult): Record<string, string> {
  const env: Record<string, string> = {
    BOTVALIA_MODEL_SELECTION: audit.selection,
    BOTVALIA_FREE_ONLY_MODE: '1',
    BOTVALIA_DEFAULT_FALLBACK_MODELS: '0',
    BOTVALIA_FALLBACK_FOR_ALL_PRIMARY_MODELS: '1',
    FALLBACK_FOR_ALL_PRIMARY_MODELS: '1',
    BOTVALIA_MODEL_ROUTER_ENABLED: '1',
    BOTVALIA_MODEL_ROUTER_LAST_AUDIT_AT: new Date().toISOString(),
    BOTVALIA_MODEL_ROUTER_LAST_AUDIT_SELECTION: audit.selection,
    BOTVALIA_MODEL_ROUTER_FAST_MODEL: audit.recommended.fast[0] ?? '',
    BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS: audit.recommended.fast
      .slice(1)
      .join(','),
    BOTVALIA_MODEL_ROUTER_FAST_CHAIN: audit.recommended.fast.join(','),
    BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL: audit.recommended.complex[0] ?? '',
    BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS: audit.recommended.complex
      .slice(1)
      .join(','),
    BOTVALIA_MODEL_ROUTER_COMPLEX_CHAIN: audit.recommended.complex.join(','),
    BOTVALIA_MODEL_ROUTER_CODE_MODEL: audit.recommended.code[0] ?? '',
    BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS: audit.recommended.code
      .slice(1)
      .join(','),
    BOTVALIA_MODEL_ROUTER_CODE_CHAIN: audit.recommended.code.join(','),
  }

  if (audit.openRouter.models.length > 0) {
    env.BOTVALIA_OPENROUTER_LIVE_FREE_MODELS = audit.openRouter.models.join(',')
  }

  return env
}

export function createRouterUpdatePayload(
  audit: RouterAuditResult,
): RouterUpdatePayload {
  const env = buildRouterEnvFromAudit(audit)
  const changedKeys = Object.keys(env).filter(key => process.env[key] !== env[key])
  return {
    env,
    changedKeys,
  }
}

export function applyRouterUpdatePayload(payload: RouterUpdatePayload): void {
  for (const key of ROUTER_ENV_KEYS) {
    const value = payload.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  applyProviderRoute(payload.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL)
}
