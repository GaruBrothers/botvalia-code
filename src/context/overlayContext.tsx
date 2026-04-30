/**
 * Overlay tracking for Escape key coordination.
 *
 * This solves the problem of escape key handling when overlays (like Select with onCancel)
 * are open. The CancelRequestHandler needs to know when an overlay is active so it doesn't
 * cancel requests when the user just wants to dismiss the overlay.
 *
 * Usage:
 * 1. Call useRegisterOverlay() in any overlay component to automatically register it
 * 2. Call useIsOverlayActive() to check if any overlay is currently active
 *
 * The hook automatically registers on mount and unregisters on unmount,
 * so no manual cleanup or state management is needed.
 */
import { useContext, useEffect, useLayoutEffect } from 'react'
import instances from '../ink/instances.js'
import { AppStoreContext, useAppState } from '../state/AppState.js'

// Non-modal overlays that shouldn't disable TextInput focus
const NON_MODAL_OVERLAYS = new Set(['autocomplete'])

/**
 * Hook to register a component as an active overlay.
 * Automatically registers on mount and unregisters on unmount.
 *
 * @param id - Unique identifier for this overlay (e.g., 'select', 'multi-select')
 * @param enabled - Whether to register (default: true). Use this to conditionally register
 *                  based on component props, e.g., only register when onCancel is provided.
 */
export function useRegisterOverlay(id: string, enabled = true): void {
  // Use context directly so this is a no-op when rendered outside AppStateProvider
  // (e.g., in isolated component tests that don't need the full app state tree).
  const store = useContext(AppStoreContext)
  const setAppState = store?.setState

  useEffect(() => {
    if (!enabled || !setAppState) return

    setAppState(prev => {
      if (prev.activeOverlays.has(id)) return prev
      const next = new Set(prev.activeOverlays)
      next.add(id)
      return { ...prev, activeOverlays: next }
    })

    return () => {
      setAppState(prev => {
        if (!prev.activeOverlays.has(id)) return prev
        const next = new Set(prev.activeOverlays)
        next.delete(id)
        return { ...prev, activeOverlays: next }
      })
    }
  }, [id, enabled, setAppState])

  // On overlay close, force the next render to full-damage diff instead
  // of blit. A tall overlay can otherwise leave stale cells behind.
  useLayoutEffect(() => {
    if (!enabled) return
    return () => instances.get(process.stdout)?.invalidatePrevFrame()
  }, [enabled])
}

/**
 * Hook to check if any overlay is currently active.
 * This is reactive - the component will re-render when the overlay state changes.
 */
export function useIsOverlayActive(): boolean {
  return useAppState(s => s.activeOverlays.size > 0)
}

/**
 * Hook to check if any modal overlay is currently active.
 * Modal overlays are overlays that should capture all input (like Select dialogs).
 * Non-modal overlays (like autocomplete) don't disable TextInput focus.
 */
export function useIsModalOverlayActive(): boolean {
  return useAppState(s => {
    for (const id of s.activeOverlays) {
      if (!NON_MODAL_OVERLAYS.has(id)) return true
    }
    return false
  })
}
