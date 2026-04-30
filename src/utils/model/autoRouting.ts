import type { Message } from '../../types/message.js'
import { logError } from '../log.js'
import { getContentText } from '../messages.js'
import { normalizeModelCandidate } from './providerRouting.js'

export type AutoRouteTier = 'code' | 'complex' | 'fast'

export type AutoRouteSelection = {
  model: string
  fallbackModels?: string[]
  routeSpec?: string
  fallbackRouteSpecs?: Array<string | undefined>
  tier: AutoRouteTier
}

const codingIntentPattern =
  /\b(code|coding|program|programming|debug|bug|fix|refactor|function|class|method|typescript|javascript|ts|js|python|java|c#|csharp|sql|api|endpoint|test|tests|stacktrace|compile|build|lint|archivo|archivos|codigo|codificar|programar|depurar|error|errores|arreglar|refactorizar|funcion|clase|metodo|prueba|pruebas|compilar)\b/i
const complexIntentPattern =
  /\b(architecture|arquitectura|analyze|analysis|analiza|analisis|investigate|investigar|deep|profundo|complex|complejo|optimize|optimizar|performance|rendimiento|security|seguridad|migration|migracion|migrate|plan|strategy|estrategia|compare|comparar|scalable|escalable|production|produccion|root cause|causa raiz|multi-step|multistep)\b/i

const defaultCodeModel = 'sonnet'
const defaultComplexModel = 'sonnet'
const defaultFastModel = 'haiku'
const defaultCodeFallbacks = ['opus', 'haiku']
const defaultComplexFallbacks = ['opus', 'haiku']
const defaultFastFallbacks = ['sonnet']

export function getAutoRoutedSelection(
  inputMessages: Message[],
  currentModel: string,
  currentFallbackModels?: string[],
): AutoRouteSelection | undefined {
  if (!isModelRouterEnabled()) {
    return undefined
  }

  const promptText = extractLatestUserText(inputMessages)
  if (!promptText) {
    return undefined
  }

  const tier = classifyPromptTier(promptText)
  const primaryCandidate = getPrimaryCandidate(tier)
  const fallbackCandidates = getFallbackCandidates(tier)
  const parsedPrimary = safeNormalizeModelCandidate(primaryCandidate)

  const routedPrimary = parsedPrimary?.model ?? currentModel
  const routeSpec = parsedPrimary?.routeSpec

  const parsedFallbacks = [
    ...fallbackCandidates,
    ...(currentFallbackModels ?? []),
  ]
    .map(candidate => safeNormalizeModelCandidate(candidate))
    .filter(
      (candidate): candidate is { model: string; routeSpec?: string } =>
        Boolean(candidate) && candidate.model !== routedPrimary,
    )
    .filter(
      (candidate, index, arr) =>
        arr.findIndex(
          item =>
            item.model === candidate.model &&
            item.routeSpec === candidate.routeSpec,
        ) === index,
    )

  const fallbackModels =
    parsedFallbacks.length > 0
      ? parsedFallbacks.map(candidate => candidate.model)
      : undefined
  const fallbackRouteSpecs =
    parsedFallbacks.length > 0
      ? parsedFallbacks.map(candidate => candidate.routeSpec)
      : undefined
  const currentParsedFallbacks = (currentFallbackModels ?? [])
    .map(candidate => safeNormalizeModelCandidate(candidate))
    .filter(
      (candidate): candidate is { model: string; routeSpec?: string } =>
        Boolean(candidate),
    )
  const currentNormalizedFallbackModels = currentParsedFallbacks.map(
    candidate => candidate.model,
  )
  const currentFallbackRouteSpecs = currentParsedFallbacks.map(
    candidate => candidate.routeSpec,
  )

  if (
    routedPrimary === currentModel &&
    routeSpec === undefined &&
    JSON.stringify(fallbackModels ?? []) ===
      JSON.stringify(currentNormalizedFallbackModels) &&
    JSON.stringify(fallbackRouteSpecs ?? []) ===
      JSON.stringify(currentFallbackRouteSpecs)
  ) {
    return undefined
  }

  return {
    model: routedPrimary,
    fallbackModels,
    routeSpec,
    fallbackRouteSpecs,
    tier,
  }
}

function classifyPromptTier(promptText: string): AutoRouteTier {
  if (codingIntentPattern.test(promptText)) {
    return 'code'
  }

  const wordCount = promptText.split(/\s+/).filter(Boolean).length
  if (
    complexIntentPattern.test(promptText) ||
    wordCount >= 40 ||
    promptText.includes('\n')
  ) {
    return 'complex'
  }

  return 'fast'
}

function getPrimaryCandidate(tier: AutoRouteTier): string {
  if (tier === 'code') {
    return process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL?.trim() || defaultCodeModel
  }

  if (tier === 'complex') {
    return (
      process.env.BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL?.trim() ||
      process.env.BOTVALIA_MODEL_ROUTER_CODE_MODEL?.trim() ||
      defaultComplexModel
    )
  }

  return process.env.BOTVALIA_MODEL_ROUTER_FAST_MODEL?.trim() || defaultFastModel
}

function getFallbackCandidates(tier: AutoRouteTier): string[] {
  const envVar =
    tier === 'code'
      ? getFirstDefinedEnv(
          'BOTVALIA_MODEL_ROUTER_CODE_CHAIN',
          'BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS',
        )
      : tier === 'complex'
        ? getFirstDefinedEnv(
            'BOTVALIA_MODEL_ROUTER_COMPLEX_CHAIN',
            'BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS',
            'BOTVALIA_MODEL_ROUTER_CODE_CHAIN',
            'BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS',
          )
        : getFirstDefinedEnv(
            'BOTVALIA_MODEL_ROUTER_FAST_CHAIN',
            'BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS',
          )
  const defaults =
    tier === 'code'
      ? defaultCodeFallbacks
      : tier === 'complex'
        ? defaultComplexFallbacks
        : defaultFastFallbacks

  if (envVar === undefined) {
    return defaults
  }
  if (!envVar.trim()) {
    return []
  }
  return envVar
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function safeNormalizeModelCandidate(
  candidate: string,
): { model: string; routeSpec?: string } | undefined {
  if (!candidate) return undefined
  try {
    return normalizeModelCandidate(candidate)
  } catch (error) {
    logError(error)
    return undefined
  }
}

function getFirstDefinedEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function isModelRouterEnabled(): boolean {
  const raw = process.env.BOTVALIA_MODEL_ROUTER_ENABLED
  if (raw === undefined) {
    return true
  }

  return raw !== '' && raw !== '0' && raw.toLowerCase() !== 'false'
}

function extractLatestUserText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message || message.type !== 'user') continue
    if (message.isMeta || message.toolUseResult) continue
    const text = getContentText(message.message.content as never)
    if (text && text.trim()) {
      return text.trim()
    }
  }
  return ''
}
