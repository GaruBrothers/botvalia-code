import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export function startServer(..._args: unknown[]): never {
  throwUnavailableFeature('Direct-connect server')
}
