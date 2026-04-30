import React, { useEffect, useRef, useState } from 'react'
import { Box } from '../../ink.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { Clawd, type ClawdPose } from './Clawd.js'

type Frame = {
  pose: ClawdPose
  offset: number
}

function hold(pose: ClawdPose, offset: number, frames: number): Frame[] {
  return Array.from({ length: frames }, () => ({ pose, offset }))
}

const BOOST_WAVE: readonly Frame[] = [
  ...hold('default', 1, 2),
  ...hold('arms-up', 0, 3),
  ...hold('default', 0, 1),
  ...hold('look-right', 0, 2),
  ...hold('look-left', 0, 2),
  ...hold('default', 0, 1),
]

const SIGNAL_SWEEP: readonly Frame[] = [
  ...hold('look-left', 0, 3),
  ...hold('default', 0, 2),
  ...hold('look-right', 0, 3),
  ...hold('default', 0, 1),
]

const CLICK_ANIMATIONS: readonly (readonly Frame[])[] = [
  BOOST_WAVE,
  SIGNAL_SWEEP,
]

const IDLE: Frame = {
  pose: 'default',
  offset: 0,
}

const FRAME_MS = 70
const MARK_HEIGHT = 5

const incrementFrame = (i: number) => i + 1

export function AnimatedClawd(): React.ReactNode {
  const { pose, bounceOffset, onClick } = useClawdAnimation()

  return (
    <Box height={MARK_HEIGHT} flexDirection="column" onClick={onClick}>
      <Box marginTop={bounceOffset} flexShrink={0}>
        <Clawd pose={pose} />
      </Box>
    </Box>
  )
}

function useClawdAnimation(): {
  pose: ClawdPose
  bounceOffset: number
  onClick: () => void
} {
  const [reducedMotion] = useState(
    () => getInitialSettings().prefersReducedMotion ?? false,
  )
  const [frameIndex, setFrameIndex] = useState(-1)
  const sequenceRef = useRef<readonly Frame[]>(BOOST_WAVE)

  const onClick = () => {
    if (reducedMotion || frameIndex !== -1) return

    sequenceRef.current =
      CLICK_ANIMATIONS[Math.floor(Math.random() * CLICK_ANIMATIONS.length)]!
    setFrameIndex(0)
  }

  useEffect(() => {
    if (frameIndex === -1) return

    if (frameIndex >= sequenceRef.current.length) {
      setFrameIndex(-1)
      return
    }

    const timer = setTimeout(setFrameIndex, FRAME_MS, incrementFrame)
    return () => clearTimeout(timer)
  }, [frameIndex])

  const sequence = sequenceRef.current
  const current =
    frameIndex >= 0 && frameIndex < sequence.length
      ? sequence[frameIndex]!
      : IDLE

  return {
    pose: current.pose,
    bounceOffset: current.offset,
    onClick,
  }
}
