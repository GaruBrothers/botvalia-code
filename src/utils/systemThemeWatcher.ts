import type { SystemTheme } from './systemTheme.js'

export function watchSystemTheme(
  _internalQuerier: unknown,
  _onTheme: (theme: SystemTheme) => void,
): () => void {
  return () => {}
}
