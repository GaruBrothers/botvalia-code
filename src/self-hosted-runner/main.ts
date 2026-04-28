import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function selfHostedRunnerMain(
  ..._args: unknown[]
): Promise<never> {
  throwUnavailableFeature('Self-hosted runner')
}
