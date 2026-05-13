import type { ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Ansi, Text } from '../../ink.js'
import type { Color } from '../../ink/styles.js'
import type { Theme } from '../../utils/theme.js'

type DividerProps = {
  /**
   * Width of the divider in characters.
   * Defaults to terminal width.
   */
  width?: number

  /**
   * Theme color or raw color for the divider.
   * If not provided, the theme's divider tone is used.
   */
  color?: keyof Theme | Color

  /**
   * Optional theme color or raw color for the divider title.
   */
  titleColor?: keyof Theme | Color

  /**
   * Character to use for the divider line.
   * @default '─'
   */
  char?: string

  /**
   * Padding to subtract from the width (e.g., for indentation).
   * @default 0
   */
  padding?: number

  /**
   * Title shown in the middle of the divider.
   * May contain ANSI codes (e.g., chalk-styled text).
   *
   * @example
   * // ─────────── Title ───────────
   * <Divider title="Title" />
   */
  title?: string
}

/**
 * A horizontal divider line.
 *
 * @example
 * // Full-width softly themed divider
 * <Divider />
 *
 * @example
 * // Colored divider
 * <Divider color="suggestion" />
 *
 * @example
 * // Fixed width
 * <Divider width={40} />
 *
 * @example
 * // Full width minus padding (for indented content)
 * <Divider padding={4} />
 *
 * @example
 * // With centered title
 * <Divider title="3 new messages" />
 */
export function Divider({
  width,
  color,
  titleColor,
  char = '─',
  padding = 0,
  title,
}: DividerProps): ReactNode {
  const { columns: terminalWidth } = useTerminalSize()
  const effectiveWidth = Math.max(0, (width ?? terminalWidth) - padding)
  const lineColor = color ?? 'divider'
  const labelColor = titleColor ?? color ?? 'dividerText'

  if (!title) {
    return <Text color={lineColor}>{char.repeat(effectiveWidth)}</Text>
  }

  const titleWidth = stringWidth(title) + 2

  if (effectiveWidth <= titleWidth) {
    return (
      <Text color={labelColor}>
        <Ansi>{title}</Ansi>
      </Text>
    )
  }

  const sideWidth = Math.max(0, effectiveWidth - titleWidth)
  const leftWidth = Math.floor(sideWidth / 2)
  const rightWidth = sideWidth - leftWidth

  return (
    <Text color={lineColor}>
      {char.repeat(leftWidth)}
      <Text color={labelColor}>
        {' '}
        <Ansi>{title}</Ansi>
        {' '}
      </Text>
      {char.repeat(rightWidth)}
    </Text>
  )
}
