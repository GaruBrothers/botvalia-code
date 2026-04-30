import type { RuntimeEventListener, RuntimeEventUnsubscribe } from './events.js'
import {
  getGlobalRuntimeRegistry,
  type RuntimeRegistry,
  type RuntimeRegistryEvent,
  type RuntimeRegistryListener,
} from './runtimeRegistry.js'
import type {
  RuntimeSendMessageInput,
  RuntimeSessionDetail,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'
import { createRuntimeSessionDetail } from './types.js'

export type RuntimeService = {
  listSessions: () => RuntimeSessionSnapshot[]
  getSession: (sessionId: RuntimeSessionId) => RuntimeSessionSnapshot | undefined
  getSessionDetail: (
    sessionId: RuntimeSessionId,
  ) => RuntimeSessionDetail | undefined
  hasSession: (sessionId: RuntimeSessionId) => boolean
  sendMessage: (
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
  ) => Promise<void>
  interrupt: (sessionId: RuntimeSessionId) => void
  subscribe: (listener: RuntimeRegistryListener) => RuntimeEventUnsubscribe
  subscribeToSession: (
    sessionId: RuntimeSessionId,
    listener: RuntimeEventListener,
  ) => RuntimeEventUnsubscribe
}

function requireRuntime(
  registry: RuntimeRegistry,
  sessionId: RuntimeSessionId,
) {
  const runtime = registry.get(sessionId)
  if (!runtime) {
    throw new Error(`No existe una sesión runtime activa con id ${sessionId}.`)
  }
  return runtime
}

export function createRuntimeService(
  registry: RuntimeRegistry = getGlobalRuntimeRegistry(),
): RuntimeService {
  return {
    listSessions: () => registry.listSnapshots(),
    getSession: sessionId => registry.get(sessionId)?.getSnapshot(),
    getSessionDetail: sessionId => {
      const runtime = registry.get(sessionId)
      if (!runtime) {
        return undefined
      }

      return createRuntimeSessionDetail({
        snapshot: runtime.getSnapshot(),
        messages: runtime.getMessages(),
        tasks: runtime.getTasks(),
      })
    },
    hasSession: sessionId => registry.has(sessionId),
    sendMessage: async (sessionId, input) => {
      const runtime = requireRuntime(registry, sessionId)
      await runtime.submit(input)
    },
    interrupt: sessionId => {
      const runtime = requireRuntime(registry, sessionId)
      runtime.interrupt()
    },
    subscribe: listener => registry.subscribe(listener),
    subscribeToSession: (sessionId, listener) => {
      const runtime = requireRuntime(registry, sessionId)
      return runtime.onEvent(listener)
    },
  }
}

const globalRuntimeService = createRuntimeService()

export function getGlobalRuntimeService(): RuntimeService {
  return globalRuntimeService
}

export type { RuntimeRegistryEvent }
