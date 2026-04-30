import type { Message } from '../types/message.js'
import {
  RuntimeEventBus,
  type RuntimeEvent,
  type RuntimeEventListener,
  type RuntimeEventUnsubscribe,
} from './events.js'
import {
  createRuntimeSessionSnapshot,
  toRuntimeTaskSummary,
  type RuntimeSendMessageInput,
  type RuntimeSessionConfig,
  type RuntimeSessionSnapshot,
  type RuntimeSessionStatus,
  type RuntimeTaskSummary,
} from './types.js'

export class SessionRuntime {
  readonly sessionId: string
  readonly cwd: string

  private status: RuntimeSessionStatus
  private config: RuntimeSessionConfig
  private eventBus = new RuntimeEventBus()

  constructor(config: RuntimeSessionConfig) {
    this.config = config
    this.sessionId = config.sessionId
    this.cwd = config.cwd
    this.status = config.initialStatus ?? 'idle'

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
      appState: this.config.getAppState(),
      messages: this.getMessages(),
    })
  }

  getStatus(): RuntimeSessionStatus {
    return this.status
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

  emitMessageCompleted(message: Message): void {
    this.emit({
      type: 'message_completed',
      sessionId: this.sessionId,
      message,
      timestamp: new Date().toISOString(),
    })
  }

  emitTaskUpdated(task: RuntimeTaskSummary): void {
    this.emit({
      type: 'task_updated',
      sessionId: this.sessionId,
      task,
      timestamp: new Date().toISOString(),
    })
  }

  emitSwarmUpdated(): void {
    this.emit({
      type: 'swarm_updated',
      sessionId: this.sessionId,
      swarm: this.getSnapshot().swarm,
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

  interrupt(): void {
    this.config.interrupt?.()
    this.status = 'interrupted'
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
