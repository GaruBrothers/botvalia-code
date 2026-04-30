import { isEnvTruthy } from '../envUtils.js'
import {
  AUTO_ALL_MODEL_ALIAS,
  AUTO_OLLAMA_MODEL_ALIAS,
  AUTO_OPENROUTER_MODEL_ALIAS,
  parseUserSpecifiedModel,
} from './model.js'
import { reorderProviderRouteChain } from './providerRouteCooldowns.js'

export type ProviderRouteKind = 'anthropic' | 'openrouter' | 'ollama'

export type ProviderRoute = {
  raw: string
  kind: ProviderRouteKind
  model: string
}

export type ProviderEndpoint = {
  baseUrl: string
  apiKey: string
}

const ROUTE_SEPARATOR = '::'
const OPENROUTER_AUTO_FAST_MODEL = 'openrouter::openrouter/free'
const OPENROUTER_AUTO_FAST_FALLBACKS = [
  'openrouter::google/gemma-4-26b-a4b-it:free',
  'openrouter::openai/gpt-oss-20b:free',
  'openrouter::z-ai/glm-4.5-air:free',
  'openrouter::nvidia/nemotron-nano-9b-v2:free',
  'openrouter::google/gemma-3-12b-it:free',
  'openrouter::meta-llama/llama-3.2-3b-instruct:free',
  'openrouter::google/gemma-3-4b-it:free',
]
const OPENROUTER_AUTO_COMPLEX_MODEL = 'openrouter::tencent/hy3-preview:free'
const OPENROUTER_AUTO_COMPLEX_FALLBACKS = [
  'openrouter::tencent/hy3-preview:free',
  'openrouter::openai/gpt-oss-120b:free',
  'openrouter::minimax/minimax-m2.5:free',
  'openrouter::nvidia/nemotron-3-super-120b-a12b:free',
  'openrouter::inclusionai/ling-2.6-1t:free',
  'openrouter::qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter::meta-llama/llama-3.3-70b-instruct:free',
  'openrouter::openrouter/free',
]
const OPENROUTER_AUTO_CODE_MODEL = 'openrouter::qwen/qwen3-coder:free'
const OPENROUTER_AUTO_CODE_FALLBACKS = [
  'openrouter::poolside/laguna-m.1:free',
  'openrouter::qwen/qwen3.6-plus:free',
  'openrouter::qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter::openai/gpt-oss-120b:free',
  'openrouter::tencent/hy3-preview:free',
  'openrouter::nvidia/nemotron-3-super-120b-a12b:free',
  'openrouter::google/gemma-4-31b-it:free',
  'openrouter::openrouter/free',
]
const OLLAMA_AUTO_FAST_MODEL = 'ollama::llama3.2:3b'
const OLLAMA_AUTO_FAST_FALLBACKS = [
  'ollama::qwen2.5:3b',
  'ollama::qwen2.5-coder:3b',
  'ollama::deepseek-r1:8b',
  'ollama::qwen2.5-coder:7b',
  'ollama::gpt-oss:20b',
]
const OLLAMA_AUTO_COMPLEX_MODEL = 'ollama::devstral'
const OLLAMA_AUTO_COMPLEX_FALLBACKS = [
  'ollama::gpt-oss:20b',
  'ollama::deepseek-r1:14b',
  'ollama::qwen3-next:80b',
  'ollama::qwen3:30b',
  'ollama::qwen2.5-coder:14b',
  'ollama::qwen2.5-coder:7b',
]
const OLLAMA_AUTO_CODE_MODEL = 'ollama::qwen3-coder'
const OLLAMA_AUTO_CODE_FALLBACKS = [
  'ollama::devstral',
  'ollama::gpt-oss:20b',
  'ollama::qwen2.5-coder:32b',
  'ollama::qwen2.5-coder:14b',
  'ollama::qwen2.5-coder:7b',
  'ollama::deepseek-r1:14b',
]
const ALL_AUTO_FAST_ROUTES = [
  OPENROUTER_AUTO_FAST_MODEL,
  ...OPENROUTER_AUTO_FAST_FALLBACKS,
  OLLAMA_AUTO_FAST_MODEL,
  ...OLLAMA_AUTO_FAST_FALLBACKS.slice(0, 3),
]
const ALL_AUTO_COMPLEX_ROUTES = [
  OPENROUTER_AUTO_COMPLEX_MODEL,
  ...OPENROUTER_AUTO_COMPLEX_FALLBACKS,
  OLLAMA_AUTO_COMPLEX_MODEL,
  ...OLLAMA_AUTO_COMPLEX_FALLBACKS.slice(0, 3),
]
const ALL_AUTO_CODE_ROUTES = [
  OPENROUTER_AUTO_CODE_MODEL,
  ...OPENROUTER_AUTO_CODE_FALLBACKS,
  OLLAMA_AUTO_CODE_MODEL,
  ...OLLAMA_AUTO_CODE_FALLBACKS.slice(0, 3),
]

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function splitPoolValues(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return []
  }

  return raw
    .split(/,|\n|\r\n|;/)
    .map(item => item.trim())
    .filter(Boolean)
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function getLiveOpenRouterFreeModels(): Set<string> {
  const raw = firstNonEmpty(
    process.env.BOTVALIA_OPENROUTER_LIVE_FREE_MODELS,
    process.env.BOTVALIA_OPENROUTER_FREE_MODELS,
    process.env.OPENROUTER_LIVE_FREE_MODELS,
  )

  if (!raw) {
    return new Set()
  }

  return new Set(
    splitPoolValues(raw).map(value => parseUserSpecifiedModel(value)),
  )
}

function prioritizeLiveOpenRouterRoutes(routes: string[]): string[] {
  const normalizedRoutes = dedupeStrings(routes)
  const liveModels = getLiveOpenRouterFreeModels()
  if (liveModels.size === 0) {
    return normalizedRoutes
  }

  const live: string[] = []
  const unknown: string[] = []

  for (const route of normalizedRoutes) {
    const parsed = parseProviderRoute(route)
    if (!parsed || parsed.kind !== 'openrouter') {
      live.push(route)
      continue
    }

    if (parsed.model === 'openrouter/free' || liveModels.has(parsed.model)) {
      live.push(route)
      continue
    }

    unknown.push(route)
  }

  return live.length > 0 ? [...live, ...unknown] : normalizedRoutes
}

function applyEnvValue(key: string, value: string | undefined): void {
  if (value === undefined || value === '') {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

function clearModelRouterEnvironment(): void {
  delete process.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL
  delete process.env.BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS
  delete process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL
  delete process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS
  delete process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL
  delete process.env.BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS
  delete process.env.BOTVALIA_MODEL_ROUTER_FAST_CHAIN
  delete process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_CHAIN
  delete process.env.BOTVALIA_MODEL_ROUTER_CODE_CHAIN
}

function disableModelRouterEnvironment(): void {
  clearModelRouterEnvironment()
  process.env.BOTVALIA_MODEL_ROUTER_ENABLED = '0'
}

function setFreeOnlyModeEnvironment(
  allowAutomaticFallbacks: boolean,
  modelSelection: string,
): void {
  process.env.BOTVALIA_FREE_ONLY_MODE = '1'
  process.env.BOTVALIA_MODEL_SELECTION = modelSelection
  process.env.BOTVALIA_DEFAULT_FALLBACK_MODELS = '0'
  process.env.BOTVALIA_FALLBACK_FOR_ALL_PRIMARY_MODELS =
    allowAutomaticFallbacks ? '1' : '0'
  process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS = allowAutomaticFallbacks
    ? '1'
    : '0'
  delete process.env.BOTVALIA_FALLBACK_MODELS
}

function clearFreeOnlyModeEnvironment(): void {
  delete process.env.BOTVALIA_FREE_ONLY_MODE
  delete process.env.BOTVALIA_DEFAULT_FALLBACK_MODELS
  delete process.env.BOTVALIA_FALLBACK_FOR_ALL_PRIMARY_MODELS
  delete process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS
}

function applyModelRouterRoutes(routes: {
  selection: string
  fast: string[]
  complex: string[]
  code: string[]
}): void {
  const fastRoutes = reorderProviderRouteChain(
    prioritizeLiveOpenRouterRoutes(routes.fast),
  )
  const complexRoutes = reorderProviderRouteChain(
    prioritizeLiveOpenRouterRoutes(routes.complex),
  )
  const codeRoutes = reorderProviderRouteChain(
    prioritizeLiveOpenRouterRoutes(routes.code),
  )

  clearModelRouterEnvironment()
  setFreeOnlyModeEnvironment(true, routes.selection)
  process.env.BOTVALIA_MODEL_ROUTER_ENABLED = '1'
  process.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL = fastRoutes[0] ?? ''
  process.env.BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS = fastRoutes
    .slice(1)
    .join(',')
  process.env.BOTVALIA_MODEL_ROUTER_FAST_CHAIN = fastRoutes.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL = complexRoutes[0] ?? ''
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS = complexRoutes
    .slice(1)
    .join(',')
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_CHAIN = complexRoutes.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL = codeRoutes[0] ?? ''
  process.env.BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS = codeRoutes
    .slice(1)
    .join(',')
  process.env.BOTVALIA_MODEL_ROUTER_CODE_CHAIN = codeRoutes.join(',')
  applyProviderRoute(fastRoutes[0])
}

function configureOpenRouterAutoRouting(): void {
  applyModelRouterRoutes({
    selection: AUTO_OPENROUTER_MODEL_ALIAS,
    fast: [
      OPENROUTER_AUTO_FAST_MODEL,
      ...OPENROUTER_AUTO_FAST_FALLBACKS,
    ],
    complex: [
      OPENROUTER_AUTO_COMPLEX_MODEL,
      ...OPENROUTER_AUTO_COMPLEX_FALLBACKS,
    ],
    code: [OPENROUTER_AUTO_CODE_MODEL, ...OPENROUTER_AUTO_CODE_FALLBACKS],
  })
}

function configureOllamaAutoRouting(): void {
  applyModelRouterRoutes({
    selection: AUTO_OLLAMA_MODEL_ALIAS,
    fast: [OLLAMA_AUTO_FAST_MODEL, ...OLLAMA_AUTO_FAST_FALLBACKS],
    complex: [OLLAMA_AUTO_COMPLEX_MODEL, ...OLLAMA_AUTO_COMPLEX_FALLBACKS],
    code: [OLLAMA_AUTO_CODE_MODEL, ...OLLAMA_AUTO_CODE_FALLBACKS],
  })
}

function getOpenRouterBaseUrl(): string {
  return (
    firstNonEmpty(
      process.env.BOTVALIA_OPENROUTER_BASE_URL,
      process.env.OPENROUTER_BASE_URL,
    ) || 'https://openrouter.ai/api'
  )
}

export function getOpenRouterAuthTokenPool(): string[] {
  const pooledTokens = dedupeStrings(
    splitPoolValues(
      firstNonEmpty(
        process.env.BOTVALIA_OPENROUTER_API_KEYS,
        process.env.OPENROUTER_API_KEYS,
      ),
    ),
  )

  const singleToken = firstNonEmpty(
    process.env.OPENROUTER_API_KEY,
    process.env.BOTVALIA_OPENROUTER_API_KEY,
  )

  const activeOpenRouterToken =
    process.env.BOTVALIA_ACTIVE_PROVIDER === 'openrouter'
      ? firstNonEmpty(process.env.ANTHROPIC_AUTH_TOKEN)
      : undefined

  return dedupeStrings([
    ...pooledTokens,
    ...(singleToken ? [singleToken] : []),
    ...(activeOpenRouterToken ? [activeOpenRouterToken] : []),
  ])
}

export function rotateOpenRouterAuthToken(current: string | undefined): {
  rotated: boolean
  next?: string
} {
  const pool = getOpenRouterAuthTokenPool()
  if (pool.length <= 1) {
    return { rotated: false }
  }

  const normalizedCurrent = (current || '').trim()
  const currentIdx = normalizedCurrent ? pool.indexOf(normalizedCurrent) : -1
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % pool.length : 0
  const next = pool[nextIdx]
  if (!next || next === normalizedCurrent) {
    return { rotated: false }
  }

  process.env.ANTHROPIC_AUTH_TOKEN = next
  return { rotated: true, next }
}

function getOpenRouterAuthToken(): string | undefined {
  return getOpenRouterAuthTokenPool()[0]
}

function getAnthropicBaseUrl(): string | undefined {
  return firstNonEmpty(process.env.BOTVALIA_ANTHROPIC_BASE_URL)
}

function getAnthropicApiKey(): string | undefined {
  return firstNonEmpty(
    process.env.BOTVALIA_ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY,
  )
}

function getAnthropicAuthToken(): string | undefined {
  return firstNonEmpty(
    process.env.BOTVALIA_ANTHROPIC_AUTH_TOKEN,
    process.env.ANTHROPIC_AUTH_TOKEN,
  )
}

function getOllamaBaseUrl(): string {
  return getOllamaEndpointPool()[0]?.baseUrl ?? 'http://localhost:11434'
}

function getOllamaApiKey(): string {
  return getOllamaEndpointPool()[0]?.apiKey ?? 'sk-local'
}

function normalizeEndpointBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  return trimmed.replace(/\/+$/, '')
}

function createEndpoint(baseUrl: string, apiKey: string | undefined): ProviderEndpoint {
  return {
    baseUrl: normalizeEndpointBaseUrl(baseUrl),
    apiKey: apiKey?.trim() || 'sk-local',
  }
}

function parseEndpointPool(raw: string | undefined): ProviderEndpoint[] {
  return splitPoolValues(raw)
    .map(item => {
      const [baseUrlPart, apiKeyPart] = item.split('|')
      if (!baseUrlPart?.trim()) {
        return undefined
      }
      return createEndpoint(baseUrlPart, apiKeyPart)
    })
    .filter((endpoint): endpoint is ProviderEndpoint => Boolean(endpoint))
}

export function getOllamaEndpointPool(): ProviderEndpoint[] {
  const explicitEndpoints = [
    ...parseEndpointPool(process.env.BOTVALIA_OLLAMA_ENDPOINTS),
    ...parseEndpointPool(process.env.OLLAMA_ENDPOINTS),
    ...parseEndpointPool(process.env.BOTVALIA_LITELLM_ENDPOINTS),
    ...parseEndpointPool(process.env.LITELLM_ENDPOINTS),
  ]

  const baseUrls = dedupeStrings([
    ...splitPoolValues(process.env.BOTVALIA_OLLAMA_BASE_URLS),
    ...splitPoolValues(process.env.OLLAMA_BASE_URLS),
    ...splitPoolValues(process.env.BOTVALIA_LITELLM_BASE_URLS),
    ...splitPoolValues(process.env.LITELLM_BASE_URLS),
  ])
  const apiKeys = [
    ...splitPoolValues(process.env.BOTVALIA_OLLAMA_API_KEYS),
    ...splitPoolValues(process.env.OLLAMA_API_KEYS),
    ...splitPoolValues(process.env.BOTVALIA_LITELLM_API_KEYS),
    ...splitPoolValues(process.env.LITELLM_API_KEYS),
  ]

  const indexedEndpoints = baseUrls.map((baseUrl, index) =>
    createEndpoint(
      baseUrl,
      apiKeys[index] ||
        firstNonEmpty(
          process.env.BOTVALIA_OLLAMA_API_KEY,
          process.env.OLLAMA_API_KEY,
          process.env.BOTVALIA_LITELLM_API_KEY,
          process.env.LITELLM_API_KEY,
          process.env.ANTHROPIC_API_KEY,
        ),
    ),
  )

  const fallbackBaseUrl = firstNonEmpty(
    process.env.BOTVALIA_OLLAMA_BASE_URL,
    process.env.OLLAMA_BASE_URL,
    process.env.BOTVALIA_LITELLM_BASE_URL,
    process.env.LITELLM_BASE_URL,
  )
  const fallbackApiKey = firstNonEmpty(
    process.env.BOTVALIA_OLLAMA_API_KEY,
    process.env.OLLAMA_API_KEY,
    process.env.BOTVALIA_LITELLM_API_KEY,
    process.env.LITELLM_API_KEY,
    process.env.ANTHROPIC_API_KEY,
  )

  const fallbackEndpoint = fallbackBaseUrl
    ? [createEndpoint(fallbackBaseUrl, fallbackApiKey)]
    : [createEndpoint('http://localhost:11434', fallbackApiKey)]

  const deduped = new Map<string, ProviderEndpoint>()
  for (const endpoint of [
    ...explicitEndpoints,
    ...indexedEndpoints,
    ...fallbackEndpoint,
  ]) {
    deduped.set(`${endpoint.baseUrl}|${endpoint.apiKey}`, endpoint)
  }

  return Array.from(deduped.values())
}

export function rotateOllamaEndpoint(currentBaseUrl: string | undefined): {
  rotated: boolean
  next?: ProviderEndpoint
} {
  const pool = getOllamaEndpointPool()
  if (pool.length <= 1) {
    return { rotated: false }
  }

  const normalizedCurrent = currentBaseUrl
    ? normalizeEndpointBaseUrl(currentBaseUrl)
    : ''
  const currentIdx = normalizedCurrent
    ? pool.findIndex(endpoint => endpoint.baseUrl === normalizedCurrent)
    : -1
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % pool.length : 0
  const next = pool[nextIdx]
  if (!next || next.baseUrl === normalizedCurrent) {
    return { rotated: false }
  }

  process.env.BOTVALIA_OLLAMA_BASE_URL = next.baseUrl
  process.env.OLLAMA_BASE_URL = next.baseUrl
  process.env.BOTVALIA_LITELLM_BASE_URL = next.baseUrl
  process.env.LITELLM_BASE_URL = next.baseUrl
  process.env.BOTVALIA_OLLAMA_API_KEY = next.apiKey
  process.env.OLLAMA_API_KEY = next.apiKey
  process.env.BOTVALIA_LITELLM_API_KEY = next.apiKey
  process.env.LITELLM_API_KEY = next.apiKey
  process.env.ANTHROPIC_BASE_URL = next.baseUrl
  process.env.ANTHROPIC_API_KEY = next.apiKey
  process.env.ANTHROPIC_AUTH_TOKEN = ''

  return { rotated: true, next }
}

export function isOllamaBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false
  }

  const normalized = normalizeEndpointBaseUrl(baseUrl)
  return getOllamaEndpointPool().some(
    endpoint => endpoint.baseUrl === normalized,
  )
}

function hasOpenRouterConfigured(): boolean {
  if (process.env.BOTVALIA_OPENROUTER_AVAILABLE !== undefined) {
    return isEnvTruthy(process.env.BOTVALIA_OPENROUTER_AVAILABLE)
  }

  return getOpenRouterAuthTokenPool().length > 0
}

function hasOllamaConfigured(): boolean {
  if (process.env.BOTVALIA_OLLAMA_AVAILABLE !== undefined) {
    return isEnvTruthy(process.env.BOTVALIA_OLLAMA_AVAILABLE)
  }

  return Boolean(
    firstNonEmpty(
      process.env.BOTVALIA_OLLAMA_ENDPOINTS,
      process.env.OLLAMA_ENDPOINTS,
      process.env.BOTVALIA_LITELLM_ENDPOINTS,
      process.env.LITELLM_ENDPOINTS,
      process.env.BOTVALIA_OLLAMA_BASE_URLS,
      process.env.OLLAMA_BASE_URLS,
      process.env.BOTVALIA_LITELLM_BASE_URLS,
      process.env.LITELLM_BASE_URLS,
      process.env.BOTVALIA_OLLAMA_BASE_URL,
      process.env.OLLAMA_BASE_URL,
      process.env.BOTVALIA_LITELLM_BASE_URL,
      process.env.LITELLM_BASE_URL,
      process.env.BOTVALIA_OLLAMA_API_KEY,
      process.env.OLLAMA_API_KEY,
      process.env.BOTVALIA_LITELLM_API_KEY,
      process.env.LITELLM_API_KEY,
    ),
  )
}

function configureAutoAllRouting(): void {
  const preferOpenRouter = hasOpenRouterConfigured()
  const allowOllama = hasOllamaConfigured()

  if (preferOpenRouter && allowOllama) {
    applyModelRouterRoutes({
      selection: AUTO_ALL_MODEL_ALIAS,
      fast: ALL_AUTO_FAST_ROUTES,
      complex: ALL_AUTO_COMPLEX_ROUTES,
      code: ALL_AUTO_CODE_ROUTES,
    })
    return
  }

  if (preferOpenRouter) {
    applyModelRouterRoutes({
      selection: AUTO_ALL_MODEL_ALIAS,
      fast: [OPENROUTER_AUTO_FAST_MODEL, ...OPENROUTER_AUTO_FAST_FALLBACKS],
      complex: [
        OPENROUTER_AUTO_COMPLEX_MODEL,
        ...OPENROUTER_AUTO_COMPLEX_FALLBACKS,
      ],
      code: [OPENROUTER_AUTO_CODE_MODEL, ...OPENROUTER_AUTO_CODE_FALLBACKS],
    })
    return
  }

  applyModelRouterRoutes({
    selection: AUTO_ALL_MODEL_ALIAS,
    fast: [OLLAMA_AUTO_FAST_MODEL, ...OLLAMA_AUTO_FAST_FALLBACKS],
    complex: [OLLAMA_AUTO_COMPLEX_MODEL, ...OLLAMA_AUTO_COMPLEX_FALLBACKS],
    code: [OLLAMA_AUTO_CODE_MODEL, ...OLLAMA_AUTO_CODE_FALLBACKS],
  })
}

export function isProviderRouteSpec(candidate: string | undefined): boolean {
  if (!candidate) {
    return false
  }
  return parseProviderRoute(candidate) !== undefined
}

export function parseProviderRoute(
  candidate: string | undefined,
): ProviderRoute | undefined {
  if (!candidate) {
    return undefined
  }

  const separatorIndex = candidate.indexOf(ROUTE_SEPARATOR)
  if (separatorIndex <= 0) {
    return undefined
  }

  const rawKind = candidate.slice(0, separatorIndex).trim().toLowerCase()
  const modelPart = candidate.slice(separatorIndex + ROUTE_SEPARATOR.length).trim()
  if (!modelPart) {
    return undefined
  }

  if (
    rawKind !== 'anthropic' &&
    rawKind !== 'openrouter' &&
    rawKind !== 'ollama'
  ) {
    return undefined
  }

  const model =
    rawKind === 'ollama'
      ? modelPart.startsWith('ollama/')
        ? modelPart
        : `ollama/${modelPart}`
      : parseUserSpecifiedModel(modelPart)

  return {
    raw: candidate.trim(),
    kind: rawKind,
    model,
  }
}

export function normalizeModelCandidate(candidate: string): {
  model: string
  routeSpec?: string
} {
  const route = parseProviderRoute(candidate)
  if (route) {
    return {
      model: route.model,
      routeSpec: route.raw,
    }
  }
  return {
    model: parseUserSpecifiedModel(candidate),
  }
}

export function applyProviderRoute(routeSpec: string | undefined): void {
  const route = parseProviderRoute(routeSpec)

  if (!route) {
    delete process.env.BOTVALIA_ACTIVE_PROVIDER
    delete process.env.BOTVALIA_ACTIVE_PROVIDER_ROUTE
    delete process.env.ANTHROPIC_CUSTOM_MODEL_OPTION
    delete process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME
    delete process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION
    return
  }

  process.env.BOTVALIA_ACTIVE_PROVIDER = route.kind
  process.env.BOTVALIA_ACTIVE_PROVIDER_ROUTE = route.raw

  if (route.kind === 'anthropic') {
    applyEnvValue('ANTHROPIC_BASE_URL', getAnthropicBaseUrl())
    applyEnvValue('ANTHROPIC_API_KEY', getAnthropicApiKey())
    applyEnvValue('ANTHROPIC_AUTH_TOKEN', getAnthropicAuthToken())
    applyEnvValue('ANTHROPIC_MODEL', route.model)
    applyEnvValue('ANTHROPIC_CUSTOM_MODEL_OPTION', route.model)
    applyEnvValue(
      'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
      `Anthropic: ${route.model}`,
    )
    applyEnvValue(
      'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
      'Custom model over Anthropic',
    )
    if (process.env.BOTVALIA_ANTHROPIC_DISABLE_EXPERIMENTAL_BETAS !== undefined) {
      process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = isEnvTruthy(
        process.env.BOTVALIA_ANTHROPIC_DISABLE_EXPERIMENTAL_BETAS,
      )
        ? '1'
        : '0'
    }
    return
  }

  if (route.kind === 'openrouter') {
    applyEnvValue('ANTHROPIC_BASE_URL', getOpenRouterBaseUrl())
    applyEnvValue('ANTHROPIC_API_KEY', '')
    applyEnvValue('ANTHROPIC_AUTH_TOKEN', getOpenRouterAuthToken())
    applyEnvValue('ANTHROPIC_MODEL', route.model)
    applyEnvValue('ANTHROPIC_CUSTOM_MODEL_OPTION', route.model)
    applyEnvValue(
      'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
      `OpenRouter: ${route.model}`,
    )
    applyEnvValue(
      'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
      'Custom model over OpenRouter',
    )
    process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = '1'
    return
  }

  applyEnvValue('ANTHROPIC_BASE_URL', getOllamaBaseUrl())
  applyEnvValue('ANTHROPIC_API_KEY', getOllamaApiKey())
  applyEnvValue('ANTHROPIC_AUTH_TOKEN', '')
  applyEnvValue('ANTHROPIC_MODEL', route.model)
  applyEnvValue('ANTHROPIC_CUSTOM_MODEL_OPTION', route.model)
  applyEnvValue(
    'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
    `Ollama: ${route.model}`,
  )
  applyEnvValue(
    'ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION',
    'Custom model over Ollama Anthropic-compatible API',
  )
  process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = '1'
  process.env.DISABLE_TELEMETRY = '1'
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
}

export function applyModelSelectionEnvironment(
  modelSetting: string | null | undefined,
): void {
  if (modelSetting === AUTO_ALL_MODEL_ALIAS) {
    configureAutoAllRouting()
    return
  }

  if (modelSetting === AUTO_OPENROUTER_MODEL_ALIAS) {
    configureOpenRouterAutoRouting()
    return
  }

  if (modelSetting === AUTO_OLLAMA_MODEL_ALIAS) {
    configureOllamaAutoRouting()
    return
  }

  disableModelRouterEnvironment()
  delete process.env.BOTVALIA_MODEL_SELECTION
  if (isProviderRouteSpec(modelSetting ?? undefined)) {
    setFreeOnlyModeEnvironment(false, modelSetting ?? '')
    applyProviderRoute(modelSetting ?? undefined)
    return
  }

  clearFreeOnlyModeEnvironment()
  applyProviderRoute(undefined)
}
