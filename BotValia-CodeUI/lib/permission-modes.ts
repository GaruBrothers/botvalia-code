import type { PermissionMode } from './types'

export function formatPermissionModeLabel(mode: PermissionMode): string {
  switch (mode) {
    case 'acceptEdits':
      return 'Accept edits'
    case 'bypassPermissions':
      return 'Bypass'
    case 'dontAsk':
      return "Don't ask"
    case 'plan':
      return 'Plan'
    case 'auto':
      return 'Auto'
    case 'bubble':
      return 'Bubble'
    default:
      return 'Manual'
  }
}

export function getNextPermissionMode(
  currentMode: PermissionMode,
  options: {
    isBypassPermissionsModeAvailable: boolean
    isAutoModeAvailable: boolean
  },
): PermissionMode {
  switch (currentMode) {
    case 'default':
      return 'acceptEdits'
    case 'acceptEdits':
      return 'plan'
    case 'plan':
      if (options.isBypassPermissionsModeAvailable) {
        return 'bypassPermissions'
      }
      if (options.isAutoModeAvailable) {
        return 'auto'
      }
      return 'default'
    case 'bypassPermissions':
      if (options.isAutoModeAvailable) {
        return 'auto'
      }
      return 'default'
    case 'dontAsk':
      return 'default'
    case 'bubble':
      return 'default'
    case 'auto':
    default:
      return 'default'
  }
}
