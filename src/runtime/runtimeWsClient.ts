import { randomUUID } from 'crypto'
import { WebSocket } from 'ws'
import type {
  RuntimeProtocolEvent,
  RuntimeProtocolEventListener,
  RuntimeProtocolMessage,
  RuntimeProtocolRequest,
  RuntimeProtocolResponse,
} from './protocol.js'
import type {
  RuntimeSendMessageInput,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'

type PendingRequest = {
  resolve: (value: RuntimeProtocolResponse) => void
  reject: (error: Error) => void
}

function isProtocolResponse(
  value: RuntimeProtocolMessage,
): value is RuntimeProtocolResponse {
  return 'requestId' in value
}

export class RuntimeWebSocketClient {
  private readonly url: string
  private socket: WebSocket | null = null
  private readonly listeners = new Set<RuntimeProtocolEventListener>()
  private readonly pending = new Map<string, PendingRequest>()

  constructor(url: string) {
    this.url = url
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

  onEvent(listener: RuntimeProtocolEventListener): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private async sendRequest(
    request: Omit<RuntimeProtocolRequest, 'requestId'>,
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

    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.sessions
  }

  async getSession(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionSnapshot | null> {
    const response = await this.sendRequest({
      method: 'get_session',
      sessionId,
    })

    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.session
  }

  async sendMessage(
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
  ): Promise<void> {
    const response = await this.sendRequest({
      method: 'send_message',
      sessionId,
      input,
    })

    if (!response.ok) {
      throw new Error(response.error)
    }
  }

  async interrupt(sessionId: RuntimeSessionId): Promise<void> {
    const response = await this.sendRequest({
      method: 'interrupt',
      sessionId,
    })

    if (!response.ok) {
      throw new Error(response.error)
    }
  }

  async subscribeRuntime(): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_runtime',
    })

    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.subscriptionId
  }

  async subscribeSession(sessionId: RuntimeSessionId): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_session',
      sessionId,
    })

    if (!response.ok) {
      throw new Error(response.error)
    }

    return response.subscriptionId
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const response = await this.sendRequest({
      method: 'unsubscribe',
      subscriptionId,
    })

    if (!response.ok) {
      throw new Error(response.error)
    }

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
