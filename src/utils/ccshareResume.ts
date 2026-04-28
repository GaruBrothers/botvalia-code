import type { LogOption } from '../types/logs.js'
import { throwUnavailableFeature } from './unavailableFeature.js'

export function parseCcshareId(_value: string): string | null {
  return null
}

export async function loadCcshare(_ccshareId: string): Promise<LogOption> {
  throwUnavailableFeature('ccshare resume')
}
