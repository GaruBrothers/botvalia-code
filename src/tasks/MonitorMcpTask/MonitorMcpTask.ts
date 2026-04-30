import type { SetAppState, TaskStateBase } from '../../Task.js'
import { updateTaskState } from '../../utils/task/framework.js'

// Minimal recovered monitor task contract used by the background-tasks UI.
export type MonitorMcpTaskState = TaskStateBase & {
  type: 'monitor_mcp'
}

export function isMonitorMcpTask(value: unknown): value is MonitorMcpTaskState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'monitor_mcp'
  )
}

export function killMonitorMcp(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<MonitorMcpTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running' && task.status !== 'pending') {
      return task
    }
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      notified: true,
    }
  })
}
