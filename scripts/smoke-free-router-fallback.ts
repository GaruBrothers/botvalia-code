import {
  applyProviderRoute,
  normalizeModelCandidate,
  parseProviderRoute,
} from '../src/utils/model/providerRouting.js'

type FallbackTarget = {
  model: string
  routeSpec?: string
}

type AttemptSnapshot = {
  step: number
  activeModel: string
  activeRouteSpec?: string
  activeProvider?: string
  baseUrl?: string
}

function sameFallbackTarget(
  left: FallbackTarget,
  right: FallbackTarget,
): boolean {
  return left.model === right.model && left.routeSpec === right.routeSpec
}

function buildFallbackQueue(
  fallbackModels?: string[],
  fallbackRouteSpecs?: Array<string | undefined>,
): FallbackTarget[] {
  const length = Math.max(
    fallbackModels?.length ?? 0,
    fallbackRouteSpecs?.length ?? 0,
  )
  const targets: FallbackTarget[] = []

  for (let index = 0; index < length; index++) {
    const fallbackCandidate = fallbackModels?.[index]
    const normalizedFallback =
      fallbackCandidate !== undefined
        ? normalizeModelCandidate(fallbackCandidate)
        : undefined
    const routeSpec = fallbackRouteSpecs?.[index] ?? normalizedFallback?.routeSpec
    const model =
      (routeSpec ? normalizeModelCandidate(routeSpec).model : undefined) ??
      normalizedFallback?.model

    if (!model) {
      continue
    }

    const target = { model, routeSpec }
    if (!targets.some(existing => sameFallbackTarget(existing, target))) {
      targets.push(target)
    }
  }

  return targets
}

function resolveFallbackTarget(
  fallbackValue: string,
  fallbackQueue: FallbackTarget[],
): FallbackTarget {
  return (
    fallbackQueue.find(
      candidate =>
        candidate.routeSpec === fallbackValue || candidate.model === fallbackValue,
    ) ?? { model: fallbackValue }
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function captureSnapshot(step: number, routeSpec?: string): AttemptSnapshot {
  return {
    step,
    activeModel: process.env.ANTHROPIC_MODEL || '',
    activeRouteSpec: routeSpec,
    activeProvider: process.env.BOTVALIA_ACTIVE_PROVIDER,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
  }
}

function validateAppliedRoute(target: FallbackTarget): void {
  assert(target.routeSpec, `Missing routeSpec for ${target.model}`)
  const parsed = parseProviderRoute(target.routeSpec)
  assert(parsed, `Could not parse route spec ${target.routeSpec}`)

  if (parsed.kind === 'openrouter') {
    assert(
      (process.env.ANTHROPIC_BASE_URL || '').includes('openrouter.ai'),
      `Expected OpenRouter base URL for ${target.routeSpec}, got ${process.env.ANTHROPIC_BASE_URL || '<empty>'}`,
    )
  }

  if (parsed.kind === 'ollama') {
    assert(
      (process.env.ANTHROPIC_BASE_URL || '').includes('11434'),
      `Expected Ollama base URL for ${target.routeSpec}, got ${process.env.ANTHROPIC_BASE_URL || '<empty>'}`,
    )
  }

  assert(
    process.env.ANTHROPIC_MODEL === parsed.model,
    `Expected active model ${parsed.model}, got ${process.env.ANTHROPIC_MODEL || '<empty>'}`,
  )
}

function main(): void {
  const asJson = process.argv.includes('--json')
  const primary = normalizeModelCandidate('openrouter::openrouter/free')
  const fallbackModels = [
    'sonnet',
    'haiku',
    'openai/gpt-oss-20b:free',
    'openai/gpt-oss-20b:free',
  ]
  const fallbackRouteSpecs = [
    'openrouter::invalid-primary-1',
    'openrouter::invalid-primary-2',
    'openrouter::openai/gpt-oss-20b:free',
    'openrouter::openai/gpt-oss-20b:free',
  ]

  const queue = buildFallbackQueue(fallbackModels, fallbackRouteSpecs)

  assert(primary.routeSpec, 'Primary route spec was not preserved')
  assert(queue.length === 3, `Expected 3 unique fallback targets, got ${queue.length}`)
  assert(
    queue[0]?.model === 'invalid-primary-1',
    `Expected first fallback to prefer routeSpec model invalid-primary-1, got ${queue[0]?.model || '<missing>'}`,
  )
  assert(
    queue[1]?.model === 'invalid-primary-2',
    `Expected second fallback invalid-primary-2, got ${queue[1]?.model || '<missing>'}`,
  )
  assert(
    queue[2]?.model === 'openai/gpt-oss-20b:free',
    `Expected terminal fallback openai/gpt-oss-20b:free, got ${queue[2]?.model || '<missing>'}`,
  )

  applyProviderRoute(primary.routeSpec)
  validateAppliedRoute(primary)

  let currentTarget: FallbackTarget = {
    model: primary.model,
    routeSpec: primary.routeSpec,
  }
  let fallbackQueue = [...queue]
  const attempts: AttemptSnapshot[] = [captureSnapshot(0, currentTarget.routeSpec)]
  const forcedFailures = new Set(
    [
      currentTarget.routeSpec ?? currentTarget.model,
      ...fallbackQueue
        .slice(0, 2)
        .map(candidate => candidate.routeSpec ?? candidate.model),
    ].filter(Boolean),
  )

  let step = 1
  while (
    currentTarget.routeSpec &&
    forcedFailures.has(currentTarget.routeSpec) &&
    fallbackQueue.length > 0
  ) {
    const nextFallback = resolveFallbackTarget(
      fallbackQueue[0]?.routeSpec ?? fallbackQueue[0]?.model ?? '',
      fallbackQueue,
    )
    assert(
      Boolean(nextFallback.routeSpec),
      `Next fallback ${nextFallback.model} lost route spec`,
    )
    currentTarget = nextFallback
    applyProviderRoute(currentTarget.routeSpec)
    validateAppliedRoute(currentTarget)
    fallbackQueue = fallbackQueue.filter(
      candidate => !sameFallbackTarget(candidate, nextFallback),
    )
    attempts.push(captureSnapshot(step, currentTarget.routeSpec))
    step++
  }

  assert(
    currentTarget.model === 'openai/gpt-oss-20b:free',
    `Expected final model openai/gpt-oss-20b:free, got ${currentTarget.model}`,
  )
  assert(
    currentTarget.routeSpec === 'openrouter::openai/gpt-oss-20b:free',
    `Expected final routeSpec openrouter::openai/gpt-oss-20b:free, got ${currentTarget.routeSpec || '<empty>'}`,
  )
  assert(fallbackQueue.length === 0, `Expected empty queue after rotations, got ${fallbackQueue.length}`)

  const result = {
    ok: true,
    primary,
    attempts,
    final: currentTarget,
    validated: {
      dedupedFallbackCount: queue.length,
      routeSpecPrecedence: true,
      providerSwitching: true,
    },
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  process.stdout.write('Smoke free router fallback: OK\n')
  process.stdout.write(`Primary: ${primary.routeSpec}\n`)
  for (const attempt of attempts) {
    process.stdout.write(
      `Step ${attempt.step}: ${attempt.activeRouteSpec} -> ${attempt.activeModel} (${attempt.baseUrl || 'no-base-url'})\n`,
    )
  }
}

main()
