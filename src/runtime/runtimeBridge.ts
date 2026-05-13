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
import { toRuntimeProtocolError } from './runtimeErrors.js'

type BridgeSubscription = {
  unsubscribe: RuntimeEventUnsubscribe
}

export class RuntimeBridge {
  private readonly clientId: string
  private readonly runtimeService: RuntimeService
  private readonly listeners = new Set<RuntimeProtocolEventListener>()
  private readonly subscriptions = new Map<string, BridgeSubscription>()

  constructor(
    runtimeService: RuntimeService = createRuntimeService(),
    clientId: string = randomUUID(),
  ) {
    this.runtimeService = runtimeService
    this.clientId = clientId
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
      clientId: this.clientId,
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
      clientId: this.clientId,
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
          await this.runtimeService.sendMessage(request.sessionId, request.input, {
            channel: 'web-ui',
            clientId: this.clientId,
            leaseId: request.leaseId,
          })
          return {
            requestId: request.requestId,
            ok: true,
            method: 'send_message',
            accepted: true,
            sessionId: request.sessionId,
          }

        case 'create_session': {
          const created = await this.runtimeService.createSession(request, {
            channel: 'web-ui',
            clientId: this.clientId,
          })
          return {
            requestId: request.requestId,
            ok: true,
            method: 'create_session',
            clientId: this.clientId,
            leaseId: created.leaseId,
            leaseExpiresAt: created.leaseExpiresAt,
            session: created.session,
          }
        }

        case 'claim_session':
          {
            const claimed = await this.runtimeService.claimSession(
              request.sessionId,
              request.channel,
              {
                channel: 'web-ui',
                clientId: this.clientId,
              },
            )
            return {
              requestId: request.requestId,
              ok: true,
              method: 'claim_session',
              sessionId: request.sessionId,
              clientId: this.clientId,
              leaseId: claimed.leaseId,
              leaseExpiresAt: claimed.leaseExpiresAt,
              channel: request.channel,
              snapshot: claimed.snapshot,
            }
          }

        case 'archive_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'archive_session',
            sessionId: request.sessionId,
            archived: true,
            snapshot: await this.runtimeService.archiveSession(request.sessionId, {
              channel: 'web-ui',
              clientId: this.clientId,
              leaseId: request.leaseId,
            }),
          }

        case 'unarchive_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'unarchive_session',
            sessionId: request.sessionId,
            archived: false,
            snapshot: await this.runtimeService.unarchiveSession(request.sessionId, {
              channel: 'web-ui',
              clientId: this.clientId,
              leaseId: request.leaseId,
            }),
          }

        case 'pin_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'pin_session',
            sessionId: request.sessionId,
            pinned: request.pinned,
            snapshot: await this.runtimeService.pinSession(
              request.sessionId,
              request.pinned,
              {
                channel: 'web-ui',
                clientId: this.clientId,
                leaseId: request.leaseId,
              },
            ),
          }

        case 'update_session_notes':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'update_session_notes',
            sessionId: request.sessionId,
            notes: request.notes,
            snapshot: await this.runtimeService.updateSessionNotes(
              request.sessionId,
              request.notes,
              {
                channel: 'web-ui',
                clientId: this.clientId,
                leaseId: request.leaseId,
              },
            ),
          }

        case 'set_session_model':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'set_session_model',
            sessionId: request.sessionId,
            model: request.model,
            snapshot: await this.runtimeService.setSessionModel(
              request.sessionId,
              request.model,
              {
                channel: 'web-ui',
                clientId: this.clientId,
                leaseId: request.leaseId,
              },
            ),
          }

        case 'list_models':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'list_models',
            models: this.runtimeService.listModels(),
          }

        case 'get_session_events':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'get_session_events',
            sessionId: request.sessionId,
            events: await this.runtimeService.getSessionEvents(request.sessionId),
          }

        case 'interrupt':
          this.runtimeService.interrupt(
            request.sessionId,
            {
              channel: 'web-ui',
              clientId: this.clientId,
              leaseId: request.leaseId,
            },
            request.channel,
          )
          return {
            requestId: request.requestId,
            ok: true,
            method: 'interrupt',
            interrupted: true,
            sessionId: request.sessionId,
            channel: request.channel,
          }

        case 'rename_session':
          {
            const snapshot = await this.runtimeService.renameSession(
              request.sessionId,
              request.title,
              {
                channel: 'web-ui',
                clientId: this.clientId,
                leaseId: request.leaseId,
              },
            )
            return {
              requestId: request.requestId,
              ok: true,
              method: 'rename_session',
              renamed: true,
              sessionId: request.sessionId,
              title: snapshot.title,
            }
          }

        case 'set_permission_mode':
          {
            const snapshot = await this.runtimeService.setPermissionMode(
              request.sessionId,
              request.mode,
              {
                channel: 'web-ui',
                clientId: this.clientId,
                leaseId: request.leaseId,
              },
              request.channel,
            )
            return {
              requestId: request.requestId,
              ok: true,
              method: 'set_permission_mode',
              sessionId: request.sessionId,
              mode: snapshot.permissionMode,
              channel: request.channel,
            }
          }

        case 'subscribe_runtime':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'subscribe_runtime',
            clientId: this.clientId,
            subscriptionId: this.createRuntimeSubscription(),
          }

        case 'subscribe_session':
          return {
            requestId: request.requestId,
            ok: true,
            method: 'subscribe_session',
            clientId: this.clientId,
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
      const runtimeError = toRuntimeProtocolError(error)
      return {
        requestId: request.requestId,
        ok: false,
        code: runtimeError.code,
        error: runtimeError.message,
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
