import type { RuntimeEvent, RuntimeEventListener, RuntimeEventUnsubscribe } from './events.js'
import type { SessionRuntime } from './sessionRuntime.js'
import type { RuntimeSessionId, RuntimeSessionSnapshot } from './types.js'

export type RuntimeRegistryEvent =
  | {
      type: 'registered'
      sessionId: RuntimeSessionId
      snapshot: RuntimeSessionSnapshot
      timestamp: string
    }
  | {
      type: 'unregistered'
      sessionId: RuntimeSessionId
      timestamp: string
    }
  | {
      type: 'runtime_event'
      sessionId: RuntimeSessionId
      event: RuntimeEvent
      timestamp: string
    }

export type RuntimeRegistryListener = (
  event: RuntimeRegistryEvent,
) => void

type RuntimeRegistryEntry = {
  runtime: SessionRuntime
  unsubscribe: RuntimeEventUnsubscribe
  registeredAt: string
  lastEventAt: string
}

export class RuntimeRegistry {
  private entries = new Map<RuntimeSessionId, RuntimeRegistryEntry>()
  private listeners = new Set<RuntimeRegistryListener>()

  subscribe(listener: RuntimeRegistryListener): RuntimeEventUnsubscribe {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: RuntimeRegistryEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  register(runtime: SessionRuntime): RuntimeEventUnsubscribe {
    const existing = this.entries.get(runtime.sessionId)
    if (existing) {
      existing.unsubscribe()
      this.entries.delete(runtime.sessionId)
    }

    const registeredAt = new Date().toISOString()
    const entry: RuntimeRegistryEntry = {
      runtime,
      unsubscribe: () => {},
      registeredAt,
      lastEventAt: registeredAt,
    }

    const unsubscribe = runtime.onEvent(event => {
      const current = this.entries.get(runtime.sessionId)
      if (!current) {
        return
      }

      current.lastEventAt = event.timestamp
      this.emit({
        type: 'runtime_event',
        sessionId: runtime.sessionId,
        event,
        timestamp: event.timestamp,
      })
    })

    entry.unsubscribe = unsubscribe
    this.entries.set(runtime.sessionId, entry)

    this.emit({
      type: 'registered',
      sessionId: runtime.sessionId,
      snapshot: runtime.getSnapshot(),
      timestamp: registeredAt,
    })

    return () => {
      this.unregister(runtime.sessionId)
    }
  }

  unregister(sessionId: RuntimeSessionId): void {
    const entry = this.entries.get(sessionId)
    if (!entry) {
      return
    }

    entry.unsubscribe()
    this.entries.delete(sessionId)

    this.emit({
      type: 'unregistered',
      sessionId,
      timestamp: new Date().toISOString(),
    })
  }

  get(sessionId: RuntimeSessionId): SessionRuntime | undefined {
    return this.entries.get(sessionId)?.runtime
  }

  listSessions(): SessionRuntime[] {
    return [...this.entries.values()].map(entry => entry.runtime)
  }

  listSnapshots(): RuntimeSessionSnapshot[] {
    return this.listSessions().map(runtime => runtime.getSnapshot())
  }

  has(sessionId: RuntimeSessionId): boolean {
    return this.entries.has(sessionId)
  }

  getRegisteredAt(sessionId: RuntimeSessionId): string | undefined {
    return this.entries.get(sessionId)?.registeredAt
  }

  getLastEventAt(sessionId: RuntimeSessionId): string | undefined {
    return this.entries.get(sessionId)?.lastEventAt
  }
}

const globalRuntimeRegistry = new RuntimeRegistry()

export function getGlobalRuntimeRegistry(): RuntimeRegistry {
  return globalRuntimeRegistry
}

export function registerRuntime(runtime: SessionRuntime): RuntimeEventUnsubscribe {
  return globalRuntimeRegistry.register(runtime)
}
