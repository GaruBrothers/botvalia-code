import * as React from 'react'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { Box, Text } from '../ink.js'
import type { Task } from '../utils/tasks.js'
import { TaskListV2 } from './TaskListV2.js'

type Props = {
  tasks: Task[]
}

export function TaskSidebar({ tasks }: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  const width = Math.max(34, Math.min(42, Math.floor(columns * 0.28)))
  const completed = tasks.filter(task => task.status === 'completed').length
  const inProgress = tasks.filter(task => task.status === 'in_progress').length
  const pending = tasks.filter(task => task.status === 'pending').length
  const hasActiveWork = inProgress > 0 || pending > 0
  const summary = hasActiveWork ? `${inProgress} active · ${pending} queued · ${completed} done` : `${completed} done`

  return (
    <Box
      width={width}
      flexShrink={0}
      flexDirection="column"
      paddingLeft={1}
      paddingBottom={1}
      overflow="hidden"
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={hasActiveWork ? 'professionalBlue' : 'subtle'}
        paddingX={1}
        paddingY={1}
        overflow="hidden"
      >
        <Text bold color="professionalBlue">
          Execution
        </Text>
        <Text dimColor>{summary}</Text>
        <Box marginTop={1}>
          <TaskListV2 tasks={tasks} columnsOverride={Math.max(24, width - 4)} />
        </Box>
      </Box>
    </Box>
  )
}
