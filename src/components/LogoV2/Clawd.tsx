import React from 'react'
import { Box, Text } from '../../ink.js'

export type ClawdPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right'

type PoseFrame = {
  top: string
  middle: string
  bottom: string
}

const POSES: Record<ClawdPose, PoseFrame> = {
  default: {
    top: '╭◢█◣╮',
    middle: '│▤◈▤│',
    bottom: '╰◥█◤╯',
  },
  'look-left': {
    top: '╭◢█◣╮',
    middle: '│◈▤▤│',
    bottom: '╰◥█◤╯',
  },
  'look-right': {
    top: '╭◢█◣╮',
    middle: '│▤▤◈│',
    bottom: '╰◥█◤╯',
  },
  'arms-up': {
    top: '┌◢█◣┐',
    middle: '│▥◆▥│',
    bottom: '╰◥█◤╯',
  },
}

export function Clawd({
  pose = 'default',
}: {
  pose?: ClawdPose
} = {}): React.ReactNode {
  const frame = POSES[pose] ?? POSES.default

  return (
    <Box flexDirection="column" alignItems="center" width={9}>
      <Text color="clawd_body">{frame.top}</Text>
      <Text color="professionalBlue">{frame.middle}</Text>
      <Text color="clawd_body">{frame.bottom}</Text>
    </Box>
  )
}
