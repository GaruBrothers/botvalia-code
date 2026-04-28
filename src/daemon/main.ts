import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function daemonMain(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Daemon mode')
}
