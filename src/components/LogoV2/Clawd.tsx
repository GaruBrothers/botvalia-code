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
    [{ text: '    ' }, { text: '◢█◣', color: 'blue' }],
    [
      { text: '  ' },
      { text: '◢██', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '██◣', color: 'blue' },
    ],
    [
      { text: '◢███', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '◇', color: 'yellow' },
      { text: '◆', color: 'cyan' },
      { text: '███◣', color: 'blue' },
    ],
    [
      { text: '◥███', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '◇', color: 'yellow' },
      { text: '◆', color: 'cyan' },
      { text: '███◤', color: 'blue' },
    ],
    [
      { text: '  ' },
      { text: '◥██', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '██◤', color: 'blue' },
    ],
    [{ text: '    ' }, { text: '◥█◤', color: 'blue' }],
  ],
  'look-left': [
    [{ text: '    ' }, { text: '◢█◣', color: 'blue' }],
    [
      { text: '  ' },
      { text: '◢██', color: 'blue' },
      { text: '◇', color: 'yellow' },
      { text: '██◣', color: 'blue' },
    ],
    [
      { text: '◢███', color: 'blue' },
      { text: '◇', color: 'yellow' },
      { text: '◆◆', color: 'cyan' },
      { text: '███◣', color: 'blue' },
    ],
    [
      { text: '◥███', color: 'blue' },
      { text: '◇', color: 'yellow' },
      { text: '◆◆', color: 'cyan' },
      { text: '███◤', color: 'blue' },
    ],
    [
      { text: '  ' },
      { text: '◥██', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '██◤', color: 'blue' },
    ],
    [{ text: '    ' }, { text: '◥█◤', color: 'blue' }],
  ],
  'look-right': [
    [{ text: '    ' }, { text: '◢█◣', color: 'blue' }],
    [
      { text: '  ' },
      { text: '◢██', color: 'blue' },
      { text: '◇', color: 'yellow' },
      { text: '██◣', color: 'blue' },
    ],
    [
      { text: '◢███', color: 'blue' },
      { text: '◆◆', color: 'cyan' },
      { text: '◇', color: 'yellow' },
      { text: '███◣', color: 'blue' },
    ],
    [
      { text: '◥███', color: 'blue' },
      { text: '◆◆', color: 'cyan' },
      { text: '◇', color: 'yellow' },
      { text: '███◤', color: 'blue' },
    ],
    [
      { text: '  ' },
      { text: '◥██', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '██◤', color: 'blue' },
    ],
    [{ text: '    ' }, { text: '◥█◤', color: 'blue' }],
  ],
  'arms-up': [
    [{ text: '   ' }, { text: '◢◆█◆◣', color: 'cyan' }],
    [
      { text: '  ' },
      { text: '◢██', color: 'blue' },
      { text: '◆◆', color: 'cyan' },
      { text: '██◣', color: 'blue' },
    ],
    [
      { text: '◢███', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '◇', color: 'yellow' },
      { text: '◆', color: 'cyan' },
      { text: '███◣', color: 'blue' },
    ],
    [
      { text: '◥███', color: 'blue' },
      { text: '◆◆◆', color: 'cyan' },
      { text: '███◤', color: 'blue' },
    ],
    [
      { text: '  ' },
      { text: '◥██', color: 'blue' },
      { text: '◆', color: 'cyan' },
      { text: '██◤', color: 'blue' },
    ],
    [{ text: '    ' }, { text: '◥█◤', color: 'blue' }],
  ],
}

export function Clawd({
  pose = 'default',
}: {
  pose?: ClawdPose
} = {}): React.ReactNode {
  const frame = POSES[pose] ?? POSES.default

  return (
    <Box flexDirection="column" alignItems="center" width={11}>
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
