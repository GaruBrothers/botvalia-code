import figures from 'figures'
import * as React from 'react'
import { Box, Text } from 'src/ink.js'
import {
  AGENT_COLOR_TO_THEME_COLOR,
  AGENT_COLORS,
  type AgentColorName,
} from 'src/tools/AgentTool/agentColorManager.js'
import type { PromptInputMode } from 'src/types/textInputTypes.js'
import { getTeammateColor } from 'src/utils/teammate.js'
import type { Theme } from 'src/utils/theme.js'
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

type Props = {
  mode: PromptInputMode
  isLoading: boolean
  viewingAgentName?: string
  viewingAgentColor?: AgentColorName
}

function getTeammateThemeColor(): keyof Theme | undefined {
  if (!isAgentSwarmsEnabled()) {
    return undefined
  }

  const colorName = getTeammateColor()
  if (!colorName) {
    return undefined
  }

  if (AGENT_COLORS.includes(colorName as AgentColorName)) {
    return AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName]
  }

  return undefined
}

function PromptChar({
  isLoading,
  themeColor,
  symbol = figures.pointer,
}: {
  isLoading: boolean
  themeColor?: keyof Theme
  symbol?: string
}): React.ReactNode {
  return (
    <Text color={themeColor} dimColor={isLoading}>
      {symbol}{' '}
    </Text>
  )
}

export function PromptInputModeIndicator({
  mode,
  isLoading,
  viewingAgentName,
  viewingAgentColor,
}: Props): React.ReactNode {
  const teammateColor = getTeammateThemeColor()
  const viewedTeammateThemeColor = viewingAgentColor
    ? AGENT_COLOR_TO_THEME_COLOR[viewingAgentColor]
    : undefined

  const modeLabel = viewingAgentName ? 'agent' : mode === 'bash' ? 'shell' : null
  const modeLabelColor = viewingAgentName
    ? viewedTeammateThemeColor ?? 'suggestion'
    : mode === 'bash'
      ? 'bashBorder'
      : 'subtle'

  return (
    <Box
      alignItems="center"
      alignSelf="flex-start"
      flexWrap="nowrap"
      gap={1}
      justifyContent="flex-start"
    >
      {viewingAgentName ? (
        <PromptChar
          isLoading={isLoading}
          themeColor={viewedTeammateThemeColor}
        />
      ) : mode === 'bash' ? (
        <PromptChar
          isLoading={isLoading}
          themeColor="bashBorder"
          symbol="!"
        />
      ) : (
        <PromptChar
          isLoading={isLoading}
          themeColor={isAgentSwarmsEnabled() ? teammateColor : undefined}
        />
      )}
      {modeLabel ? (
        <Text color={modeLabelColor} dimColor={isLoading}>
          {modeLabel}
        </Text>
      ) : null}
    </Box>
  )
}
