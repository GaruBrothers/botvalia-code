import React from 'react'
import { Box, Text } from 'src/ink.js'
import { AnimatedAsterisk } from './AnimatedAsterisk.js'
import { Clawd } from './Clawd.js'

const WELCOME_V2_WIDTH = 64

function WelcomeChip({
  color = 'professionalBlue',
  children,
}: {
  color?: string
  children: React.ReactNode
}) {
  return (
    <Box backgroundColor="messageActionsBackground" paddingX={1}>
      <Text color={color}>{children}</Text>
    </Box>
  )
}

function WelcomeFactRow({
  color = 'professionalBlue',
  children,
}: {
  color?: string
  children: React.ReactNode
}) {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={color}>•</Text>
      <Text dimColor>{children}</Text>
    </Box>
  )
}

export function WelcomeV2() {
  return (
    <Box width={WELCOME_V2_WIDTH} flexDirection="column">
      <Text>
        <Text color="professionalBlue">Welcome to BotValia Code</Text>{' '}
        <Text dimColor={true}>v{MACRO.VERSION}</Text>
      </Text>
      <Box marginTop={1} flexDirection="row" gap={1}>
        <WelcomeChip color="fastMode">Free-first</WelcomeChip>
        <WelcomeChip color="suggestion">OpenRouter + Ollama</WelcomeChip>
        <WelcomeChip color="claude">Local tools</WelcomeChip>
      </Box>
      <Box marginTop={1} flexDirection="row" gap={3} alignItems="center">
        <Clawd />
        <Box flexDirection="column" gap={1} width={WELCOME_V2_WIDTH - 18}>
          <Text>Code locally, route resiliently, and keep long sessions moving.</Text>
          <Text dimColor={true}>
            Cloud when available. Local providers when you need them.
          </Text>
          <Box marginTop={1} flexDirection="column">
            <WelcomeFactRow color="fastMode">
              Fallback chains keep the coding lane alive when a model drops.
            </WelcomeFactRow>
            <WelcomeFactRow color="suggestion">
              Commands, tools, and project workflows stay on your machine.
            </WelcomeFactRow>
          </Box>
          <Box flexDirection="row" gap={1}>
            <AnimatedAsterisk />
            <Text dimColor={true}>
              Add a long-lived token when you want cloud-backed sessions.
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
