import { feature } from 'bun:bundle'
import * as React from 'react'
import { useMemo } from 'react'
import { Box, Text } from 'src/ink.js'
import { useAppState } from 'src/state/AppState.js'
import { STATUS_TAG, SUMMARY_TAG, TASK_NOTIFICATION_TAG } from '../../constants/xml.js'
import { QueuedMessageProvider } from '../../context/QueuedMessageContext.js'
import { useCommandQueue } from '../../hooks/useCommandQueue.js'
import type { QueuedCommand } from '../../types/textInputTypes.js'
import { isQueuedCommandVisible } from '../../utils/messageQueueManager.js'
import { createUserMessage, EMPTY_LOOKUPS, normalizeMessages } from '../../utils/messages.js'
import { jsonParse } from '../../utils/slowOperations.js'
import { Message } from '../Message.js'

const EMPTY_SET = new Set<string>()
const MAX_VISIBLE_NOTIFICATIONS = 3

function isIdleNotification(value: string): boolean {
  try {
    const parsed = jsonParse(value)
    return parsed?.type === 'idle_notification'
  } catch {
    return false
  }
}

function createOverflowNotificationMessage(count: number): string {
  return `<${TASK_NOTIFICATION_TAG}>
<${SUMMARY_TAG}>+${count} more tasks completed</${SUMMARY_TAG}>
<${STATUS_TAG}>completed</${STATUS_TAG}>
</${TASK_NOTIFICATION_TAG}>`
}

function processQueuedCommands(queuedCommands: QueuedCommand[]): QueuedCommand[] {
  const filteredCommands = queuedCommands.filter(
    cmd => typeof cmd.value !== 'string' || !isIdleNotification(cmd.value),
  )
  const taskNotifications = filteredCommands.filter(
    cmd => cmd.mode === 'task-notification',
  )
  const otherCommands = filteredCommands.filter(
    cmd => cmd.mode !== 'task-notification',
  )

  if (taskNotifications.length <= MAX_VISIBLE_NOTIFICATIONS) {
    return [...otherCommands, ...taskNotifications]
  }

  const visibleNotifications = taskNotifications.slice(
    0,
    MAX_VISIBLE_NOTIFICATIONS - 1,
  )
  const overflowCount =
    taskNotifications.length - (MAX_VISIBLE_NOTIFICATIONS - 1)

  const overflowCommand: QueuedCommand = {
    value: createOverflowNotificationMessage(overflowCount),
    mode: 'task-notification',
  }

  return [...otherCommands, ...visibleNotifications, overflowCommand]
}

function PromptInputQueuedCommandsImpl(): React.ReactNode {
  const queuedCommands = useCommandQueue()
  const viewingAgent = useAppState(s => !!s.viewingAgentTaskId)
  const useBriefLayout =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ?
          // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
          useAppState(s => s.isBriefOnly)
      : false

  const queuePreview = useMemo(() => {
    if (queuedCommands.length === 0) return null

    const visibleCommands = queuedCommands.filter(isQueuedCommandVisible)
    if (visibleCommands.length === 0) return null

    const processedCommands = processQueuedCommands(visibleCommands)
    const editableQueuedCount = processedCommands.filter(
      cmd => cmd.mode === 'prompt' || cmd.mode === 'bash',
    ).length
    const messages = normalizeMessages(
      processedCommands.map(cmd => {
        let content = cmd.value
        if (cmd.mode === 'bash' && typeof content === 'string') {
          content = `<bash-input>${content}</bash-input>`
        }

        return createUserMessage({ content })
      }),
    )

    return {
      editableQueuedCount,
      messages,
    }
  }, [queuedCommands])

  if (viewingAgent || queuePreview === null) {
    return null
  }

  const { editableQueuedCount, messages } = queuePreview
  const queuedSummary =
    editableQueuedCount > 0
      ? `${editableQueuedCount} ${
          editableQueuedCount === 1 ? 'message' : 'messages'
        } waiting for the current turn`
      : null

  return (
    <Box marginTop={1} flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="promptBorder"
        backgroundColor="messageActionsBackground"
        paddingX={1}
      >
        {queuedSummary ? (
          <Box marginBottom={1}>
            <Text color="warning">queued</Text>
            <Text color="text" bold>
              {' '}
              {queuedSummary}
            </Text>
            <Text dimColor> · press up to edit</Text>
          </Box>
        ) : null}
        {messages.map((message, i) => (
          <Box key={i} marginTop={i === 0 ? 0 : 1}>
            <QueuedMessageProvider
              isFirst={i === 0}
              useBriefLayout={useBriefLayout}
            >
              <Message
                message={message}
                lookups={EMPTY_LOOKUPS}
                addMargin={false}
                tools={[]}
                commands={[]}
                verbose={false}
                inProgressToolUseIDs={EMPTY_SET}
                progressMessagesForMessage={[]}
                shouldAnimate={false}
                shouldShowDot={false}
                isTranscriptMode={false}
                isStatic={true}
              />
            </QueuedMessageProvider>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export const PromptInputQueuedCommands = React.memo(
  PromptInputQueuedCommandsImpl,
)
