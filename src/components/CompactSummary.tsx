import * as React from 'react'
import { BLACK_CIRCLE } from '../constants/figures.js'
import { Box, Text } from '../ink.js'
import type { Screen } from '../screens/REPL.js'
import type { NormalizedUserMessage } from '../types/message.js'
import { getUserMessageText } from '../utils/messages.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { MessageResponse } from './MessageResponse.js'

type Props = {
  message: NormalizedUserMessage
  screen: Screen
}

function SummaryIndicator({
  color = 'warning',
}: {
  color?: 'warning' | 'suggestion' | 'text'
}): React.ReactNode {
  return (
    <Box minWidth={2}>
      <Text color={color}>{BLACK_CIRCLE}</Text>
    </Box>
  )
}

function SummaryShortcut({
  label,
}: {
  label: string
}): React.ReactNode {
  return (
    <Text dimColor>
      <ConfigurableShortcutHint
        action="app:toggleTranscript"
        context="Global"
        fallback="ctrl+o"
        description={label}
        parens={true}
      />
    </Text>
  )
}

export function CompactSummary({
  message,
  screen,
}: Props): React.ReactNode {
  const isTranscriptMode = screen === 'transcript'
  const textContent = getUserMessageText(message) || ''
  const metadata = message.summarizeMetadata

  if (metadata) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row" gap={1}>
          <SummaryIndicator />
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text bold color="warning">
                Summarized conversation
              </Text>
              <Text dimColor>history condensed</Text>
            </Box>
            {!isTranscriptMode ? (
              <MessageResponse>
                <Box flexDirection="column">
                  <Text dimColor>
                    Summarized {metadata.messagesSummarized} messages{' '}
                    {metadata.direction === 'up_to'
                      ? 'up to this point'
                      : 'from this point'}
                  </Text>
                  {metadata.userContext ? (
                    <Text dimColor>
                      Context: “{metadata.userContext}”
                    </Text>
                  ) : null}
                  <SummaryShortcut label="expand history" />
                </Box>
              </MessageResponse>
            ) : null}
            {isTranscriptMode ? (
              <MessageResponse>
                <Text>{textContent}</Text>
              </MessageResponse>
            ) : null}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" gap={1}>
        <SummaryIndicator color="suggestion" />
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text bold color="suggestion">
              Compact summary
            </Text>
            <Text dimColor>older history folded away</Text>
            {!isTranscriptMode ? <SummaryShortcut label="expand" /> : null}
          </Box>
          {isTranscriptMode ? (
            <MessageResponse>
              <Text>{textContent}</Text>
            </MessageResponse>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}
