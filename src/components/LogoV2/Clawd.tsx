import React from 'react'
import { Box, Text } from '../../ink.js'

export type ClawdPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right'

type Segment = {
  text: string
  color?: string
}

type PoseFrame = readonly (readonly Segment[])[]

const POSES: Record<ClawdPose, PoseFrame> = {
  default: [
    [
      { text: '  ' },
      { text: '▗▙', color: 'magenta' },
      { text: '▄', color: 'professionalBlue' },
    ],
    [
      { text: '    ' },
      { text: '▜█', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: '  ' },
      { text: '▗▟', color: 'magenta' },
      { text: '██', color: 'professionalBlue' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: ' ' },
      { text: '▝▀', color: 'cyan' },
    ],
  ],
  'look-left': [
    [
      { text: ' ' },
      { text: '▗▙', color: 'magenta' },
      { text: '▄', color: 'professionalBlue' },
    ],
    [
      { text: '   ' },
      { text: '▜█', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: ' ' },
      { text: '▗▟', color: 'magenta' },
      { text: '██', color: 'professionalBlue' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '▝▀', color: 'cyan' },
    ],
  ],
  'look-right': [
    [
      { text: '   ' },
      { text: '▗▙', color: 'magenta' },
      { text: '▄', color: 'professionalBlue' },
    ],
    [
      { text: '     ' },
      { text: '▜█', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: '   ' },
      { text: '▗▟', color: 'magenta' },
      { text: '██', color: 'professionalBlue' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '  ' },
      { text: '▝▀', color: 'cyan' },
    ],
  ],
  'arms-up': [
    [
      { text: '  ' },
      { text: '▗◆', color: 'magenta' },
      { text: '▙▄', color: 'professionalBlue' },
    ],
    [
      { text: '    ' },
      { text: '▜█', color: 'professionalBlue' },
      { text: '◆', color: 'cyan' },
    ],
    [
      { text: '  ' },
      { text: '▗▟', color: 'magenta' },
      { text: '██', color: 'professionalBlue' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: ' ' },
      { text: '▝▀', color: 'cyan' },
    ],
  ],
}

export function Clawd({
  pose = 'default',
}: {
  pose?: ClawdPose
} = {}): React.ReactNode {
  const frame = POSES[pose] ?? POSES.default

  return (
    <Box flexDirection="column" alignItems="center" width={8}>
      {frame.map((line, lineIndex) => (
        <Box key={lineIndex} flexDirection="row">
          {line.map((segment, segmentIndex) => (
            <Text key={`${lineIndex}-${segmentIndex}`} color={segment.color}>
              {segment.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
