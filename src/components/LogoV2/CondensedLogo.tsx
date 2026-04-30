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
      <Box flexDirection="row" gap={3} alignItems="flex-start">
        {isFullscreenEnvEnabled() ? <AnimatedClawd /> : <Clawd />}

        <Box flexDirection="column">
          <Text>
            <Text bold color="white">
              BotValia
            </Text>{' '}
            <Text bold color="professionalBlue">
              Co
            </Text>
            <Text bold color="magenta">
              de
            </Text>
          </Text>

          <Text color="cyan">v{truncatedVersion}</Text>

          {shouldSplit ? (
            <>
              <Text dimColor>{truncatedModel}</Text>
              <Text dimColor>{truncatedBilling}</Text>
            </>
          ) : (
            <Text dimColor>
              {truncatedModel} · {truncatedBilling}
            </Text>
          )}

          <Text dimColor>{pathLine}</Text>

          {showGuestPassesUpsell && <GuestPassesUpsell />}

          {!showGuestPassesUpsell && showOverageCreditUpsell && (
            <OverageCreditUpsell maxWidth={textWidth} twoLine />
          )}
        </Box>
      </Box>
    </OffscreenFreeze>
  )
}
