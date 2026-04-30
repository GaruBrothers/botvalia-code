import type { SDKMessage } from '../entrypoints/agentSdkTypes.js'
import type { SDKControlPermissionRequest } from '../entrypoints/sdk/controlTypes.js'
import type { RemoteMessageContent } from '../utils/teleport/api.js'

export type SSHPermissionResponse =
  | {
      behavior: 'allow'
      updatedInput: Record<string, unknown>
    }
  | {
      behavior: 'deny'
      message: string
    }

export type SSHSessionManagerCallbacks = {
  onMessage: (message: SDKMessage) => void
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  onConnected?: () => void
  onReconnecting?: (attempt: number, maxAttempts: number) => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}

type SSHSessionManagerOptions = {
  unsupportedMessage?: string
}

export class SSHSessionManager {
  private connected = false

  constructor(
    private readonly callbacks: SSHSessionManagerCallbacks,
    private readonly options: SSHSessionManagerOptions = {},
  ) {}

  connect(): void {
    if (this.connected) {
      return
    }

    if (this.options.unsupportedMessage) {
      const error = new Error(this.options.unsupportedMessage)
      queueMicrotask(() => {
        this.callbacks.onError?.(error)
        this.callbacks.onDisconnected?.()
      })
      return
    }

    this.connected = true
    queueMicrotask(() => {
      if (this.connected) {
        this.callbacks.onConnected?.()
      }
    })
  }

  disconnect(): void {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async sendMessage(_content: RemoteMessageContent): Promise<boolean> {
    return this.connected
  }

  sendInterrupt(): void {}

  respondToPermissionRequest(
    _requestId: string,
    _result: SSHPermissionResponse,
  ): void {}
}
