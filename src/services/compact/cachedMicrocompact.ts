export type CachedMCEditsBlock = {
  type: 'cache_edits'
  edits: { type: 'delete'; cache_reference: string }[]
}

export type CacheEditsBlock = CachedMCEditsBlock

export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

export type CachedMCState = {
  pinnedEdits: PinnedCacheEdits[]
  registeredTools: Set<string>
  toolOrder: string[]
  deletedRefs: Set<string>
}

export type CachedMCConfig = {
  enabled: boolean
  supportedModels: string[]
  triggerThreshold: number
  keepRecent: number
  systemPromptSuggestSummaries: boolean
}

const DEFAULT_CONFIG: CachedMCConfig = {
  enabled: false,
  supportedModels: [],
  triggerThreshold: 0,
  keepRecent: 0,
  systemPromptSuggestSummaries: false,
}

export function getCachedMCConfig(): CachedMCConfig {
  return DEFAULT_CONFIG
}

export function isCachedMicrocompactEnabled(): boolean {
  return DEFAULT_CONFIG.enabled
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false
}

export function createCachedMCState(): CachedMCState {
  return {
    pinnedEdits: [],
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
  }
}

export function markToolsSentToAPI(_state: CachedMCState): void {}

export function resetCachedMCState(state: CachedMCState): void {
  state.pinnedEdits.length = 0
  state.registeredTools.clear()
  state.toolOrder.length = 0
  state.deletedRefs.clear()
}

export function registerToolResult(
  state: CachedMCState,
  toolUseId: string,
): void {
  if (!state.registeredTools.has(toolUseId)) {
    state.registeredTools.add(toolUseId)
    state.toolOrder.push(toolUseId)
  }
}

export function registerToolMessage(
  _state: CachedMCState,
  _toolUseIds: string[],
): void {}

export function getToolResultsToDelete(_state: CachedMCState): string[] {
  return []
}

export function createCacheEditsBlock(
  _state: CachedMCState,
  toolUseIds: string[],
): CacheEditsBlock | null {
  if (toolUseIds.length === 0) {
    return null
  }

  return {
    type: 'cache_edits',
    edits: toolUseIds.map(cache_reference => ({
      type: 'delete' as const,
      cache_reference,
    })),
  }
}
