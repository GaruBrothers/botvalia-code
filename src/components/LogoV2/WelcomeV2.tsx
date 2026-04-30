import React from 'react'
import { Box, Text } from 'src/ink.js'
import { AnimatedAsterisk } from './AnimatedAsterisk.js'
import { Clawd } from './Clawd.js'

const WELCOME_V2_WIDTH = 58
const DIVIDER = '······················································'

export function WelcomeV2() {
  return (
    <Box width={WELCOME_V2_WIDTH} flexDirection="column">
      <Text>
        <Text color="professionalBlue">Welcome to BotValia Code</Text>{' '}
        <Text dimColor={true}>v{MACRO.VERSION}</Text>
      </Text>
      <Text dimColor={true}>{DIVIDER}</Text>
      <Box marginTop={1} flexDirection="row" gap={3} alignItems="center">
        <Clawd />
        <Box flexDirection="column" gap={1}>
          <Text>Free-first coding CLI with resilient provider routing.</Text>
          <Text dimColor={true}>
            Set up a long-lived token for cloud-backed sessions.
          </Text>
          <Box flexDirection="row" gap={1}>
            <AnimatedAsterisk />
            <Text dimColor={true}>
              Local tools, local providers, and project workflows stay available.
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
