import type { RuntimeEventListener, RuntimeEventUnsubscribe } from './events.js'
import {
  getGlobalRuntimeRegistry,
  type RuntimeRegistry,
  type RuntimeRegistryEvent,
  type RuntimeRegistryListener,
} from './runtimeRegistry.js'
import type {
  RuntimeSessionChannel,
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
import { getProjectDir, saveCustomTitle } from '../utils/sessionStorage.js'
import { join } from 'path'

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
  renameSession: (
    sessionId: RuntimeSessionId,
    title: string,
  ) => Promise<void>
  setPermissionMode: (
    sessionId: RuntimeSessionId,
    mode: PermissionMode,
    channel?: RuntimeSessionChannel,
  ) => Promise<void>
  interrupt: (sessionId: RuntimeSessionId, channel?: RuntimeSessionChannel) => void
  claimSession: (
    sessionId: RuntimeSessionId,
    channel: RuntimeSessionChannel,
  ) => RuntimeSessionSnapshot
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
    renameSession: async (sessionId, title) => {
      const runtime = requireRuntime(registry, sessionId)
      const snapshot = runtime.getSnapshot()
      const fullPath = join(getProjectDir(snapshot.cwd), `${sessionId}.jsonl`)
      await saveCustomTitle(sessionId, title.trim(), fullPath)
    },
    setPermissionMode: async (sessionId, mode, channel) => {
      const runtime = requireRuntime(registry, sessionId)
      await runtime.setPermissionMode(mode, channel)
    },
    interrupt: (sessionId, channel) => {
      const runtime = requireRuntime(registry, sessionId)
      runtime.interrupt(channel)
    },
    claimSession: (sessionId, channel) => {
      const runtime = requireRuntime(registry, sessionId)
      runtime.claimActiveChannel(channel)
      return runtime.getSnapshot()
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
