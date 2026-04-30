export type Priority = 'high' | 'medium' | 'low'

export type Role = 'backend' | 'frontend' | 'qa' | 'ops'

export type Task = {
  id: string
  title: string
  requiredRole: Role
  effortDays: number
  dependsOn: string[]
  priority: Priority
}

export type Worker = {
  id: string
  name: string
  role: Role
  availableFromDay: number
  capacityPerDay: number
}

export type PlannerInput = {
  tasks: Task[]
  workers: Worker[]
}

export type PlannedTask = {
  taskId: string
  title: string
  workerId: string
  startDay: number
  endDay: number
  calendarDays: number
  priority: Priority
}

export type ExecutionPlan = {
  tasks: PlannedTask[]
  totalDurationDays: number
  criticalPathDays: number
  utilizationByWorker: Record<string, number>
}
