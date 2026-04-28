import { throwUnavailableFeature } from '../../utils/unavailableFeature.js'

export async function templatesMain(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Template jobs')
}
