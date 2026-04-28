import type { LocalJSXCommandOnDone } from '../../types/command.js'

export type PluginManagementAction = 'enable' | 'disable' | 'uninstall'
export type MarketplaceManagementAction = 'update' | 'remove'

type ViewStateBase = {
  targetMarketplace?: string
  targetPlugin?: string
}

export type ViewState =
  | (ViewStateBase & { type: 'menu' })
  | (ViewStateBase & { type: 'help' })
  | (ViewStateBase & { type: 'validate'; path?: string })
  | (ViewStateBase & { type: 'discover-plugins'; targetPlugin?: string })
  | (ViewStateBase & {
      type: 'browse-marketplace'
      targetMarketplace?: string
      targetPlugin?: string
    })
  | (ViewStateBase & {
      type: 'manage-plugins'
      targetPlugin?: string
      targetMarketplace?: string
      action?: PluginManagementAction
    })
  | (ViewStateBase & { type: 'marketplace-list' })
  | (ViewStateBase & { type: 'add-marketplace'; initialValue?: string })
  | (ViewStateBase & {
      type: 'manage-marketplaces'
      targetMarketplace?: string
      action?: MarketplaceManagementAction
    })
  | (ViewStateBase & { type: 'marketplace-menu' })

export type PluginSettingsProps = {
  onComplete: LocalJSXCommandOnDone
  args?: string
  showMcpRedirectMessage?: boolean
}
