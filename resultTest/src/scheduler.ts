import type {
  ExecutionPlan,
  PlannedTask,
  PlannerInput,
  Task,
  Worker,
} from './types'

function assertNonEmptyId(id: string, kind: 'task' | 'worker'): void {
  if (!id.trim()) {
    throw new Error(`Invalid ${kind} id`)
  }
}

function validateInput(input: PlannerInput): void {
  const taskIds = new Set<string>()
  for (const task of input.tasks) {
    assertNonEmptyId(task.id, 'task')
    if (taskIds.has(task.id)) {
      throw new Error(`Duplicate task id: ${task.id}`)
    }
    taskIds.add(task.id)
    if (task.effortDays <= 0) {
      throw new Error(`Task ${task.id} must have positive effortDays`)
    }
  }

  const workerIds = new Set<string>()
  for (const worker of input.workers) {
    assertNonEmptyId(worker.id, 'worker')
    if (workerIds.has(worker.id)) {
      throw new Error(`Duplicate worker id: ${worker.id}`)
    }
    workerIds.add(worker.id)
    if (worker.capacityPerDay <= 0) {
      throw new Error(`Worker ${worker.id} must have positive capacityPerDay`)
    }
  }
}

function topologicalSort(tasks: Task[]): string[] {
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const task of tasks) {
    indegree.set(task.id, 0)
    dependents.set(task.id, [])
  }

  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (!indegree.has(depId)) {
        continue
      }
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1)
      dependents.get(depId)?.push(task.id)
    }
  }

  const ready = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([taskId]) => taskId)
    .sort()

  const order: string[] = []

  while (ready.length > 0) {
    const current = ready.shift()!
    order.push(current)

    for (const dependentId of dependents.get(current) ?? []) {
      const nextDegree = (indegree.get(dependentId) ?? 0) - 1
      indegree.set(dependentId, nextDegree)
      if (nextDegree === 0) {
        ready.push(dependentId)
        ready.sort()
      }
    }
  }

  return order
}

function computeTaskDuration(task: Task, worker: Worker): number {
  return Math.max(1, Math.ceil(task.effortDays / worker.capacityPerDay))
}

function computeCriticalPathDays(tasks: PlannedTask[]): number {
  return tasks.reduce((maxValue, task) => maxValue + task.calendarDays, 0)
}

function computeUtilizationByWorker(
  workers: Worker[],
  tasks: PlannedTask[],
  totalDurationDays: number,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const worker of workers) {
    const usedDays = tasks
      .filter(task => task.workerId === worker.id)
      .reduce((sum, task) => sum + task.calendarDays, 0)
    result[worker.id] =
      totalDurationDays === 0 ? 0 : Number((usedDays / totalDurationDays).toFixed(4))
  }
  return result
}

export function buildExecutionPlan(input: PlannerInput): ExecutionPlan {
  validateInput(input)

  const taskMap = new Map(input.tasks.map(task => [task.id, task]))
  const order = topologicalSort(input.tasks)
  const workerAvailability = new Map(
    input.workers.map(worker => [worker.id, worker.availableFromDay]),
  )
  const plannedTasks: PlannedTask[] = []

  for (const taskId of order) {
    const task = taskMap.get(taskId)
    if (!task) {
      throw new Error(`Unknown task id: ${taskId}`)
    }

    const eligibleWorkers = input.workers.filter(
      worker => worker.role === task.requiredRole,
    )
    if (eligibleWorkers.length === 0) {
      throw new Error(`No worker available for role ${task.requiredRole}`)
    }

    const dependencyReadyDay = Math.max(
      0,
      ...task.dependsOn.map(depId => {
        const dependency = plannedTasks.find(item => item.taskId === depId)
        return dependency ? dependency.endDay : 0
      }),
    )

    const selectedWorker = eligibleWorkers[0]!
    const workerReadyDay = workerAvailability.get(selectedWorker.id) ?? 0
    const startDay = Math.max(dependencyReadyDay, workerReadyDay)
    const calendarDays = computeTaskDuration(task, selectedWorker)
    const endDay = startDay + calendarDays

    plannedTasks.push({
      taskId: task.id,
      title: task.title,
      workerId: selectedWorker.id,
      startDay,
      endDay,
      calendarDays,
      priority: task.priority,
    })

    workerAvailability.set(selectedWorker.id, endDay)
  }

  const totalDurationDays = plannedTasks.reduce(
    (maxValue, task) => Math.max(maxValue, task.endDay),
    0,
  )

  return {
    tasks: plannedTasks,
    totalDurationDays,
    criticalPathDays: computeCriticalPathDays(plannedTasks),
    utilizationByWorker: computeUtilizationByWorker(
      input.workers,
      plannedTasks,
      totalDurationDays,
    ),
  }
}
