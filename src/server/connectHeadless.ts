import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function runConnectHeadless(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Direct-connect headless mode')
}
