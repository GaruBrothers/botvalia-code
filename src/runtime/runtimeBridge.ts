import { randomUUID } from 'crypto'
import type {
  RuntimeProtocolEvent,
  RuntimeProtocolEventListener,
  RuntimeProtocolEventUnsubscribe,
  RuntimeProtocolRequest,
  RuntimeProtocolResponse,
} from './protocol.js'
import {
  createRuntimeService,
  type RuntimeRegistryEvent,
  type RuntimeService,
} from './runtimeService.js'
import type { RuntimeEventUnsubscribe } from './events.js'

type BridgeSubscription = {
  unsubscribe: RuntimeEventUnsubscribe
}

export class RuntimeBridge {
  private readonly runtimeService: RuntimeService
  private readonly listeners = new Set<RuntimeProtocolEventListener>()
  private readonly subscriptions = new Map<string, BridgeSubscription>()

  constructor(runtimeService: RuntimeService = createRuntimeService()) {
    this.runtimeService = runtimeService
  }

  onEvent(
    listener: RuntimeProtocolEventListener,
  ): RuntimeProtocolEventUnsubscribe {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: RuntimeProtocolEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private registerSubscription(
    subscriptionId: string,
    unsubscribe: RuntimeEventUnsubscribe,
  ): void {
    const previous = this.subscriptions.get(subscriptionId)
    if (previous) {
      previous.unsubscribe()
    }

    this.subscriptions.set(subscriptionId, { unsubscribe })
  }

  private createRuntimeSubscription(): string {
    const subscriptionId = randomUUID()
    const unsubscribe = this.runtimeService.subscribe(
      (event: RuntimeRegistryEvent) => {
        this.emit({
          type: 'runtime_registry_event',
          subscriptionId,
          event,
          timestamp: new Date().toISOString(),
        })
      },
    )

    this.registerSubscription(subscriptionId, unsubscribe)
    this.emit({
      type: 'runtime_bootstrap',
      subscriptionId,
      sessions: this.runtimeService.listSessions(),
      timestamp: new Date().toISOString(),
    })

    return subscriptionId
  }

  private createSessionSubscription(sessionId: string): string {
    const session = this.runtimeService.getSession(sessionId)
    if (!session) {
      throw new Error(`No existe la sesión runtime ${sessionId}.`)
    }

    const subscriptionId = randomUUID()
    const unsubscribe = this.runtimeService.subscribeToSession(
      sessionId,
      event => {
        this.emit({
          type: 'runtime_session_event',
          subscriptionId,
          sessionId,
          event,
          timestamp: new Date().toISOString(),
        })
      },
    )

    this.registerSubscription(subscriptionId, unsubscribe)
    this.emit({
      type: 'session_bootstrap',
      subscriptionId,
      session,
      timestamp: new Date().toISOString(),
    })

    return subscriptionId
  }

  private unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      return false
    }

    subscription.unsubscribe()
    this.subscriptions.delete(subscriptionId)
    return true
  }

  async handleRequest(
    request: RuntimeProtocolRequest,
  ): Promise<RuntimeProtocolResponse> {
    try {
      switch (request.method) {
        case 'list_sessions':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'list_sessions',
            sessions: this.runtimeService.listSessions(),
          }

        case 'get_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'get_session',
            session: this.runtimeService.getSession(request.sessionId) ?? null,
          }

        case 'get_session_detail':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'get_session_detail',
            detail:
              (await this.runtimeService.getSessionDetail(request.sessionId)) ??
              null,
          }

        case 'send_message':
          await this.runtimeService.sendMessage(request.sessionId, request.input)
          return {
            requestId: request.requestId,
            ok: true,
            method: 'send_message',
            accepted: true,
            sessionId: request.sessionId,
          }

        case 'interrupt':
          this.runtimeService.interrupt(request.sessionId)
          return {
            requestId: request.requestId,
            ok: true,
            method: 'interrupt',
            interrupted: true,
            sessionId: request.sessionId,
          }

        case 'set_permission_mode':
          await this.runtimeService.setPermissionMode(
            request.sessionId,
            request.mode,
          )
          return {
            requestId: request.requestId,
            ok: true,
            method: 'set_permission_mode',
            sessionId: request.sessionId,
            mode: request.mode,
          }

        case 'subscribe_runtime':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'subscribe_runtime',
            subscriptionId: this.createRuntimeSubscription(),
          }

        case 'subscribe_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'subscribe_session',
            subscriptionId: this.createSessionSubscription(request.sessionId),
          }

        case 'unsubscribe':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'unsubscribe',
            unsubscribed: this.unsubscribe(request.subscriptionId),
            subscriptionId: request.subscriptionId,
          }
      }
    } catch (error) {
      return {
        requestId: request.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  close(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe()
    }
    this.subscriptions.clear()
    this.listeners.clear()
  }
}
