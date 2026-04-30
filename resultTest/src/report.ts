import type { ExecutionPlan } from './types'

export function renderExecutionPlan(plan: ExecutionPlan): string {
  const rows = [...plan.tasks]
    .sort((left, right) => left.title.localeCompare(right.title))
    .map(task =>
      `| ${task.taskId} | ${task.title} | ${task.workerId} | ${task.startDay} | ${task.endDay} | ${task.calendarDays} |`,
    )

  return [
    '# Execution Plan',
    '',
    `Total duration: ${plan.totalDurationDays} days`,
    `Critical path: ${plan.criticalPathDays} days`,
    '',
    '| Task | Title | Worker | Start | End | Days |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...rows,
  ].join('\n')
}
