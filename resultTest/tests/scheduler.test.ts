import { describe, expect, test } from 'bun:test'
import { renderExecutionPlan } from '../src/report'
import { buildExecutionPlan } from '../src/scheduler'
import type { PlannerInput } from '../src/types'

function createFixture(): PlannerInput {
  return {
    workers: [
      {
        id: 'backend-fast',
        name: 'Ada',
        role: 'backend',
        availableFromDay: 0,
        capacityPerDay: 2,
      },
      {
        id: 'backend-slow',
        name: 'Grace',
        role: 'backend',
        availableFromDay: 0,
        capacityPerDay: 1,
      },
      {
        id: 'frontend-main',
        name: 'Lin',
        role: 'frontend',
        availableFromDay: 1,
        capacityPerDay: 1,
      },
      {
        id: 'qa-main',
        name: 'Jo',
        role: 'qa',
        availableFromDay: 0,
        capacityPerDay: 1,
      },
    ],
    tasks: [
      {
        id: 'api-schema',
        title: 'API schema',
        requiredRole: 'backend',
        effortDays: 2,
        dependsOn: [],
        priority: 'high',
      },
      {
        id: 'auth-service',
        title: 'Auth service',
        requiredRole: 'backend',
        effortDays: 4,
        dependsOn: ['api-schema'],
        priority: 'high',
      },
      {
        id: 'dashboard-ui',
        title: 'Dashboard UI',
        requiredRole: 'frontend',
        effortDays: 3,
        dependsOn: ['api-schema'],
        priority: 'medium',
      },
      {
        id: 'integration',
        title: 'Integration',
        requiredRole: 'backend',
        effortDays: 2,
        dependsOn: ['auth-service', 'dashboard-ui'],
        priority: 'high',
      },
      {
        id: 'qa-pass',
        title: 'QA pass',
        requiredRole: 'qa',
        effortDays: 2,
        dependsOn: ['integration'],
        priority: 'medium',
      },
    ],
  }
}

describe('buildExecutionPlan', () => {
  test('builds a deterministic schedule honoring dependencies and worker speed', () => {
    const plan = buildExecutionPlan(createFixture())

    expect(plan.totalDurationDays).toBe(7)
    expect(plan.criticalPathDays).toBe(7)

    expect(
      plan.tasks.map(task => ({
        taskId: task.taskId,
        workerId: task.workerId,
        startDay: task.startDay,
        endDay: task.endDay,
      })),
    ).toEqual([
      {
        taskId: 'api-schema',
        workerId: 'backend-fast',
        startDay: 0,
        endDay: 1,
      },
      {
        taskId: 'auth-service',
        workerId: 'backend-fast',
        startDay: 1,
        endDay: 3,
      },
      {
        taskId: 'dashboard-ui',
        workerId: 'frontend-main',
        startDay: 1,
        endDay: 4,
      },
      {
        taskId: 'integration',
        workerId: 'backend-fast',
        startDay: 4,
        endDay: 5,
      },
      {
        taskId: 'qa-pass',
        workerId: 'qa-main',
        startDay: 5,
        endDay: 7,
      },
    ])
  })

  test('uses deterministic tie-breakers when finish day is equal', () => {
    const input: PlannerInput = {
      workers: [
        {
          id: 'backend-b',
          name: 'B',
          role: 'backend',
          availableFromDay: 0,
          capacityPerDay: 1,
        },
        {
          id: 'backend-a',
          name: 'A',
          role: 'backend',
          availableFromDay: 0,
          capacityPerDay: 1,
        },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Task 1',
          requiredRole: 'backend',
          effortDays: 1,
          dependsOn: [],
          priority: 'high',
        },
      ],
    }

    const plan = buildExecutionPlan(input)
    expect(plan.tasks[0]?.workerId).toBe('backend-a')
  })

  test('throws on missing dependency references', () => {
    const input = createFixture()
    input.tasks[0] = {
      ...input.tasks[0]!,
      dependsOn: ['does-not-exist'],
    }

    expect(() => buildExecutionPlan(input)).toThrow(
      'Task api-schema depends on missing task does-not-exist',
    )
  })

  test('throws on dependency cycles', () => {
    const input = createFixture()
    input.tasks[0] = {
      ...input.tasks[0]!,
      dependsOn: ['qa-pass'],
    }

    expect(() => buildExecutionPlan(input)).toThrow(
      'Dependency cycle detected',
    )
  })

  test('throws when no worker exists for a required role', () => {
    const input = createFixture()
    input.tasks.push({
      id: 'ops-cutover',
      title: 'Ops cutover',
      requiredRole: 'ops',
      effortDays: 1,
      dependsOn: [],
      priority: 'low',
    })

    expect(() => buildExecutionPlan(input)).toThrow(
      'No worker available for role ops',
    )
  })

  test('computes utilization by worker using total calendar duration', () => {
    const plan = buildExecutionPlan(createFixture())

    expect(plan.utilizationByWorker['backend-fast']).toBeCloseTo(4 / 7, 4)
    expect(plan.utilizationByWorker['frontend-main']).toBeCloseTo(3 / 7, 4)
    expect(plan.utilizationByWorker['qa-main']).toBeCloseTo(2 / 7, 4)
    expect(plan.utilizationByWorker['backend-slow']).toBe(0)
  })
})

describe('renderExecutionPlan', () => {
  test('renders tasks in execution order and includes summary lines', () => {
    const plan = buildExecutionPlan(createFixture())
    const output = renderExecutionPlan(plan)

    expect(output).toContain('# Execution Plan')
    expect(output).toContain('Total duration: 7 days')
    expect(output).toContain('Critical path: 7 days')

    const apiIndex = output.indexOf('| api-schema |')
    const authIndex = output.indexOf('| auth-service |')
    const uiIndex = output.indexOf('| dashboard-ui |')
    const integrationIndex = output.indexOf('| integration |')

    expect(apiIndex).toBeLessThan(authIndex)
    expect(authIndex).toBeLessThan(uiIndex)
    expect(uiIndex).toBeLessThan(integrationIndex)
  })
})
