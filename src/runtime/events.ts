import type { Message } from '../types/message.js'
import type { PermissionMode } from '../types/permissions.js'
import type {
  RuntimeAgentEventPayload,
  RuntimeExecutionSource,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
  RuntimeSwarmSummary,
  RuntimeSwarmEventPayload,
  RuntimeTaskEventPayload,
  RuntimeTaskSummary,
  RuntimeThinkingSummary,
  RuntimeToolEventPayload,
} from './types.js'

export type RuntimeEvent =
  | {
      type: 'session_started'
      sessionId: RuntimeSessionId
      snapshot: RuntimeSessionSnapshot
      timestamp: string
    }
  | {
      type: 'session_updated'
      sessionId: RuntimeSessionId
      snapshot: RuntimeSessionSnapshot
      timestamp: string
    }
  | {
      type: 'message_delta'
      sessionId: RuntimeSessionId
      delta: string
      timestamp: string
    }
  | {
      type: 'thinking_started'
      sessionId: RuntimeSessionId
      thinking: RuntimeThinkingSummary
      timestamp: string
    }
  | {
      type: 'thinking_delta'
      sessionId: RuntimeSessionId
      delta: string
      thinking: RuntimeThinkingSummary
      timestamp: string
    }
  | {
      type: 'thinking_completed'
      sessionId: RuntimeSessionId
      thinking: RuntimeThinkingSummary
      timestamp: string
    }
  | {
      type: 'message_completed'
      sessionId: RuntimeSessionId
      message: Message
      timestamp: string
    }
  | {
      type: 'task_updated'
      sessionId: RuntimeSessionId
      task: RuntimeTaskSummary
      source?: RuntimeExecutionSource
      timestamp: string
    }
  | {
      type: 'task_started'
      sessionId: RuntimeSessionId
      payload: RuntimeTaskEventPayload
      timestamp: string
    }
  | {
      type: 'task_progress'
      sessionId: RuntimeSessionId
      payload: RuntimeTaskEventPayload
      timestamp: string
    }
  | {
      type: 'task_completed'
      sessionId: RuntimeSessionId
      payload: RuntimeTaskEventPayload
      timestamp: string
    }
  | {
      type: 'tool_started'
      sessionId: RuntimeSessionId
      payload: RuntimeToolEventPayload
      timestamp: string
    }
  | {
      type: 'tool_progress'
      sessionId: RuntimeSessionId
      payload: RuntimeToolEventPayload
      timestamp: string
    }
  | {
      type: 'tool_completed'
      sessionId: RuntimeSessionId
      payload: RuntimeToolEventPayload
      timestamp: string
    }
  | {
      type: 'swarm_updated'
      sessionId: RuntimeSessionId
      swarm: RuntimeSwarmSummary
      timestamp: string
    }
  | {
      type: 'swarm_event'
      sessionId: RuntimeSessionId
      payload: RuntimeSwarmEventPayload
      timestamp: string
    }
  | {
      type: 'agent_event'
      sessionId: RuntimeSessionId
      payload: RuntimeAgentEventPayload
      timestamp: string
    }
  | {
      type: 'model_switched'
      sessionId: RuntimeSessionId
      model: string
      reason?: string
      timestamp: string
    }
  | {
      type: 'permission_mode_changed'
      sessionId: RuntimeSessionId
      mode: PermissionMode
      timestamp: string
    }
  | {
      type: 'interrupted'
      sessionId: RuntimeSessionId
      timestamp: string
    }
  | {
      type: 'error'
      sessionId: RuntimeSessionId
      error: string
      timestamp: string
    }

export type RuntimeEventListener = (event: RuntimeEvent) => void
export type RuntimeEventUnsubscribe = () => void

export class RuntimeEventBus {
  private listeners = new Set<RuntimeEventListener>()

  subscribe(listener: RuntimeEventListener): RuntimeEventUnsubscribe {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
