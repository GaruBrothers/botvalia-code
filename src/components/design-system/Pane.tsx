import type { ReactNode } from 'react'
import { useIsInsideModal } from '../../context/modalContext.js'
import { Box } from '../../ink.js'
import type { Color } from '../../ink/styles.js'
import type { Theme } from '../../utils/theme.js'
import { Divider } from './Divider.js'

type PaneProps = {
  children: ReactNode
  /**
   * Theme color or raw color for the top border line.
   */
  color?: keyof Theme | Color
}

/**
 * A pane — a region of the terminal that appears below the REPL prompt,
 * bounded by a colored top line with a one-row gap above and horizontal
 * padding. Used by all slash-command screens: /config, /help, /plugins,
 * /sandbox, /stats, /permissions.
 *
 * For confirm/cancel dialogs (Esc to dismiss, Enter to confirm), use
 * `<Dialog>` instead — it registers its own keybindings.
 *
 * @example
 * <Pane color="permission">
 *   <Tabs title="Sandbox:">...</Tabs>
 * </Pane>
 */
export function Pane({
  children,
  color,
}: PaneProps): ReactNode {
  const accentColor = color ?? 'paneBorder'

  if (useIsInsideModal()) {
    return (
      <Box flexDirection="column" flexShrink={0}>
        <Box flexDirection="column" paddingX={1} backgroundColor="paneBackground">
          {children}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Divider color={accentColor} />
      <Box paddingX={1}>
        <Box flexDirection="column" paddingX={1} backgroundColor="paneBackground">
          {children}
        </Box>
      </Box>
    </Box>
  )
}
