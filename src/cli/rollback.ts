import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function rollback(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Native rollback')
}
