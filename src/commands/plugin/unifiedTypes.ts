import type { MCPServerConnection, ConfigScope } from '../../services/mcp/types.js'
import type { LoadedPlugin, PluginError } from '../../types/plugin.js'
import type { PersistablePluginScope } from '../../utils/plugins/pluginIdentifier.js'

export type UnifiedInstalledScope =
  | ConfigScope
  | PersistablePluginScope
  | 'builtin'
  | 'flagged'

export type UnifiedMcpStatus =
  | 'connected'
  | 'disabled'
  | 'pending'
  | 'needs-auth'
  | 'failed'

export type UnifiedMarketplaceItem = {
  id: string
  name: string
  description?: string
  source?: string
  totalPlugins?: number
  installedCount?: number
}

export type UnifiedInstalledPlugin = {
  type: 'plugin'
  id: string
  name: string
  description?: string
  marketplace: string
  scope: PersistablePluginScope | 'builtin'
  isEnabled: boolean
  errorCount: number
  errors: PluginError[]
  plugin: LoadedPlugin
  pendingEnable?: boolean
  pendingUpdate?: boolean
  pendingToggle?: 'will-enable' | 'will-disable'
}

export type UnifiedFailedPlugin = {
  type: 'failed-plugin'
  id: string
  name: string
  marketplace: string
  scope: PersistablePluginScope
  errorCount: number
  errors: PluginError[]
}

export type UnifiedFlaggedPlugin = {
  type: 'flagged-plugin'
  id: string
  name: string
  marketplace: string
  scope: 'flagged'
  reason: string
  text: string
  flaggedAt: string
}

export type UnifiedInstalledMcp = {
  type: 'mcp'
  id: string
  name: string
  description?: string
  scope: ConfigScope
  status: UnifiedMcpStatus
  client: MCPServerConnection
  indented?: boolean
}

export type UnifiedInstalledItem =
  | UnifiedInstalledPlugin
  | UnifiedFailedPlugin
  | UnifiedFlaggedPlugin
  | UnifiedInstalledMcp
