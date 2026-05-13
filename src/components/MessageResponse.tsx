import * as React from 'react'
import { useContext } from 'react'
import { Box, NoSelect, Text } from '../ink.js'
import { Ratchet } from './design-system/Ratchet.js'

type Props = {
  children: React.ReactNode
  height?: number
}

const RESPONSE_GUTTER_WIDTH = 4

export function MessageResponse({
  children,
  height,
}: Props): React.ReactNode {
  const isMessageResponse = useContext(MessageResponseContext)

  if (isMessageResponse) {
    return children
  }

  const content = (
    <MessageResponseProvider>
      <Box flexDirection="row" height={height} overflowY="hidden">
        <NoSelect fromLeftEdge flexShrink={0} minWidth={RESPONSE_GUTTER_WIDTH}>
          <Text dimColor>{'  '}⎿</Text>
        </NoSelect>
        <Box flexDirection="column" flexShrink={1} flexGrow={1} paddingLeft={1}>
          {children}
        </Box>
      </Box>
    </MessageResponseProvider>
  )

  if (height !== undefined) {
    return content
  }

  return <Ratchet lock="offscreen">{content}</Ratchet>
}

// This is a context that is used to determine if the message response
// is rendered as a descendant of another MessageResponse. We use it
// to avoid rendering nested ⎿ characters.
const MessageResponseContext = React.createContext(false)

function MessageResponseProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  return (
    <MessageResponseContext.Provider value={true}>
      {children}
    </MessageResponseContext.Provider>
  )
}
