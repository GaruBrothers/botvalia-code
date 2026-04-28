import { throwUnavailableFeature } from '../../utils/unavailableFeature.js'

export async function logHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT log handler')
}

export async function errorHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT error handler')
}

export async function exportHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT export handler')
}

export async function taskCreateHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT task create handler')
}

export async function taskListHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT task list handler')
}

export async function taskGetHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT task get handler')
}

export async function taskUpdateHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT task update handler')
}

export async function taskDirHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT task dir handler')
}

export async function completionHandler(..._args: unknown[]): Promise<never> {
  throwUnavailableFeature('ANT completion handler')
}
