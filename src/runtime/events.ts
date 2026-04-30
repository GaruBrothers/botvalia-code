import type { Message } from '../types/message.js'
import type {
  RuntimeSessionId,
  RuntimeSessionSnapshot,
  RuntimeSwarmSummary,
  RuntimeTaskSummary,
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
      type: 'message_completed'
      sessionId: RuntimeSessionId
      message: Message
      timestamp: string
    }
  | {
      type: 'task_updated'
      sessionId: RuntimeSessionId
      task: RuntimeTaskSummary
      timestamp: string
    }
  | {
      type: 'swarm_updated'
      sessionId: RuntimeSessionId
      swarm: RuntimeSwarmSummary
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
