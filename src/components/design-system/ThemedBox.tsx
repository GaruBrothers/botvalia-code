import type { PropsWithChildren, ReactNode, Ref } from 'react'
import Box from '../../ink/components/Box.js'
import type { DOMElement } from '../../ink/dom.js'
import type { ClickEvent } from '../../ink/events/click-event.js'
import type { FocusEvent } from '../../ink/events/focus-event.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import type { Color, Styles } from '../../ink/styles.js'
import { getTheme, resolveThemeColor, type Theme } from '../../utils/theme.js'
import { useTheme } from './ThemeProvider.js'

type ThemedColorProps = {
  readonly borderColor?: keyof Theme | Color
  readonly borderTopColor?: keyof Theme | Color
  readonly borderBottomColor?: keyof Theme | Color
  readonly borderLeftColor?: keyof Theme | Color
  readonly borderRightColor?: keyof Theme | Color
  readonly backgroundColor?: keyof Theme | Color
}

type BaseStylesWithoutColors = Omit<
  Styles,
  | 'textWrap'
  | 'borderColor'
  | 'borderTopColor'
  | 'borderBottomColor'
  | 'borderLeftColor'
  | 'borderRightColor'
  | 'backgroundColor'
>

export type Props = BaseStylesWithoutColors &
  ThemedColorProps & {
    ref?: Ref<DOMElement>
    tabIndex?: number
    autoFocus?: boolean
    onClick?: (event: ClickEvent) => void
    onFocus?: (event: FocusEvent) => void
    onFocusCapture?: (event: FocusEvent) => void
    onBlur?: (event: FocusEvent) => void
    onBlurCapture?: (event: FocusEvent) => void
    onKeyDown?: (event: KeyboardEvent) => void
    onKeyDownCapture?: (event: KeyboardEvent) => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
  }

/**
 * Theme-aware Box component that resolves theme color keys to raw colors.
 * This wraps the base Box component with theme resolution for border colors.
 */
export default function ThemedBox({
  borderColor,
  borderTopColor,
  borderBottomColor,
  borderLeftColor,
  borderRightColor,
  backgroundColor,
  children,
  ref,
  ...rest
}: PropsWithChildren<Props>): ReactNode {
  const [themeName] = useTheme()
  const theme = getTheme(themeName)

  return (
    <Box
      ref={ref}
      borderColor={resolveThemeColor(borderColor, theme)}
      borderTopColor={resolveThemeColor(borderTopColor, theme)}
      borderBottomColor={resolveThemeColor(borderBottomColor, theme)}
      borderLeftColor={resolveThemeColor(borderLeftColor, theme)}
      borderRightColor={resolveThemeColor(borderRightColor, theme)}
      backgroundColor={resolveThemeColor(backgroundColor, theme)}
      {...rest}
    >
      {children}
    </Box>
  )
}
