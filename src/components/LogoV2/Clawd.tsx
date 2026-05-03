import React from 'react'
import { Box, Text, useTheme } from '../../ink.js'

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
      { text: '    ' },
      { text: '▗', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
      { text: '▄', color: 'white' },
    ],
    [
      { text: '     ' },
      { text: '▜', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: '   ' },
      { text: '▗', color: 'magenta' },
      { text: '▟', color: 'magenta' },
      { text: '█', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '    ' },
      { text: '▝▀', color: 'magenta' },
    ],
  ],
  'look-left': [
    [
      { text: '   ' },
      { text: '▗', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
      { text: '▄', color: 'white' },
    ],
    [
      { text: '    ' },
      { text: '▜', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: '  ' },
      { text: '▗', color: 'magenta' },
      { text: '▟', color: 'magenta' },
      { text: '█', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '   ' },
      { text: '▝▀', color: 'magenta' },
    ],
  ],
  'look-right': [
    [
      { text: '     ' },
      { text: '▗', color: 'professionalBlue' },
      { text: '▙', color: 'cyan' },
      { text: '▄', color: 'white' },
    ],
    [
      { text: '      ' },
      { text: '▜', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▙', color: 'cyan' },
    ],
    [
      { text: '    ' },
      { text: '▗', color: 'magenta' },
      { text: '▟', color: 'magenta' },
      { text: '█', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '     ' },
      { text: '▝▀', color: 'magenta' },
    ],
  ],
  'arms-up': [
    [
      { text: '    ' },
      { text: '▗', color: 'magenta' },
      { text: '◆', color: 'white' },
      { text: '▄', color: 'white' },
    ],
    [
      { text: '     ' },
      { text: '▜', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '◆', color: 'cyan' },
    ],
    [
      { text: '   ' },
      { text: '▗', color: 'magenta' },
      { text: '▟', color: 'magenta' },
      { text: '█', color: 'professionalBlue' },
      { text: '█', color: 'cyan' },
      { text: '▘', color: 'cyan' },
    ],
    [
      { text: '    ' },
      { text: '▝▀', color: 'magenta' },
    ],
  ],
}

function getSegmentColor(color: string | undefined, isPremium: boolean) {
  if (!color || !isPremium) {
    return color
  }

  switch (color) {
    case 'professionalBlue':
      return 'promptBorder'
    case 'cyan':
      return 'professionalBlue'
    case 'magenta':
      return 'claude'
    case 'white':
      return 'text'
    default:
      return color
  }
}

export function Clawd({
  pose = 'default',
}: {
  pose?: ClawdPose
} = {}): React.ReactNode {
  const [themeName] = useTheme()
  const isPremium = themeName === 'premium'
  const frame = POSES[pose] ?? POSES.default

  return (
    <Box flexDirection="column" alignItems="center" width={9}>
      {frame.map((line, lineIndex) => (
        <Box key={lineIndex} flexDirection="row">
          {line.map((segment, segmentIndex) => (
            <Text
              key={`${lineIndex}-${segmentIndex}`}
              color={getSegmentColor(segment.color, isPremium)}
            >
              {segment.text}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
