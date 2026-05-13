import type {
  ThinkingBlock,
  ThinkingBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import React from 'react'
import { Box, Text } from '../../ink.js'
import { MessageResponse } from '../MessageResponse.js'
import { CtrlOToExpand } from '../CtrlOToExpand.js'
import { Markdown } from '../Markdown.js'

type Props = {
  // Accept either full ThinkingBlock/ThinkingBlockParam or a minimal shape with just type and thinking
  param:
    | ThinkingBlock
    | ThinkingBlockParam
    | {
        type: 'thinking'
        thinking: string
      }
  addMargin: boolean
  isTranscriptMode: boolean
  verbose: boolean
  /** When true, hide this thinking block entirely (used for past thinking in transcript mode) */
  hideInTranscript?: boolean
}

const THINKING_LABEL = '∴ thinking'

export function AssistantThinkingMessage({
  param: { thinking },
  addMargin = false,
  isTranscriptMode,
  verbose,
  hideInTranscript = false,
}: Props): React.ReactNode {
  if (!thinking || hideInTranscript) {
    return null
  }

  const shouldShowFullThinking = isTranscriptMode || verbose

  if (!shouldShowFullThinking) {
    return (
      <Box marginTop={addMargin ? 1 : 0}>
        <MessageResponse height={1}>
          <Text dimColor italic>
            {THINKING_LABEL} hidden <CtrlOToExpand />
          </Text>
        </MessageResponse>
      </Box>
    )
  }

  return (
    <Box marginTop={addMargin ? 1 : 0} width="100%">
      <MessageResponse>
        <Box flexDirection="column">
          <Text dimColor italic>
            {THINKING_LABEL}
          </Text>
          <Box flexDirection="column" marginTop={1} paddingLeft={1}>
            <Markdown dimColor>{thinking}</Markdown>
          </Box>
        </Box>
      </MessageResponse>
    </Box>
  )
}
