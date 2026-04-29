import { isEnvTruthy } from '../envUtils.js'
import { parseUserSpecifiedModel } from './model.js'

export type ProviderRouteKind = 'anthropic' | 'openrouter' | 'ollama'

export type ProviderRoute = {
  raw: string
  kind: ProviderRouteKind
  model: string
}

const ROUTE_SEPARATOR = '::'
const OPENROUTER_AUTO_FAST_MODEL = 'openrouter::openrouter/free'
const OPENROUTER_AUTO_FAST_FALLBACKS = [
  'openrouter::google/gemma-4-26b-a4b-it:free',
  'openrouter::openai/gpt-oss-20b:free',
]
const OPENROUTER_AUTO_COMPLEX_MODEL = 'openrouter::qwen/qwen3.6-plus:free'
const OPENROUTER_AUTO_COMPLEX_FALLBACKS = [
  'openrouter::openai/gpt-oss-120b:free',
  'openrouter::deepseek/deepseek-r1-0528:free',
]
const OPENROUTER_AUTO_CODE_MODEL = 'openrouter::qwen/qwen3-coder:free'
const OPENROUTER_AUTO_CODE_FALLBACKS = [
  'openrouter::qwen/qwen3.6-plus:free',
  'openrouter::openai/gpt-oss-120b:free',
]
const OLLAMA_AUTO_FAST_MODEL = 'ollama::llama3.2:3b'
const OLLAMA_AUTO_FAST_FALLBACKS = [
  'ollama::qwen2.5:3b',
  'ollama::qwen2.5-coder:7b',
]
const OLLAMA_AUTO_COMPLEX_MODEL = 'ollama::qwen2.5-coder:7b'
const OLLAMA_AUTO_COMPLEX_FALLBACKS = [
  'ollama::qwen3-coder',
  'ollama::llama3.1:8b',
]
const OLLAMA_AUTO_CODE_MODEL = 'ollama::qwen3-coder'
const OLLAMA_AUTO_CODE_FALLBACKS = [
  'ollama::qwen2.5-coder:7b',
  'ollama::deepseek-coder-v2:16b',
]

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim()
    }
  }
  return undefined
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

function configureOpenRouterAutoRouting(): void {
  clearModelRouterEnvironment()
  setFreeOnlyModeEnvironment(true, 'auto-openrouter')
  process.env.BOTVALIA_MODEL_ROUTER_ENABLED = '1'
  process.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL = OPENROUTER_AUTO_FAST_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS =
    OPENROUTER_AUTO_FAST_FALLBACKS.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL =
    OPENROUTER_AUTO_COMPLEX_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS =
    OPENROUTER_AUTO_COMPLEX_FALLBACKS.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL = OPENROUTER_AUTO_CODE_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS =
    OPENROUTER_AUTO_CODE_FALLBACKS.join(',')
  applyProviderRoute(OPENROUTER_AUTO_FAST_MODEL)
}

function configureOllamaAutoRouting(): void {
  clearModelRouterEnvironment()
  setFreeOnlyModeEnvironment(true, 'auto-ollama')
  process.env.BOTVALIA_MODEL_ROUTER_ENABLED = '1'
  process.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL = OLLAMA_AUTO_FAST_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS =
    OLLAMA_AUTO_FAST_FALLBACKS.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL = OLLAMA_AUTO_COMPLEX_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS =
    OLLAMA_AUTO_COMPLEX_FALLBACKS.join(',')
  process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL = OLLAMA_AUTO_CODE_MODEL
  process.env.BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS =
    OLLAMA_AUTO_CODE_FALLBACKS.join(',')
  applyProviderRoute(OLLAMA_AUTO_FAST_MODEL)
}

function getOpenRouterBaseUrl(): string {
  return (
    firstNonEmpty(
      process.env.BOTVALIA_OPENROUTER_BASE_URL,
      process.env.OPENROUTER_BASE_URL,
    ) || 'https://openrouter.ai/api'
  )
}

function getOpenRouterAuthToken(): string | undefined {
  const poolRaw = firstNonEmpty(
    process.env.BOTVALIA_OPENROUTER_API_KEYS,
    process.env.OPENROUTER_API_KEYS,
  )
  if (poolRaw) {
    const firstToken = poolRaw
      .split(/,|\n|\r\n|;/)
      .map(item => item.trim())
      .find(Boolean)
    if (firstToken) {
      return firstToken
    }
  }
  return firstNonEmpty(
    process.env.OPENROUTER_API_KEY,
    process.env.BOTVALIA_OPENROUTER_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
  )
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
  return (
    firstNonEmpty(
      process.env.BOTVALIA_OLLAMA_BASE_URL,
      process.env.OLLAMA_BASE_URL,
      process.env.BOTVALIA_LITELLM_BASE_URL,
      process.env.LITELLM_BASE_URL,
    ) || 'http://localhost:11434'
  )
}

function getOllamaApiKey(): string {
  return (
    firstNonEmpty(
      process.env.BOTVALIA_OLLAMA_API_KEY,
      process.env.OLLAMA_API_KEY,
      process.env.BOTVALIA_LITELLM_API_KEY,
      process.env.LITELLM_API_KEY,
      process.env.ANTHROPIC_API_KEY,
    ) || 'sk-local'
  )
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
  if (modelSetting === 'auto-openrouter') {
    configureOpenRouterAutoRouting()
    return
  }

  if (modelSetting === 'auto-ollama') {
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
