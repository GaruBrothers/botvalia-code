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
import type { PermissionMode } from '../types/permissions.js'
import {
  buildSwarmThreadSummaries,
  buildSwarmWaitingEdges,
  readTeamConversationEvents,
} from '../utils/swarm/teamConversationLog.js'

export type RuntimeService = {
  listSessions: () => RuntimeSessionSnapshot[]
  getSession: (sessionId: RuntimeSessionId) => RuntimeSessionSnapshot | undefined
  getSessionDetail: (
    sessionId: RuntimeSessionId,
  ) => Promise<RuntimeSessionDetail | undefined>
  hasSession: (sessionId: RuntimeSessionId) => boolean
  sendMessage: (
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
  ) => Promise<void>
  setPermissionMode: (
    sessionId: RuntimeSessionId,
    mode: PermissionMode,
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
    getSessionDetail: async sessionId => {
      const runtime = registry.get(sessionId)
      if (!runtime) {
        return undefined
      }

      const snapshot = runtime.getSnapshot()
      let swarmThreads = []
      let swarmWaitingEdges = []

      if (snapshot.swarm.teamName) {
        const conversationEvents = await readTeamConversationEvents(
          snapshot.swarm.teamName,
        )
        swarmThreads = buildSwarmThreadSummaries(conversationEvents)
        swarmWaitingEdges = buildSwarmWaitingEdges(conversationEvents)
      }

      return createRuntimeSessionDetail({
        snapshot,
        messages: runtime.getMessages(),
        tasks: runtime.getTasks(),
        swarmThreads,
        swarmWaitingEdges,
      })
    },
    hasSession: sessionId => registry.has(sessionId),
    sendMessage: async (sessionId, input) => {
      const runtime = requireRuntime(registry, sessionId)
      await runtime.submit(input)
    },
    setPermissionMode: async (sessionId, mode) => {
      const runtime = requireRuntime(registry, sessionId)
      await runtime.setPermissionMode(mode)
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
