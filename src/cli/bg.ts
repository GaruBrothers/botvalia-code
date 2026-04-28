import { throwUnavailableFeature } from '../utils/unavailableFeature.js'

export async function psHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Background session listing')
}

export async function logsHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Background session logs')
}

export async function attachHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Background session attach')
}

export async function killHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Background session kill')
}

export async function handleBgFlag(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('Background session mode')
}
