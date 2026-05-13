import { randomUUID } from 'crypto'
import type { Message } from '../types/message.js'
import type { ModelSetting } from '../utils/model/model.js'
import {
  RuntimeEventBus,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeEventUnsubscribe,
} from './events.js'
import {
  createRuntimeSessionSnapshot,
  type RuntimeLeaseId,
  type RuntimeAgentEventPayload,
  type RuntimeSessionChannel,
  type RuntimeSessionChannelOwner,
  type RuntimeSwarmEventPayload,
  toRuntimeTaskSummary,
  type RuntimeSessionEventRecord,
  type RuntimeSendMessageInput,
  type RuntimeSessionConfig,
  type RuntimeSessionSnapshot,
  type RuntimeSessionStatus,
  type RuntimeTaskSummary,
  type RuntimeTaskEventPayload,
  type RuntimeThinkingSummary,
  type RuntimeToolEventPayload,
} from './types.js'
import type { PermissionMode } from '../types/permissions.js'
import {
  readRuntimeSessionRecordSync,
  writeRuntimeSessionRecord,
} from './runtimeSessionStore.js'
import { RuntimeProtocolError } from './runtimeErrors.js'

const WEB_UI_LEASE_DURATION_MS = 5 * 60 * 1000

export class SessionRuntime {
  readonly sessionId: string
  readonly cwd: string

  private status: RuntimeSessionStatus
  private config: RuntimeSessionConfig
  private eventBus = new RuntimeEventBus()
  private thinkingActive = false
  private currentThinking: RuntimeThinkingSummary = {
    source: 'session-runtime',
  }
  private taskStatuses = new Map<string, string>()
  private activeTools = new Map<string, RuntimeToolEventPayload>()
  private activeChannel: RuntimeSessionChannel
  private activeChannelUpdatedAt: string
  private channelOwner: RuntimeSessionChannelOwner | null
  private title: string
  private isArchived: boolean
  private isPinned: boolean
  private notes?: string
  private createdAt: string
  private updatedAt: string
  private eventHistory: RuntimeSessionEventRecord[]
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: RuntimeSessionConfig) {
    const now = new Date().toISOString()
    const persistedRecord = readRuntimeSessionRecordSync(
      config.sessionId,
      config.cwd,
    )

    this.config = config
    this.sessionId = config.sessionId
    this.cwd = config.cwd
    this.status = config.initialStatus ?? 'idle'
    this.activeChannel = config.initialActiveChannel ?? 'cli'
    this.activeChannelUpdatedAt =
      persistedRecord?.snapshot.activeChannelUpdatedAt ?? now
    this.channelOwner = null
    this.title = persistedRecord?.snapshot.title || config.sessionId.slice(0, 8)
    this.isArchived = persistedRecord?.snapshot.isArchived ?? false
    this.isPinned = persistedRecord?.snapshot.isPinned ?? false
    this.notes = persistedRecord?.snapshot.notes
    this.createdAt = persistedRecord?.snapshot.createdAt ?? now
    this.updatedAt = persistedRecord?.snapshot.updatedAt ?? now
    this.eventHistory = persistedRecord?.events ?? []

    this.emit({
      type: 'session_started',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: now,
    })
    this.schedulePersist()

    const persistedSessionModel =
      persistedRecord?.snapshot.mainLoopModelForSession ?? null
    if (persistedSessionModel && this.config.setSessionModel) {
      void Promise.resolve()
        .then(() =>
          this.setSessionModel(
            persistedSessionModel,
            'restored from persisted runtime session metadata',
          ),
        )
        .catch(() => {})
    }
  }

  getMessages(): readonly Message[] {
    return this.config.getMessages?.() ?? []
  }

  getTasks(): RuntimeTaskSummary[] {
    return Object.values(this.config.getAppState().tasks).map(toRuntimeTaskSummary)
  }

  getSnapshot(): RuntimeSessionSnapshot {
    return createRuntimeSessionSnapshot({
      sessionId: this.sessionId,
      cwd: this.cwd,
      title: this.title,
      isArchived: this.isArchived,
      isPinned: this.isPinned,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      hasLiveRuntime: true,
      activeChannel: this.activeChannel,
      activeChannelUpdatedAt: this.activeChannelUpdatedAt,
      channelOwner: this.channelOwner,
      appState: this.config.getAppState(),
      messages: this.getMessages(),
    })
  }

  getStatus(): RuntimeSessionStatus {
    return this.status
  }

  getActiveChannel(): RuntimeSessionChannel {
    return this.activeChannel
  }

  onEvent(listener: RuntimeEventListener): RuntimeEventUnsubscribe {
    return this.eventBus.subscribe(listener)
  }

  emit(event: RuntimeEvent): void {
    this.eventBus.emit(event)
    this.recordRuntimeEvent(event)
  }

  setStatus(status: RuntimeSessionStatus): void {
    this.status = status
    this.refreshSnapshot()
  }

  claimActiveChannel(channel: RuntimeSessionChannel): boolean {
    const previousOwner = this.channelOwner
    const shouldClearOwner =
      channel !== 'web-ui' && previousOwner?.channel === 'web-ui'

    if (this.activeChannel === channel && !shouldClearOwner) {
      return false
    }

    this.activeChannel = channel
    this.activeChannelUpdatedAt = new Date().toISOString()
    this.updatedAt = this.activeChannelUpdatedAt
    if (shouldClearOwner) {
      this.channelOwner = null
    }
    this.refreshSnapshot()
    return true
  }

  claimWebUiLease(
    clientId: string,
    leaseDurationMs = WEB_UI_LEASE_DURATION_MS,
  ): RuntimeSessionChannelOwner {
    const claimedAt = new Date().toISOString()
    const leaseId: RuntimeLeaseId = randomUUID()
    const leaseExpiresAt = new Date(
      Date.now() + leaseDurationMs,
    ).toISOString()
    const takeoverAt =
      this.channelOwner?.clientId &&
      this.channelOwner.clientId !== clientId
        ? claimedAt
        : this.channelOwner?.takeoverAt

    this.activeChannel = 'web-ui'
    this.activeChannelUpdatedAt = claimedAt
    this.updatedAt = claimedAt
    this.channelOwner = {
      channel: 'web-ui',
      clientId,
      leaseId,
      claimedAt,
      leaseExpiresAt,
      takeoverAt,
    }
    this.refreshSnapshot()
    return this.channelOwner
  }

  authorizeWebMutation(clientId: string, leaseId?: string): void {
    if (
      !this.channelOwner ||
      this.channelOwner.channel !== 'web-ui' ||
      this.channelOwner.clientId !== clientId
    ) {
      throw new RuntimeProtocolError(
        'channel_conflict',
        'La Web UI ya no tiene ownership vigente de esta sesión. Vuelve a reclamar el canal antes de mutarla.',
      )
    }

    if (
      this.channelOwner.leaseExpiresAt &&
      Date.parse(this.channelOwner.leaseExpiresAt) <= Date.now()
    ) {
      throw new RuntimeProtocolError(
        'lease_expired',
        'El lease de la Web UI expiró. Reclama la sesión otra vez para seguir mutándola.',
      )
    }

    if (!leaseId || this.channelOwner.leaseId !== leaseId) {
      throw new RuntimeProtocolError(
        'unauthorized',
        'La mutación llegó sin un lease válido para la sesión runtime activa.',
      )
    }
  }

  refreshSnapshot(): void {
    this.updatedAt = new Date().toISOString()
    this.emit({
      type: 'session_updated',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: this.updatedAt,
    })
    this.schedulePersist()
  }

  emitMessageDelta(delta: string): void {
    this.emit({
      type: 'message_delta',
      sessionId: this.sessionId,
      delta,
      timestamp: new Date().toISOString(),
    })
  }

  emitThinkingStarted(thinking?: Partial<RuntimeThinkingSummary>): void {
    const nextThinking: RuntimeThinkingSummary = {
      ...this.currentThinking,
      ...thinking,
      source: thinking?.source ?? this.currentThinking.source,
    }

    if (
      this.thinkingActive &&
      this.currentThinking.messageUuid === nextThinking.messageUuid &&
      this.currentThinking.blockType === nextThinking.blockType
    ) {
      return
    }

    this.thinkingActive = true
    this.currentThinking = nextThinking
    this.emit({
      type: 'thinking_started',
      sessionId: this.sessionId,
      thinking: this.currentThinking,
      timestamp: new Date().toISOString(),
    })
  }

  emitThinkingDelta(
    delta: string,
    thinking?: Partial<RuntimeThinkingSummary>,
  ): void {
    if (!this.thinkingActive) {
      this.emitThinkingStarted(thinking)
    } else if (thinking) {
      this.currentThinking = {
        ...this.currentThinking,
        ...thinking,
        source: thinking.source ?? this.currentThinking.source,
      }
    }

    this.emit({
      type: 'thinking_delta',
      sessionId: this.sessionId,
      delta,
      thinking: this.currentThinking,
      timestamp: new Date().toISOString(),
    })
  }

  emitThinkingCompleted(thinking?: Partial<RuntimeThinkingSummary>): void {
    if (!this.thinkingActive) {
      return
    }

    if (thinking) {
      this.currentThinking = {
        ...this.currentThinking,
        ...thinking,
        source: thinking.source ?? this.currentThinking.source,
      }
    }

    this.thinkingActive = false
    this.emit({
      type: 'thinking_completed',
      sessionId: this.sessionId,
      thinking: this.currentThinking,
      timestamp: new Date().toISOString(),
    })
    this.currentThinking = {
      source: 'session-runtime',
    }
  }

  emitMessageCompleted(message: Message): void {
    this.emitThinkingCompleted()
    this.emit({
      type: 'message_completed',
      sessionId: this.sessionId,
      message,
      timestamp: new Date().toISOString(),
    })
  }

  emitTaskUpdated(task: RuntimeTaskSummary): void {
    this.taskStatuses.set(task.id, task.status)
    this.emit({
      type: 'task_updated',
      sessionId: this.sessionId,
      task,
      source: 'app-state',
      timestamp: new Date().toISOString(),
    })
  }

  emitTaskStarted(payload: RuntimeTaskEventPayload): void {
    this.taskStatuses.set(payload.task.id, payload.task.status)
    this.emit({
      type: 'task_started',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
    this.emit({
      type: 'task_updated',
      sessionId: this.sessionId,
      task: payload.task,
      source: payload.source,
      timestamp: new Date().toISOString(),
    })
  }

  emitTaskProgress(payload: RuntimeTaskEventPayload): void {
    this.taskStatuses.set(payload.task.id, payload.task.status)
    this.emit({
      type: 'task_progress',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
    this.emit({
      type: 'task_updated',
      sessionId: this.sessionId,
      task: payload.task,
      source: payload.source,
      timestamp: new Date().toISOString(),
    })
  }

  emitTaskCompleted(payload: RuntimeTaskEventPayload): void {
    this.taskStatuses.set(payload.task.id, payload.task.status)
    this.emit({
      type: 'task_completed',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
    this.emit({
      type: 'task_updated',
      sessionId: this.sessionId,
      task: payload.task,
      source: payload.source,
      timestamp: new Date().toISOString(),
    })
  }

  getTaskStatus(taskId: string): string | undefined {
    return this.taskStatuses.get(taskId)
  }

  emitToolStarted(payload: RuntimeToolEventPayload): void {
    this.activeTools.set(payload.toolUseId, payload)
    this.emit({
      type: 'tool_started',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
  }

  emitToolProgress(payload: RuntimeToolEventPayload): void {
    const mergedPayload = {
      ...this.activeTools.get(payload.toolUseId),
      ...payload,
    }

    this.activeTools.set(payload.toolUseId, mergedPayload)
    this.emit({
      type: 'tool_progress',
      sessionId: this.sessionId,
      payload: mergedPayload,
      timestamp: new Date().toISOString(),
    })
  }

  emitToolCompleted(payload: RuntimeToolEventPayload): void {
    const mergedPayload = {
      ...this.activeTools.get(payload.toolUseId),
      ...payload,
    }

    this.activeTools.delete(payload.toolUseId)
    this.emit({
      type: 'tool_completed',
      sessionId: this.sessionId,
      payload: mergedPayload,
      timestamp: new Date().toISOString(),
    })
  }

  getActiveTool(toolUseId: string): RuntimeToolEventPayload | undefined {
    return this.activeTools.get(toolUseId)
  }

  emitSwarmUpdated(): void {
    this.emit({
      type: 'swarm_updated',
      sessionId: this.sessionId,
      swarm: this.getSnapshot().swarm,
      timestamp: new Date().toISOString(),
    })
  }

  emitSwarmEvent(payload: RuntimeSwarmEventPayload): void {
    this.emit({
      type: 'swarm_event',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
    this.emitSwarmUpdated()
  }

  emitAgentEvent(payload: RuntimeAgentEventPayload): void {
    this.emit({
      type: 'agent_event',
      sessionId: this.sessionId,
      payload,
      timestamp: new Date().toISOString(),
    })
  }

  emitModelSwitched(model: string, reason?: string): void {
    this.emit({
      type: 'model_switched',
      sessionId: this.sessionId,
      model,
      reason,
      timestamp: new Date().toISOString(),
    })
  }

  emitError(error: unknown): void {
    this.status = 'errored'
    this.thinkingActive = false
    this.currentThinking = {
      source: 'session-runtime',
    }
    this.activeTools.clear()
    this.updatedAt = new Date().toISOString()
    this.emit({
      type: 'error',
      sessionId: this.sessionId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: this.updatedAt,
    })
    this.emit({
      type: 'session_updated',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: this.updatedAt,
    })
  }

  async rename(title: string): Promise<void> {
    this.title = title.trim() || this.title
    this.updatedAt = new Date().toISOString()
    this.refreshSnapshot()
  }

  async setArchived(isArchived: boolean): Promise<void> {
    this.isArchived = isArchived
    this.updatedAt = new Date().toISOString()
    this.refreshSnapshot()
  }

  async setPinned(isPinned: boolean): Promise<void> {
    this.isPinned = isPinned
    this.updatedAt = new Date().toISOString()
    this.refreshSnapshot()
  }

  async setNotes(notes: string): Promise<void> {
    this.notes = notes.trim() || undefined
    this.updatedAt = new Date().toISOString()
    this.refreshSnapshot()
  }

  async setSessionModel(
    model: ModelSetting,
    reason = 'runtime session model override updated',
  ): Promise<void> {
    if (!this.config.setSessionModel) {
      throw new Error(
        'SessionRuntime aún no tiene setSessionModel conectado al motor real.',
      )
    }

    await this.config.setSessionModel(model)
    this.updatedAt = new Date().toISOString()
    this.emitModelSwitched(model || 'auto', reason)
    this.refreshSnapshot()
  }

  getEventHistory(): RuntimeSessionEventRecord[] {
    return [...this.eventHistory]
  }

  recordServiceEvent(
    eventType: string,
    message: string,
    severity: RuntimeSessionEventRecord['severity'] = 'info',
  ): void {
    this.eventHistory = [
      this.buildEventRecord('service', severity, eventType, message),
      ...this.eventHistory,
    ].slice(0, 200)
    this.schedulePersist()
  }

  async submit(input: RuntimeSendMessageInput): Promise<void> {
    if (!this.config.submitMessage) {
      throw new Error(
        'SessionRuntime aún no tiene submitMessage conectado al motor real.',
      )
    }

    this.claimActiveChannel(input.channel ?? 'cli')
    this.setStatus('running')

    try {
      await this.config.submitMessage(input)
      if (this.status === 'running') {
        this.setStatus('completed')
      }
    } catch (error) {
      this.emitError(error)
      throw error
    }
  }

  async setPermissionMode(
    mode: PermissionMode,
    channel?: RuntimeSessionChannel,
  ): Promise<void> {
    if (!this.config.setPermissionMode) {
      throw new Error(
        'SessionRuntime aún no tiene setPermissionMode conectado al motor real.',
      )
    }

    this.claimActiveChannel(channel ?? 'cli')
    await this.config.setPermissionMode(mode)
    this.emit({
      type: 'permission_mode_changed',
      sessionId: this.sessionId,
      mode,
      timestamp: new Date().toISOString(),
    })
    this.refreshSnapshot()
  }

  interrupt(channel?: RuntimeSessionChannel): void {
    this.claimActiveChannel(channel ?? 'cli')
    this.config.interrupt?.()
    this.status = 'interrupted'
    this.thinkingActive = false
    this.currentThinking = {
      source: 'session-runtime',
    }
    this.activeTools.clear()
    this.emit({
      type: 'interrupted',
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    })
    this.emit({
      type: 'session_updated',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: new Date().toISOString(),
    })
  }

  private recordRuntimeEvent(event: RuntimeEvent): void {
    const nextRecord = this.toEventRecord(event)
    if (!nextRecord) {
      return
    }

    this.eventHistory = [nextRecord, ...this.eventHistory].slice(0, 200)
    this.schedulePersist()
  }

  private toEventRecord(
    event: RuntimeEvent,
  ): RuntimeSessionEventRecord | null {
    switch (event.type) {
      case 'session_started':
        return this.buildEventRecord('runtime', 'info', event.type, 'Session started.')
      case 'task_started':
        return this.buildEventRecord(
          'runtime',
          'info',
          event.type,
          `Task started: ${event.payload.task.title || event.payload.task.kind || event.payload.task.id}.`,
          event.timestamp,
        )
      case 'task_completed':
        return this.buildEventRecord(
          'runtime',
          event.payload.task.status.toLowerCase().includes('fail') ? 'error' : 'info',
          event.type,
          event.payload.summary?.trim() ||
            `Task completed: ${event.payload.task.title || event.payload.task.kind || event.payload.task.id}.`,
          event.timestamp,
        )
      case 'tool_started':
        return this.buildEventRecord(
          'runtime',
          'info',
          event.type,
          `Tool started: ${event.payload.toolName}.`,
          event.timestamp,
        )
      case 'tool_completed':
        return this.buildEventRecord(
          'runtime',
          'info',
          event.type,
          event.payload.summary?.trim() || `Tool completed: ${event.payload.toolName}.`,
          event.timestamp,
        )
      case 'model_switched':
        return this.buildEventRecord(
          'runtime',
          'warn',
          event.type,
          `Model switched to ${event.model}.`,
          event.timestamp,
        )
      case 'permission_mode_changed':
        return this.buildEventRecord(
          'runtime',
          'info',
          event.type,
          `Permission mode changed to ${event.mode}.`,
          event.timestamp,
        )
      case 'interrupted':
        return this.buildEventRecord(
          'runtime',
          'warn',
          event.type,
          'Execution interrupted.',
          event.timestamp,
        )
      case 'error':
        return this.buildEventRecord(
          'runtime',
          'error',
          event.type,
          event.error,
          event.timestamp,
        )
      default:
        return null
    }
  }

  private buildEventRecord(
    source: RuntimeSessionEventRecord['source'],
    severity: RuntimeSessionEventRecord['severity'],
    eventType: string,
    message: string,
    timestamp = new Date().toISOString(),
  ): RuntimeSessionEventRecord {
    return {
      id: `${eventType}-${this.sessionId}-${Date.parse(timestamp) || Date.now()}`,
      timestamp,
      source,
      severity,
      eventType,
      message,
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void writeRuntimeSessionRecord(this.getSnapshot(), this.eventHistory).catch(
        () => {},
      )
    }, 75)
  }
}
