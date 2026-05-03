import * as React from 'react'
import { type ReactNode, useEffect } from 'react'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text, useTheme } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { getEffortSuffix } from '../../utils/effort.js'
import { truncate } from '../../utils/format.js'
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js'
import {
  formatModelAndBilling,
  getLogoDisplayData,
  truncatePath,
} from '../../utils/logoV2Utils.js'
import {
  getDefaultMainLoopModelSetting,
  renderDefaultModelSetting,
} from '../../utils/model/model.js'
import { OffscreenFreeze } from '../OffscreenFreeze.js'
import { AnimatedClawd } from './AnimatedClawd.js'
import { Clawd } from './Clawd.js'
import {
  GuestPassesUpsell,
  incrementGuestPassesSeenCount,
  useShowGuestPassesUpsell,
} from './GuestPassesUpsell.js'
import {
  incrementOverageCreditUpsellSeenCount,
  OverageCreditUpsell,
  useShowOverageCreditUpsell,
} from './OverageCreditUpsell.js'

const BOTVALIA_BANNER = [
  '██████╗  ██████╗ ████████╗██╗   ██╗ █████╗ ██╗     ██╗ █████╗ ',
  '██╔══██╗██╔═══██╗╚══██╔══╝██║   ██║██╔══██╗██║     ██║██╔══██╗',
  '██████╔╝██║   ██║   ██║   ██║   ██║███████║██║     ██║███████║',
  '██╔══██╗██║   ██║   ██║   ╚██╗ ██╔╝██╔══██║██║     ██║██╔══██║',
  '██████╔╝╚██████╔╝   ██║    ╚████╔╝ ██║  ██║███████╗██║██║  ██║',
  '╚═════╝  ╚═════╝    ╚═╝     ╚═══╝  ╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═╝',
] as const

const CODE_BANNER = [
  ' ██████╗ ██████╗ ██████╗ ███████╗',
  '██╔════╝██╔═══██╗██╔══██╗██╔════╝',
  '██║     ██║   ██║██║  ██║█████╗  ',
  '██║     ██║   ██║██║  ██║██╔══╝  ',
  '╚██████╗╚██████╔╝██████╔╝███████╗',
  ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
] as const

function MetaChip({
  color = 'professionalBlue',
  children,
}: {
  color?: string
  children: ReactNode
}): ReactNode {
  return (
    <Box backgroundColor="messageActionsBackground" paddingX={1}>
      <Text color={color}>{children}</Text>
    </Box>
  )
}

function MetaLine({
  label,
  value,
  color = 'suggestion',
}: {
  label: string
  value: string
  color?: string
}): ReactNode {
  return (
    <Text>
      <Text color={color}>{label}</Text>
      <Text dimColor> {value}</Text>
    </Text>
  )
}

export function CondensedLogo(): ReactNode {
  const [themeName] = useTheme()
  const { columns } = useTerminalSize()
  const agent = useAppState(s => s.agent)
  const effortValue = useAppState(s => s.effortValue)
  const selectedModelSetting = useAppState(s => s.mainLoopModel)
  const model = useMainLoopModel()
  const modelDisplayName = renderDefaultModelSetting(
    selectedModelSetting ?? getDefaultMainLoopModelSetting(),
  )
  const {
    version,
    cwd,
    billingType,
    agentName: agentNameFromSettings,
  } = getLogoDisplayData()

  const agentName = agent ?? agentNameFromSettings
  const isPremium = themeName === 'premium'
  const showGuestPassesUpsell = useShowGuestPassesUpsell()
  const showOverageCreditUpsell = useShowOverageCreditUpsell()

  useEffect(() => {
    if (showGuestPassesUpsell) {
      incrementGuestPassesSeenCount()
    }
  }, [showGuestPassesUpsell])

  useEffect(() => {
    if (showOverageCreditUpsell && !showGuestPassesUpsell) {
      incrementOverageCreditUpsellSeenCount()
    }
  }, [showGuestPassesUpsell, showOverageCreditUpsell])

  const bannerLines = BOTVALIA_BANNER.map(
    (line, index) => `${line}  ${CODE_BANNER[index]}`,
  )
  const bannerWidth = Math.max(...bannerLines.map(line => stringWidth(line)))
  const showLargeWordmark = columns >= bannerWidth + 14
  const textWidth = Math.max(columns - 16, 20)
  const truncatedVersion = truncate(version, Math.max(textWidth - 1, 8))
  const effortSuffix = getEffortSuffix(model, effortValue)
  const { shouldSplit, truncatedModel, truncatedBilling } =
    formatModelAndBilling(
      modelDisplayName + effortSuffix,
      billingType,
      textWidth,
    )

  const cwdAvailableWidth = agentName
    ? textWidth - 1 - stringWidth(agentName) - 3
    : textWidth
  const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10))
  const pathLine = agentName ? `@${agentName} · ${truncatedCwd}` : truncatedCwd
  const shellLabel = isPremium
    ? showLargeWordmark
      ? 'BotValia Premium'
      : 'Premium Shell'
    : showLargeWordmark
      ? 'BotValia Console'
      : 'BotValia Shell'
  const shellChipColor = isPremium ? 'claude' : 'professionalBlue'
  const modeChipColor = isPremium ? 'professionalBlue' : 'suggestion'
  const modeChipLabel = isPremium ? 'operator-grade' : 'chat-first'
  const dividerGlyph = isPremium
    ? '╭──── premium operator shell ────╮'
    : '╶────────╴'

  return (
    <OffscreenFreeze>
      <Box flexDirection="column" alignItems="center">
        <Box
          flexDirection="column"
          alignItems="center"
          borderStyle="round"
          borderColor="subtle"
          paddingX={showLargeWordmark ? 3 : 2}
          paddingY={1}
        >
          <Box marginBottom={1} flexDirection="row" gap={1}>
            <MetaChip color={shellChipColor}>{shellLabel}</MetaChip>
            <MetaChip color={modeChipColor}>{modeChipLabel}</MetaChip>
          </Box>

          <Box alignItems="center" flexDirection="column" marginBottom={1}>
            {isFullscreenEnvEnabled() ? <AnimatedClawd /> : <Clawd />}
            <Text color={isPremium ? 'promptBorder' : 'professionalBlue'}>
              {dividerGlyph}
            </Text>
          </Box>

          <Box flexDirection="column" alignItems="center">
            {showLargeWordmark ? (
              <Box flexDirection="column" alignItems="center">
                {BOTVALIA_BANNER.map((line, index) => (
                  <Text key={index}>
                    <Text bold color={isPremium ? 'text' : 'claude'}>
                      {line}
                    </Text>
                    <Text color={isPremium ? 'promptBorder' : 'professionalBlue'}>
                      {'  '}
                      {CODE_BANNER[index].slice(0, 18)}
                    </Text>
                    <Text color={isPremium ? 'claude' : 'suggestion'}>
                      {CODE_BANNER[index].slice(18)}
                    </Text>
                  </Text>
                ))}
              </Box>
            ) : (
              <Text>
                <Text bold color={isPremium ? 'text' : 'white'}>
                  BotValia
                </Text>{' '}
                <Text bold color={isPremium ? 'claude' : 'professionalBlue'}>
                  Code
                </Text>
              </Text>
            )}

            <Box marginTop={1} flexDirection="row" gap={1}>
              <MetaChip color={isPremium ? 'promptBorder' : 'professionalBlue'}>
                v{truncatedVersion}
              </MetaChip>
              <MetaChip color={isPremium ? 'permission' : 'fastMode'}>
                {isPremium ? 'premium mode' : 'free-first'}
              </MetaChip>
            </Box>

            {shouldSplit ? (
              <Box marginTop={1} flexDirection="column" alignItems="center">
                <MetaLine label="model" value={truncatedModel} />
                <MetaLine label="billing" value={truncatedBilling} color="fastMode" />
              </Box>
            ) : (
              <Box marginTop={1}>
                <MetaLine
                  label="model"
                  value={`${truncatedModel} · ${truncatedBilling}`}
                />
              </Box>
            )}

            <MetaLine label="cwd" value={pathLine} color="subtle" />

            {showGuestPassesUpsell && <GuestPassesUpsell />}

            {!showGuestPassesUpsell && showOverageCreditUpsell && (
              <OverageCreditUpsell maxWidth={textWidth} twoLine />
            )}
          </Box>
        </Box>
      </Box>
    </OffscreenFreeze>
  )
}
