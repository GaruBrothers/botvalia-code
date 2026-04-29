import { isEnvTruthy } from '../envUtils.js'
import { parseUserSpecifiedModel } from './model.js'

export type ProviderRouteKind = 'anthropic' | 'openrouter' | 'ollama'

export type ProviderRoute = {
  raw: string
  kind: ProviderRouteKind
  model: string
}

const ROUTE_SEPARATOR = '::'

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
    ) || 'http://localhost:4000'
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
    'Custom model over Ollama-compatible proxy',
  )
  process.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = '1'
  process.env.DISABLE_TELEMETRY = '1'
  process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
}
