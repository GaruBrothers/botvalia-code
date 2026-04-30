import type { SetAppState, TaskStateBase } from '../../Task.js'
import { updateTaskState } from '../../utils/task/framework.js'

// Reconstructed workflow support: the original workflow runtime was not
// recovered in this tree, but the UI still expects a concrete task shape and
// a few lifecycle handlers. Keep the contract minimal and safe so background
// task views can render without crashing.
export type LocalWorkflowTaskState = TaskStateBase & {
  type: 'local_workflow'
  workflowName?: string
  summary?: string
  agentCount: number
}

export function isLocalWorkflowTask(
  value: unknown,
): value is LocalWorkflowTaskState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'local_workflow'
  )
}

export function killWorkflowTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
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

export function skipWorkflowAgent(
  _taskId: string,
  _agentId: string,
  _setAppState: SetAppState,
): void {}

export function retryWorkflowAgent(
  _taskId: string,
  _agentId: string,
  _setAppState: SetAppState,
): void {}
