import type { CacheSafeParams } from './forkedAgent.js'

export function shouldGenerateTaskSummary(): boolean {
  return false
}

export function maybeGenerateTaskSummary(
  _params: CacheSafeParams,
): Promise<void> {
  return Promise.resolve()
}

export function summarizeTask(): string {
  return ''
}
