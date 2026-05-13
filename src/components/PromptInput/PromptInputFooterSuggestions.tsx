import * as React from 'react'
import { memo, type ReactNode } from 'react'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text } from '../../ink.js'
import { truncatePathMiddle, truncateToWidth } from '../../utils/format.js'
import type { Theme } from '../../utils/theme.js'

export type SuggestionItem = {
  id: string
  displayText: string
  tag?: string
  description?: string
  metadata?: unknown
  color?: keyof Theme
}

export type SuggestionType =
  | 'command'
  | 'file'
  | 'directory'
  | 'agent'
  | 'shell'
  | 'custom-title'
  | 'slack-channel'
  | 'none'

export const OVERLAY_MAX_ITEMS = 5

const CARD_BACKGROUND: keyof Theme = 'messageActionsBackground'
const CARD_BORDER: keyof Theme = 'promptBorder'
const SELECTED_ROW_BACKGROUND: keyof Theme = 'userMessageBackground'

function getIcon(itemId: string): string {
  if (itemId.startsWith('file-')) return '+'
  if (itemId.startsWith('mcp-resource-')) return '◇'
  if (itemId.startsWith('agent-')) return '*'
  return '+'
}

function isUnifiedSuggestion(itemId: string): boolean {
  return (
    itemId.startsWith('file-') ||
    itemId.startsWith('mcp-resource-') ||
    itemId.startsWith('agent-')
  )
}

function normalizeInlineText(value?: string): string {
  return value?.replace(/\s+/g, ' ') ?? ''
}

const SuggestionItemRow = memo(function SuggestionItemRow({
  item,
  maxColumnWidth,
  isSelected,
}: {
  item: SuggestionItem
  maxColumnWidth?: number
  isSelected: boolean
}): ReactNode {
  const { columns } = useTerminalSize()
  const rowPrefix = isSelected ? '> ' : '  '
  const rowBackground = isSelected ? SELECTED_ROW_BACKGROUND : undefined
  const prefixColor: keyof Theme = isSelected ? 'suggestion' : 'inactive'
  const titleColor: keyof Theme = item.color ?? (isSelected ? 'suggestion' : 'text')
  const description = normalizeInlineText(item.description)

  if (isUnifiedSuggestion(item.id)) {
    const icon = getIcon(item.id)
    const isFile = item.id.startsWith('file-')
    const isMcpResource = item.id.startsWith('mcp-resource-')
    const descReserve = description ? Math.min(24, stringWidth(description)) + 3 : 0
    const maxTitleWidth = Math.max(8, columns - stringWidth(rowPrefix) - 2 - descReserve)

    let displayText = item.displayText
    if (isFile) {
      displayText = truncatePathMiddle(displayText, maxTitleWidth)
    } else if (isMcpResource) {
      displayText = truncateToWidth(displayText, Math.min(maxTitleWidth, 36))
    } else {
      displayText = truncateToWidth(displayText, maxTitleWidth)
    }

    const maxDescriptionWidth = Math.max(
      0,
      columns - stringWidth(rowPrefix) - 2 - stringWidth(displayText) - 3,
    )
    const truncatedDescription = description
      ? truncateToWidth(description, maxDescriptionWidth)
      : ''

    return (
      <Text wrap="truncate" backgroundColor={rowBackground}>
        <Text color={prefixColor}>
          {rowPrefix}
          {icon}
          {' '}
        </Text>
        <Text color={titleColor} bold={isSelected}>
          {displayText}
        </Text>
        {truncatedDescription ? (
          <Text color={isSelected ? 'text' : 'inactive'} dimColor={!isSelected}>
            {' · '}
            {truncatedDescription}
          </Text>
        ) : null}
      </Text>
    )
  }

  const maxNameWidth = Math.floor(columns * 0.4)
  const displayTextWidth = Math.max(
    8,
    Math.min(maxColumnWidth ?? stringWidth(item.displayText) + 5, maxNameWidth),
  )
  const titleText =
    stringWidth(item.displayText) > displayTextWidth - 1
      ? truncateToWidth(item.displayText, displayTextWidth - 1)
      : item.displayText
  const paddedTitle =
    titleText + ' '.repeat(Math.max(0, displayTextWidth - stringWidth(titleText)))
  const tagText = item.tag ? `[${item.tag}]` : ''
  const descriptionWidth = Math.max(
    0,
    columns - stringWidth(rowPrefix) - displayTextWidth - stringWidth(tagText) - (tagText ? 4 : 1),
  )
  const truncatedDescription = description
    ? truncateToWidth(description, descriptionWidth)
    : ''

  return (
    <Text wrap="truncate" backgroundColor={rowBackground}>
      <Text color={prefixColor}>{rowPrefix}</Text>
      <Text color={titleColor} bold={isSelected}>
        {paddedTitle}
      </Text>
      {tagText ? (
        <Text color={isSelected ? 'suggestion' : 'inactive'}>
          {' '}
          {tagText}
        </Text>
      ) : null}
      {truncatedDescription ? (
        <Text color={isSelected ? 'text' : 'inactive'} dimColor={!isSelected}>
          {' · '}
          {truncatedDescription}
        </Text>
      ) : null}
    </Text>
  )
})

type Props = {
  suggestions: SuggestionItem[]
  selectedSuggestion: number
  maxColumnWidth?: number
  overlay?: boolean
}

export function PromptInputFooterSuggestions({
  suggestions,
  selectedSuggestion,
  maxColumnWidth: maxColumnWidthProp,
  overlay,
}: Props): ReactNode {
  const { rows } = useTerminalSize()
  const maxVisibleItems = overlay
    ? OVERLAY_MAX_ITEMS
    : Math.min(6, Math.max(1, rows - 3))

  if (suggestions.length === 0) {
    return null
  }

  const maxColumnWidth =
    maxColumnWidthProp ??
    Math.max(...suggestions.map(item => stringWidth(item.displayText))) + 5
  const startIndex = Math.max(
    0,
    Math.min(
      selectedSuggestion - Math.floor(maxVisibleItems / 2),
      suggestions.length - maxVisibleItems,
    ),
  )
  const endIndex = Math.min(startIndex + maxVisibleItems, suggestions.length)
  const visibleItems = suggestions.slice(startIndex, endIndex)
  const hiddenAbove = startIndex
  const hiddenBelow = suggestions.length - endIndex
  const selectedPosition = Math.min(
    Math.max(selectedSuggestion + 1, 1),
    suggestions.length,
  )

  return (
    <Box
      flexDirection="column"
      justifyContent={overlay ? undefined : 'flex-end'}
      borderStyle="round"
      borderColor={CARD_BORDER}
      backgroundColor={CARD_BACKGROUND}
    >
      {overlay ? (
        <Box paddingX={1}>
          <Text color="inactive" wrap="truncate">
            suggestions{' '}
            <Text color="suggestion" bold>
              {selectedPosition}/{suggestions.length}
            </Text>
            {hiddenAbove > 0 ? (
              <Text dimColor>
                {' · '}
                {hiddenAbove} above
              </Text>
            ) : null}
            {hiddenBelow > 0 ? (
              <Text dimColor>
                {' · '}
                {hiddenBelow} below
              </Text>
            ) : null}
          </Text>
        </Box>
      ) : null}
      <Box flexDirection="column" paddingX={1}>
        {visibleItems.map(item => (
          <SuggestionItemRow
            key={item.id}
            item={item}
            maxColumnWidth={maxColumnWidth}
            isSelected={item.id === suggestions[selectedSuggestion]?.id}
          />
        ))}
      </Box>
    </Box>
  )
}

export default memo(PromptInputFooterSuggestions)
