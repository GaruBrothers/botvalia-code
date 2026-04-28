import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function runDaemonWorker(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Daemon workers')
}
