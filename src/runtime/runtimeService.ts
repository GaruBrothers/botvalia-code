import { randomUUID } from 'crypto'
import { join } from 'path'
import type { RuntimeEventListener, RuntimeEventUnsubscribe } from './events.js'
import {
  getGlobalRuntimeRegistry,
  type RuntimeRegistry,
  type RuntimeRegistryEvent,
  type RuntimeRegistryListener,
} from './runtimeRegistry.js'
import type {
  RuntimeModelOption,
  RuntimeSessionChannel,
  RuntimeSessionDetail,
  RuntimeSessionEventRecord,
  RuntimeSendMessageInput,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'
import { createRuntimeSessionDetail } from './types.js'
import type { PermissionMode } from '../types/permissions.js'
import type { ModelSetting } from '../utils/model/model.js'
import {
  buildSwarmThreadSummaries,
  buildSwarmWaitingEdges,
  readTeamConversationEvents,
} from '../utils/swarm/teamConversationLog.js'
import {
  getProjectDir,
  loadAllLogsFromSessionFile,
  saveCustomTitle,
} from '../utils/sessionStorage.js'
import { resolveSessionFilePath } from '../utils/sessionStoragePortable.js'
import { getModelOptions } from '../utils/model/modelOptions.js'
import {
  createRuntimeSessionDetailFromRecord,
  findRuntimeSessionRecord,
  findRuntimeSessionRecordSync,
  listRuntimeSessionRecordsSync,
  type RuntimeSessionRecord,
  writeRuntimeSessionRecord,
} from './runtimeSessionStore.js'
import { RuntimeProtocolError } from './runtimeErrors.js'

type RuntimeMutationActor =
  | {
      channel: 'web-ui'
      clientId: string
      leaseId?: string
    }
  | {
      channel: 'cli'
    }
  | undefined

type RuntimeSessionCreateInput = {
  title: string
  cwd: string
  notes?: string
}

type RuntimeClaimResult = {
  snapshot: RuntimeSessionSnapshot
  leaseId: string | null
  leaseExpiresAt: string | null
}

type RuntimeCreateSessionResult = {
  session: RuntimeSessionSnapshot
  leaseId: string | null
  leaseExpiresAt: string | null
}

export type RuntimeService = {
  listSessions: () => RuntimeSessionSnapshot[]
  getSession: (sessionId: RuntimeSessionId) => RuntimeSessionSnapshot | undefined
  getSessionDetail: (
    sessionId: RuntimeSessionId,
  ) => Promise<RuntimeSessionDetail | undefined>
  getSessionEvents: (
    sessionId: RuntimeSessionId,
  ) => Promise<RuntimeSessionEventRecord[]>
  listModels: () => RuntimeModelOption[]
  hasSession: (sessionId: RuntimeSessionId) => boolean
  createSession: (
    input: RuntimeSessionCreateInput,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeCreateSessionResult>
  sendMessage: (
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
    actor?: RuntimeMutationActor,
  ) => Promise<void>
  renameSession: (
    sessionId: RuntimeSessionId,
    title: string,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  archiveSession: (
    sessionId: RuntimeSessionId,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  unarchiveSession: (
    sessionId: RuntimeSessionId,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  pinSession: (
    sessionId: RuntimeSessionId,
    pinned: boolean,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  updateSessionNotes: (
    sessionId: RuntimeSessionId,
    notes: string,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  setSessionModel: (
    sessionId: RuntimeSessionId,
    model: ModelSetting,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeSessionSnapshot>
  setPermissionMode: (
    sessionId: RuntimeSessionId,
    mode: PermissionMode,
    actor?: RuntimeMutationActor,
    channel?: RuntimeSessionChannel,
  ) => Promise<RuntimeSessionSnapshot>
  interrupt: (
    sessionId: RuntimeSessionId,
    actor?: RuntimeMutationActor,
    channel?: RuntimeSessionChannel,
  ) => void
  claimSession: (
    sessionId: RuntimeSessionId,
    channel: RuntimeSessionChannel,
    actor?: RuntimeMutationActor,
  ) => Promise<RuntimeClaimResult>
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
    throw new RuntimeProtocolError(
      'session_not_found',
      `No existe una sesión runtime activa con id ${sessionId}.`,
    )
  }
  return runtime
}

function createEventRecord(params: {
  sessionId: RuntimeSessionId
  source: RuntimeSessionEventRecord['source']
  severity: RuntimeSessionEventRecord['severity']
  eventType: string
  message: string
  timestamp?: string
}): RuntimeSessionEventRecord {
  const timestamp = params.timestamp ?? new Date().toISOString()
  return {
    id: `${params.eventType}-${params.sessionId}-${Date.parse(timestamp) || Date.now()}`,
    timestamp,
    source: params.source,
    severity: params.severity,
    eventType: params.eventType,
    message: params.message,
  }
}

function createBaseInactiveSnapshot(input: {
  sessionId: RuntimeSessionId
  cwd: string
  title: string
  notes?: string
  activeChannel: RuntimeSessionChannel
  clientId?: string
}): RuntimeSessionSnapshot {
  const now = new Date().toISOString()
  const leaseId = input.clientId ? randomUUID() : undefined
  const leaseExpiresAt = input.clientId
    ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
    : undefined

  return {
    sessionId: input.sessionId,
    cwd: input.cwd,
    title: input.title.trim() || input.sessionId.slice(0, 8),
    isArchived: false,
    isPinned: false,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    hasLiveRuntime: false,
    activeChannel: input.activeChannel,
    activeChannelUpdatedAt: now,
    channelOwner: input.clientId
      ? {
          channel: 'web-ui',
          clientId: input.clientId,
          leaseId,
          claimedAt: now,
          leaseExpiresAt,
        }
      : null,
    leaseExpiresAt,
    permissionMode: 'default',
    isBypassPermissionsModeAvailable: false,
    isAutoModeAvailable: false,
    messageCount: 0,
    taskCount: 0,
    mainLoopModel: null,
    mainLoopModelForSession: null,
    swarm: {
      isLeader: false,
      teammateNames: [],
      teammates: [],
    },
  }
}

export function createRuntimeService(
  registry: RuntimeRegistry = getGlobalRuntimeRegistry(),
): RuntimeService {
  const persistedCache = new Map<RuntimeSessionId, RuntimeSessionRecord>()

  function syncCacheFromDisk(): void {
    for (const record of listRuntimeSessionRecordsSync()) {
      if (!persistedCache.has(record.snapshot.sessionId)) {
        persistedCache.set(record.snapshot.sessionId, record)
      }
    }
  }

  function getCachedRecordSync(
    sessionId: RuntimeSessionId,
  ): RuntimeSessionRecord | undefined {
    const cached = persistedCache.get(sessionId)
    if (cached) {
      return cached
    }

    const diskRecord = findRuntimeSessionRecordSync(sessionId) ?? undefined
    if (diskRecord) {
      persistedCache.set(sessionId, diskRecord)
    }
    return diskRecord
  }

  async function getCachedRecord(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionRecord | undefined> {
    const cached = getCachedRecordSync(sessionId)
    if (cached) {
      return cached
    }

    const diskRecord = (await findRuntimeSessionRecord(sessionId)) ?? undefined
    if (diskRecord) {
      persistedCache.set(sessionId, diskRecord)
    }
    return diskRecord
  }

  async function persistCachedRecord(record: RuntimeSessionRecord): Promise<void> {
    persistedCache.set(record.snapshot.sessionId, record)
    await writeRuntimeSessionRecord(record.snapshot, record.events)
  }

  function authorizePersistedSessionMutation(
    record: RuntimeSessionRecord,
    actor?: RuntimeMutationActor,
  ): void {
    if (!actor || actor.channel !== 'web-ui') {
      return
    }

    const owner = record.snapshot.channelOwner
    if (
      !owner ||
      owner.channel !== 'web-ui' ||
      owner.clientId !== actor.clientId
    ) {
      throw new RuntimeProtocolError(
        'channel_conflict',
        'La Web UI ya no tiene ownership vigente de esta sesión persistida.',
      )
    }

    if (owner.leaseExpiresAt && Date.parse(owner.leaseExpiresAt) <= Date.now()) {
      throw new RuntimeProtocolError(
        'lease_expired',
        'El lease de la Web UI expiró para esta sesión persistida.',
      )
    }

    if (!actor.leaseId || owner.leaseId !== actor.leaseId) {
      throw new RuntimeProtocolError(
        'unauthorized',
        'La mutación llegó sin un lease válido para la sesión persistida.',
      )
    }
  }

  async function updatePersistedRecord(
    sessionId: RuntimeSessionId,
    actor: RuntimeMutationActor,
    updater: (
      record: RuntimeSessionRecord,
    ) => Promise<RuntimeSessionRecord> | RuntimeSessionRecord,
  ): Promise<RuntimeSessionRecord> {
    const record = await getCachedRecord(sessionId)
    if (!record) {
      throw new RuntimeProtocolError(
        'session_not_found',
        `No existe una sesión runtime o persistida con id ${sessionId}.`,
      )
    }

    authorizePersistedSessionMutation(record, actor)
    const nextRecord = await updater(record)
    await persistCachedRecord(nextRecord)
    return nextRecord
  }

  async function getDetailForPersistedRecord(
    record: RuntimeSessionRecord,
  ): Promise<RuntimeSessionDetail> {
    const resolvedTranscript = await resolveSessionFilePath(
      record.snapshot.sessionId,
      record.snapshot.cwd,
    )

    if (!resolvedTranscript) {
      return createRuntimeSessionDetailFromRecord(
        record.snapshot,
        record.events,
      )
    }

    const logs = await loadAllLogsFromSessionFile(
      resolvedTranscript.filePath,
      record.snapshot.cwd,
    )
    const latestLog = logs.sort(
      (left, right) => right.modified.getTime() - left.modified.getTime(),
    )[0]

    return createRuntimeSessionDetail({
      snapshot: record.snapshot,
      messages: latestLog?.messages ?? [],
      tasks: [],
      events: record.events,
    })
  }

  return {
    listSessions: () => {
      syncCacheFromDisk()
      const liveSnapshots = registry.listSnapshots()
      const liveIds = new Set(liveSnapshots.map(snapshot => snapshot.sessionId))
      const persistedSnapshots = [...persistedCache.values()]
        .filter(record => !liveIds.has(record.snapshot.sessionId))
        .map(record => record.snapshot)

      return [...liveSnapshots, ...persistedSnapshots].sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )
    },
    getSession: sessionId =>
      registry.get(sessionId)?.getSnapshot() ??
      getCachedRecordSync(sessionId)?.snapshot,
    getSessionDetail: async sessionId => {
      const runtime = registry.get(sessionId)
      if (runtime) {
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
          events: runtime.getEventHistory(),
        })
      }

      const record = await getCachedRecord(sessionId)
      if (!record) {
        return undefined
      }

      return getDetailForPersistedRecord(record)
    },
    getSessionEvents: async sessionId => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        return runtime.getEventHistory()
      }

      return (await getCachedRecord(sessionId))?.events ?? []
    },
    listModels: () =>
      getModelOptions().map(option => ({
        value: option.value,
        label: option.label,
        description: option.description,
      })),
    hasSession: sessionId =>
      Boolean(registry.get(sessionId) || getCachedRecordSync(sessionId)),
    createSession: async (input, actor) => {
      const sessionId = randomUUID()
      const snapshot = createBaseInactiveSnapshot({
        sessionId,
        cwd: input.cwd,
        title: input.title,
        notes: input.notes,
        activeChannel: actor?.channel === 'web-ui' ? 'web-ui' : 'cli',
        clientId: actor?.channel === 'web-ui' ? actor.clientId : undefined,
      })
      const events = [
        createEventRecord({
          sessionId,
          source: 'service',
          severity: 'info',
          eventType: 'session_created',
          message:
            actor?.channel === 'web-ui'
              ? 'Session record created from the runtime web UI.'
              : 'Session record created from the CLI runtime command.',
          timestamp: snapshot.createdAt,
        }),
      ]

      const record: RuntimeSessionRecord = {
        snapshot,
        events,
        path: '',
      }
      await persistCachedRecord(record)

      return {
        session: record.snapshot,
        leaseId: record.snapshot.channelOwner?.leaseId ?? null,
        leaseExpiresAt: record.snapshot.channelOwner?.leaseExpiresAt ?? null,
      }
    },
    sendMessage: async (sessionId, input, actor) => {
      const runtime = registry.get(sessionId)
      if (!runtime) {
        if (await getCachedRecord(sessionId)) {
          throw new RuntimeProtocolError(
            'runtime_unavailable',
            'La sesión existe como record persistido, pero todavía no tiene un worker runtime vivo para recibir mensajes.',
          )
        }

        throw new RuntimeProtocolError(
          'session_not_found',
          `No existe una sesión runtime activa con id ${sessionId}.`,
        )
      }

      if (actor?.channel === 'web-ui') {
        runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
      }

      await runtime.submit(input)
    },
    renameSession: async (sessionId, title, actor) => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) {
        throw new RuntimeProtocolError(
          'validation_error',
          'El título de la sesión no puede quedar vacío.',
        )
      }

      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.rename(trimmedTitle)
        runtime.recordServiceEvent(
          'session_renamed',
          `Session renamed to "${trimmedTitle}".`,
        )

        const snapshot = runtime.getSnapshot()
        const fullPath = join(getProjectDir(snapshot.cwd), `${sessionId}.jsonl`)
        await saveCustomTitle(sessionId, trimmedTitle, fullPath)
        return snapshot
      }

      const record = await updatePersistedRecord(sessionId, actor, async current => {
        const updatedAt = new Date().toISOString()
        const nextRecord: RuntimeSessionRecord = {
          ...current,
          snapshot: {
            ...current.snapshot,
            title: trimmedTitle,
            updatedAt,
          },
          events: [
            createEventRecord({
              sessionId,
              source: 'service',
              severity: 'info',
              eventType: 'session_renamed',
              message: `Session renamed to "${trimmedTitle}".`,
              timestamp: updatedAt,
            }),
            ...current.events,
          ].slice(0, 200),
        }

        const resolvedTranscript = await resolveSessionFilePath(
          sessionId,
          current.snapshot.cwd,
        )
        if (resolvedTranscript) {
          await saveCustomTitle(sessionId, trimmedTitle, resolvedTranscript.filePath)
        }

        return nextRecord
      })

      return record.snapshot
    },
    archiveSession: async (sessionId, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setArchived(true)
        runtime.recordServiceEvent('session_archived', 'Session archived.')
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              isArchived: true,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'info',
                eventType: 'session_archived',
                message: 'Session archived.',
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    unarchiveSession: async (sessionId, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setArchived(false)
        runtime.recordServiceEvent('session_restored', 'Session restored.')
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              isArchived: false,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'info',
                eventType: 'session_restored',
                message: 'Session restored.',
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    pinSession: async (sessionId, pinned, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setPinned(pinned)
        runtime.recordServiceEvent(
          pinned ? 'session_pinned' : 'session_unpinned',
          pinned ? 'Session pinned.' : 'Session unpinned.',
        )
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              isPinned: pinned,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'info',
                eventType: pinned ? 'session_pinned' : 'session_unpinned',
                message: pinned ? 'Session pinned.' : 'Session unpinned.',
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    updateSessionNotes: async (sessionId, notes, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setNotes(notes)
        runtime.recordServiceEvent('session_notes_updated', 'Session notes updated.')
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              notes: notes.trim() || undefined,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'info',
                eventType: 'session_notes_updated',
                message: 'Session notes updated.',
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    setSessionModel: async (sessionId, model, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setSessionModel(model)
        runtime.recordServiceEvent(
          'session_model_updated',
          `Session model set to ${model || 'auto'}.`,
        )
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              mainLoopModelForSession: model,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'warn',
                eventType: 'session_model_updated',
                message: `Session model set to ${model || 'auto'}.`,
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    setPermissionMode: async (sessionId, mode, actor, channel) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        if (actor?.channel === 'web-ui') {
          runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
        }

        await runtime.setPermissionMode(mode, channel ?? actor?.channel ?? 'cli')
        runtime.recordServiceEvent(
          'session_permission_mode_updated',
          `Permission mode set to ${mode}.`,
        )
        return runtime.getSnapshot()
      }

      return (
        await updatePersistedRecord(sessionId, actor, current => {
          const updatedAt = new Date().toISOString()
          return {
            ...current,
            snapshot: {
              ...current.snapshot,
              permissionMode: mode,
              updatedAt,
            },
            events: [
              createEventRecord({
                sessionId,
                source: 'service',
                severity: 'info',
                eventType: 'session_permission_mode_updated',
                message: `Permission mode set to ${mode}.`,
                timestamp: updatedAt,
              }),
              ...current.events,
            ].slice(0, 200),
          }
        })
      ).snapshot
    },
    interrupt: (sessionId, actor, channel) => {
      const runtime = registry.get(sessionId)
      if (!runtime) {
        if (getCachedRecordSync(sessionId)) {
          throw new RuntimeProtocolError(
            'runtime_unavailable',
            'La sesión existe, pero no hay un worker runtime vivo que se pueda interrumpir.',
          )
        }

        throw new RuntimeProtocolError(
          'session_not_found',
          `No existe una sesión runtime activa con id ${sessionId}.`,
        )
      }

      if (actor?.channel === 'web-ui') {
        runtime.authorizeWebMutation(actor.clientId, actor.leaseId)
      }

      runtime.interrupt(channel ?? actor?.channel ?? 'cli')
    },
    claimSession: async (sessionId, channel, actor) => {
      const runtime = registry.get(sessionId)
      if (runtime) {
        let leaseId: string | null = null
        let leaseExpiresAt: string | null = null

        if (channel === 'web-ui') {
          if (!actor || actor.channel !== 'web-ui') {
            throw new RuntimeProtocolError(
              'unauthorized',
              'La Web UI debe identificarse para reclamar una sesión runtime.',
            )
          }

          const lease = runtime.claimWebUiLease(actor.clientId)
          runtime.recordServiceEvent(
            'session_claimed',
            'Runtime web UI claimed active control of the session.',
          )
          leaseId = lease.leaseId ?? null
          leaseExpiresAt = lease.leaseExpiresAt ?? null
        } else {
          runtime.claimActiveChannel(channel)
          runtime.recordServiceEvent(
            'session_claimed',
            'CLI reclaimed active control of the session.',
          )
        }

        return {
          snapshot: runtime.getSnapshot(),
          leaseId,
          leaseExpiresAt,
        }
      }

      const record = await updatePersistedRecord(sessionId, undefined, current => {
        if (channel !== 'web-ui') {
          throw new RuntimeProtocolError(
            'runtime_unavailable',
            'Solo la Web UI puede reclamar una sesión persistida sin worker vivo.',
          )
        }

        if (!actor || actor.channel !== 'web-ui') {
          throw new RuntimeProtocolError(
            'unauthorized',
            'La Web UI debe identificarse para reclamar una sesión persistida.',
          )
        }

        const now = new Date().toISOString()
        const nextLeaseId = randomUUID()
        const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            activeChannel: 'web-ui',
            activeChannelUpdatedAt: now,
            updatedAt: now,
            channelOwner: {
              channel: 'web-ui',
              clientId: actor.clientId,
              leaseId: nextLeaseId,
              claimedAt: now,
              leaseExpiresAt,
            },
            leaseExpiresAt,
          },
          events: [
            createEventRecord({
              sessionId,
              source: 'service',
              severity: 'info',
              eventType: 'session_claimed',
              message: 'Runtime web UI claimed active control of the persisted session.',
              timestamp: now,
            }),
            ...current.events,
          ].slice(0, 200),
        }
      })

      return {
        snapshot: record.snapshot,
        leaseId: record.snapshot.channelOwner?.leaseId ?? null,
        leaseExpiresAt: record.snapshot.channelOwner?.leaseExpiresAt ?? null,
      }
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
