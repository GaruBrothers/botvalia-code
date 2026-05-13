import { randomUUID } from 'crypto'
import { WebSocket } from 'ws'
import type {
  RuntimeProtocolEvent,
  RuntimeProtocolEventListener,
  RuntimeProtocolMessage,
  RuntimeProtocolRequest,
  RuntimeProtocolResponse,
  RuntimeProtocolSuccessResponse,
} from './protocol.js'
import {
  getRuntimeWebSocketAuthToken,
  withRuntimeWebSocketAuthToken,
} from './protocol.js'
import type {
  RuntimeModelOption,
  RuntimeSendMessageInput,
  RuntimeSessionChannel,
  RuntimeSessionDetail,
  RuntimeSessionEventRecord,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'
import type { PermissionMode } from '../types/permissions.js'
import type { ModelSetting } from '../utils/model/model.js'

export type RuntimeWebSocketClientConfig = {
  authToken?: string
}

type PendingRequest = {
  resolve: (value: RuntimeProtocolResponse) => void
  reject: (error: Error) => void
}

type RuntimeProtocolRequestInput = RuntimeProtocolRequest extends infer Request
  ? Request extends { requestId: string }
    ? Omit<Request, 'requestId'>
    : never
  : never

function isProtocolResponse(
  value: RuntimeProtocolMessage,
): value is RuntimeProtocolResponse {
  return 'requestId' in value
}

function assertSuccess(
  response: RuntimeProtocolResponse,
): asserts response is RuntimeProtocolSuccessResponse {
  if (!response.ok) {
    const code = 'code' in response ? response.code : 'runtime_error'
    const message = 'error' in response ? response.error : 'Unknown runtime error.'
    throw new Error(`[${code}] ${message}`)
  }
}

function assertMethod<M extends RuntimeProtocolSuccessResponse['method']>(
  response: RuntimeProtocolSuccessResponse,
  method: M,
): asserts response is Extract<RuntimeProtocolSuccessResponse, { method: M }> {
  if (response.method !== method) {
    throw new Error(`La respuesta runtime no coincide con ${method}.`)
  }
}

export class RuntimeWebSocketClient {
  private readonly url: string
  private socket: WebSocket | null = null
  private clientId: string | null = null
  private readonly listeners = new Set<RuntimeProtocolEventListener>()
  private readonly pending = new Map<string, PendingRequest>()

  constructor(url: string, config: RuntimeWebSocketClientConfig = {}) {
    const resolvedAuthToken =
      config.authToken || getRuntimeWebSocketAuthToken(url) || undefined

    this.url = resolvedAuthToken
      ? withRuntimeWebSocketAuthToken(url, resolvedAuthToken)
      : url
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }

    const socket = new WebSocket(this.url)
    this.socket = socket

    socket.on('message', raw => {
      const parsed = JSON.parse(raw.toString()) as RuntimeProtocolMessage

      if (isProtocolResponse(parsed)) {
        const pending = this.pending.get(parsed.requestId)
        if (!pending) {
          return
        }

        this.pending.delete(parsed.requestId)
        pending.resolve(parsed)
        return
      }

      if (
        (parsed.type === 'runtime_bootstrap' || parsed.type === 'session_bootstrap') &&
        parsed.clientId
      ) {
        this.clientId = parsed.clientId
      }

      for (const listener of this.listeners) {
        listener(parsed)
      }
    })

    socket.on('close', () => {
      for (const [requestId, pending] of this.pending.entries()) {
        this.pending.delete(requestId)
        pending.reject(new Error('La conexión runtime WebSocket fue cerrada.'))
      }
    })

    socket.on('error', error => {
      for (const [requestId, pending] of this.pending.entries()) {
        this.pending.delete(requestId)
        pending.reject(
          error instanceof Error
            ? error
            : new Error('Error desconocido en runtime WebSocket.'),
        )
      }
    })

    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve())
      socket.once('error', reject)
    })
  }

  getClientId(): string | null {
    return this.clientId
  }

  onEvent(listener: RuntimeProtocolEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private async sendRequest(
    request: RuntimeProtocolRequestInput,
  ): Promise<RuntimeProtocolResponse> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('El cliente runtime WebSocket no está conectado.')
    }

    const requestId = randomUUID()
    const fullRequest = {
      requestId,
      ...request,
    } as RuntimeProtocolRequest

    const responsePromise = new Promise<RuntimeProtocolResponse>(
      (resolve, reject) => {
        this.pending.set(requestId, { resolve, reject })
      },
    )

    this.socket.send(JSON.stringify(fullRequest))
    return responsePromise
  }

  async listSessions(): Promise<RuntimeSessionSnapshot[]> {
    const response = await this.sendRequest({
      method: 'list_sessions',
    })

    assertSuccess(response)
    assertMethod(response, 'list_sessions')
    return response.sessions
  }

  async getSession(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionSnapshot | null> {
    const response = await this.sendRequest({
      method: 'get_session',
      sessionId,
    })

    assertSuccess(response)
    assertMethod(response, 'get_session')
    return response.session
  }

  async getSessionDetail(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionDetail | null> {
    const response = await this.sendRequest({
      method: 'get_session_detail',
      sessionId,
    })

    assertSuccess(response)
    assertMethod(response, 'get_session_detail')
    return response.detail
  }

  async createSession(input: {
    title: string
    cwd: string
    notes?: string
  }): Promise<{
    clientId: string
    leaseId: string | null
    leaseExpiresAt: string | null
    session: RuntimeSessionSnapshot
  }> {
    const response = await this.sendRequest({
      method: 'create_session',
      ...input,
    })

    assertSuccess(response)
    assertMethod(response, 'create_session')
    this.clientId = response.clientId

    return {
      clientId: response.clientId,
      leaseId: response.leaseId,
      leaseExpiresAt: response.leaseExpiresAt,
      session: response.session,
    }
  }

  async sendMessage(
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
    leaseId?: string,
  ): Promise<void> {
    const response = await this.sendRequest({
      method: 'send_message',
      sessionId,
      leaseId,
      input,
    })

    assertSuccess(response)
    assertMethod(response, 'send_message')
  }

  async claimSession(
    sessionId: RuntimeSessionId,
    channel: RuntimeSessionChannel,
  ): Promise<{
    clientId: string
    leaseId: string | null
    leaseExpiresAt: string | null
    snapshot: RuntimeSessionSnapshot
  }> {
    const response = await this.sendRequest({
      method: 'claim_session',
      sessionId,
      channel,
    })

    assertSuccess(response)
    assertMethod(response, 'claim_session')
    this.clientId = response.clientId

    return {
      clientId: response.clientId,
      leaseId: response.leaseId,
      leaseExpiresAt: response.leaseExpiresAt,
      snapshot: response.snapshot,
    }
  }

  async interrupt(
    sessionId: RuntimeSessionId,
    leaseId?: string,
    channel?: RuntimeSessionChannel,
  ): Promise<void> {
    const response = await this.sendRequest({
      method: 'interrupt',
      sessionId,
      leaseId,
      channel,
    })

    assertSuccess(response)
    assertMethod(response, 'interrupt')
  }

  async renameSession(
    sessionId: RuntimeSessionId,
    title: string,
    leaseId?: string,
  ): Promise<string> {
    const response = await this.sendRequest({
      method: 'rename_session',
      sessionId,
      leaseId,
      title,
    })

    assertSuccess(response)
    assertMethod(response, 'rename_session')
    return response.title
  }

  async archiveSession(
    sessionId: RuntimeSessionId,
    leaseId?: string,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'archive_session',
      sessionId,
      leaseId,
    })

    assertSuccess(response)
    if (response.method !== 'archive_session') {
      throw new Error('La respuesta runtime no coincide con archive_session.')
    }
    return response.snapshot
  }

  async unarchiveSession(
    sessionId: RuntimeSessionId,
    leaseId?: string,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'unarchive_session',
      sessionId,
      leaseId,
    })

    assertSuccess(response)
    if (response.method !== 'unarchive_session') {
      throw new Error('La respuesta runtime no coincide con unarchive_session.')
    }
    return response.snapshot
  }

  async pinSession(
    sessionId: RuntimeSessionId,
    pinned: boolean,
    leaseId?: string,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'pin_session',
      sessionId,
      leaseId,
      pinned,
    })

    assertSuccess(response)
    assertMethod(response, 'pin_session')
    return response.snapshot
  }

  async updateSessionNotes(
    sessionId: RuntimeSessionId,
    notes: string,
    leaseId?: string,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'update_session_notes',
      sessionId,
      leaseId,
      notes,
    })

    assertSuccess(response)
    assertMethod(response, 'update_session_notes')
    return response.snapshot
  }

  async setSessionModel(
    sessionId: RuntimeSessionId,
    model: ModelSetting,
    leaseId?: string,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'set_session_model',
      sessionId,
      leaseId,
      model,
    })

    assertSuccess(response)
    assertMethod(response, 'set_session_model')
    return response.snapshot
  }

  async listModels(): Promise<RuntimeModelOption[]> {
    const response = await this.sendRequest({
      method: 'list_models',
    })

    assertSuccess(response)
    assertMethod(response, 'list_models')
    return response.models
  }

  async getSessionEvents(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionEventRecord[]> {
    const response = await this.sendRequest({
      method: 'get_session_events',
      sessionId,
    })

    assertSuccess(response)
    assertMethod(response, 'get_session_events')
    return response.events
  }

  async setPermissionMode(
    sessionId: RuntimeSessionId,
    mode: PermissionMode,
    leaseId?: string,
    channel?: RuntimeSessionChannel,
  ): Promise<PermissionMode> {
    const response = await this.sendRequest({
      method: 'set_permission_mode',
      sessionId,
      mode,
      leaseId,
      channel,
    })

    assertSuccess(response)
    assertMethod(response, 'set_permission_mode')
    return response.mode
  }

  async subscribeRuntime(): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_runtime',
    })

    assertSuccess(response)
    if (response.method !== 'subscribe_runtime') {
      throw new Error(
        'La respuesta runtime no coincide con subscribe_runtime.',
      )
    }

    this.clientId = response.clientId
    return response.subscriptionId
  }

  async subscribeSession(sessionId: RuntimeSessionId): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_session',
      sessionId,
    })

    assertSuccess(response)
    if (response.method !== 'subscribe_session') {
      throw new Error(
        'La respuesta runtime no coincide con subscribe_session.',
      )
    }

    this.clientId = response.clientId
    return response.subscriptionId
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const response = await this.sendRequest({
      method: 'unsubscribe',
      subscriptionId,
    })

    assertSuccess(response)
    assertMethod(response, 'unsubscribe')
    return response.unsubscribed
  }

  async close(): Promise<void> {
    if (!this.socket) {
      return
    }

    const socket = this.socket
    this.socket = null

    await new Promise<void>(resolve => {
      socket.once('close', () => resolve())
      socket.close()
    })
  }
}
