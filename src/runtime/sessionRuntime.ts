import type { Message } from '../types/message.js'
import {
  RuntimeEventBus,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeEventUnsubscribe,
} from './events.js'
import {
  createRuntimeSessionSnapshot,
  type RuntimeAgentEventPayload,
  type RuntimeSessionChannel,
  type RuntimeSwarmEventPayload,
  toRuntimeTaskSummary,
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

  constructor(config: RuntimeSessionConfig) {
    this.config = config
    this.sessionId = config.sessionId
    this.cwd = config.cwd
    this.status = config.initialStatus ?? 'idle'
    this.activeChannel = config.initialActiveChannel ?? 'cli'
    this.activeChannelUpdatedAt = new Date().toISOString()

    this.emit({
      type: 'session_started',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: new Date().toISOString(),
    })
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
      status: this.status,
      activeChannel: this.activeChannel,
      activeChannelUpdatedAt: this.activeChannelUpdatedAt,
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
  }

  setStatus(status: RuntimeSessionStatus): void {
    this.status = status
    this.refreshSnapshot()
  }

  claimActiveChannel(channel: RuntimeSessionChannel): boolean {
    if (this.activeChannel === channel) {
      return false
    }

    this.activeChannel = channel
    this.activeChannelUpdatedAt = new Date().toISOString()
    this.refreshSnapshot()
    return true
  }

  refreshSnapshot(): void {
    this.emit({
      type: 'session_updated',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: new Date().toISOString(),
    })
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
    this.emit({
      type: 'error',
      sessionId: this.sessionId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    this.emit({
      type: 'session_updated',
      sessionId: this.sessionId,
      snapshot: this.getSnapshot(),
      timestamp: new Date().toISOString(),
    })
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
}
