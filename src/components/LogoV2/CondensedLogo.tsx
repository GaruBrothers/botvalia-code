import * as React from 'react'
import { type ReactNode, useEffect } from 'react'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { stringWidth } from '../../ink/stringWidth.js'
import { Box, Text } from '../../ink.js'
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

  return (
    <OffscreenFreeze>
      <Box flexDirection="column" alignItems="center">
        <Box alignItems="center" flexDirection="column" marginBottom={1}>
          {isFullscreenEnvEnabled() ? <AnimatedClawd /> : <Clawd />}
          <Text color="professionalBlue">▁▁▁▁▁</Text>
        </Box>

        <Box flexDirection="column" alignItems="center">
          {showLargeWordmark ? (
            <Box flexDirection="column" alignItems="center">
              {BOTVALIA_BANNER.map((line, index) => (
                <Text key={index}>
                  <Text bold color="claude">
                    {line}
                  </Text>
                  <Text color="professionalBlue">
                    {'  '}
                    {CODE_BANNER[index].slice(0, 18)}
                  </Text>
                  <Text color="suggestion">{CODE_BANNER[index].slice(18)}</Text>
                </Text>
              ))}
            </Box>
          ) : (
            <Text>
              <Text bold color="white">
                BotValia
              </Text>{' '}
              <Text bold color="professionalBlue">
                Code
              </Text>
            </Text>
          )}

          <Box marginTop={1} flexDirection="row" gap={1}>
            <MetaChip color="professionalBlue">v{truncatedVersion}</MetaChip>
            <MetaChip color="fastMode">free-first</MetaChip>
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
    </OffscreenFreeze>
  )
}
