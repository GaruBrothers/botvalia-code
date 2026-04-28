import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function environmentRunnerMain(
  ..._args: unknown[]
): Promise<never> {
  throwUnavailableFeature('Environment runner')
}
