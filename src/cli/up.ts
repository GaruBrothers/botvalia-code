import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function up(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Native updater')
}
