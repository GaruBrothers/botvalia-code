import * as React from 'react'
import figures from 'figures'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { Box, Text } from '../ink.js'
import type { Task } from '../utils/tasks.js'
import { truncateToWidth } from '../utils/format.js'

type Props = {
  tasks: Task[]
  side?: 'left' | 'right'
}

function byPriority(left: Task, right: Task): number {
  const statusRank = (status: Task['status']) => {
    switch (status) {
      case 'in_progress':
        return 0
      case 'pending':
        return 1
      case 'completed':
        return 2
    }
  }

  const leftRank = statusRank(left.status)
  const rightRank = statusRank(right.status)
  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  const leftId = Number.parseInt(left.id, 10)
  const rightId = Number.parseInt(right.id, 10)
  if (!Number.isNaN(leftId) && !Number.isNaN(rightId)) {
    return leftId - rightId
  }

  return left.id.localeCompare(right.id)
}

function getStatusTone(status: Task['status']): {
  marker: string
  color: string | undefined
  label: string
} {
  switch (status) {
    case 'in_progress':
      return {
        marker: figures.pointer,
        color: 'professionalBlue',
        label: 'active',
      }
    case 'completed':
      return {
        marker: figures.tick,
        color: 'success',
        label: 'done',
      }
    case 'pending':
      return {
        marker: figures.squareSmall,
        color: 'subtle',
        label: 'queued',
      }
  }
}

export function TaskSidebar({
  tasks,
  side = 'right',
}: Props): React.ReactNode {
  const { columns, rows } = useTerminalSize()
  const width = Math.max(34, Math.min(48, Math.floor(columns * 0.26)))
  const ordered = [...tasks].sort(byPriority)
  const maxVisible = Math.max(4, Math.min(9, rows - 16))
  const visibleTasks = ordered.slice(0, maxVisible)
  const overflowCount = Math.max(0, ordered.length - visibleTasks.length)
  const activeCount = tasks.filter(task => task.status === 'in_progress').length
  const queuedCount = tasks.filter(task => task.status === 'pending').length
  const doneCount = tasks.filter(task => task.status === 'completed').length
  const headerColor = activeCount > 0 || queuedCount > 0 ? 'professionalBlue' : 'subtle'
  const summary =
    activeCount > 0 || queuedCount > 0
      ? `${activeCount} active · ${queuedCount} queued · ${doneCount} done`
      : `${doneCount} done`
  const subjectWidth = Math.max(18, width - 12)
  const sideSpacing = side === 'right' ? { paddingLeft: 1 } : { paddingRight: 1 }

  return (
    <Box
      width={width}
      flexShrink={0}
      flexDirection="column"
      {...sideSpacing}
      paddingBottom={1}
      overflow="hidden"
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={headerColor}
        paddingX={2}
        paddingY={1}
        overflow="hidden"
      >
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={headerColor}>
            Task Flow
          </Text>
          <Text dimColor>{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</Text>
        </Box>

        <Text dimColor>{summary}</Text>

        <Box flexDirection="column" marginTop={1}>
          {visibleTasks.map((task, index) => {
            const tone = getStatusTone(task.status)
            const owner = task.owner ? ` @${task.owner}` : ''
            const label = truncateToWidth(
              task.subject || task.description || `Task ${task.id}`,
              subjectWidth,
            )
            return (
              <Box key={task.id} flexDirection="column" marginBottom={index === visibleTasks.length - 1 ? 0 : 1}>
                <Box>
                  <Text color="subtle">{String(index + 1).padStart(2, '0')}.</Text>
                  <Text> </Text>
                  <Text color={tone.color}>{tone.marker}</Text>
                  <Text> </Text>
                  <Text
                    bold={task.status === 'in_progress'}
                    strikethrough={task.status === 'completed'}
                    dimColor={task.status === 'completed'}
                  >
                    {label}
                  </Text>
                </Box>
                <Box paddingLeft={5}>
                  <Text dimColor>
                    {tone.label}
                    {owner}
                    {task.blockedBy.length > 0
                      ? ` · blocked by ${task.blockedBy.map(id => `#${id}`).join(', ')}`
                      : ''}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>

        {overflowCount > 0 ? (
          <Box marginTop={1}>
            <Text dimColor>… {overflowCount} more queued in the backlog</Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
