import type { RuntimeEvent } from './events.js'
import type { RuntimeRegistryEvent } from './runtimeService.js'
import type {
  RuntimeSendMessageInput,
  RuntimeSessionDetail,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'

export type RuntimeProtocolRequest =
  | {
      requestId: string
      method: 'list_sessions'
    }
  | {
      requestId: string
      method: 'get_session'
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      method: 'get_session_detail'
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      method: 'send_message'
      sessionId: RuntimeSessionId
      input: RuntimeSendMessageInput
    }
  | {
      requestId: string
      method: 'interrupt'
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      method: 'subscribe_runtime'
    }
  | {
      requestId: string
      method: 'subscribe_session'
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      method: 'unsubscribe'
      subscriptionId: string
    }

export type RuntimeProtocolSuccessResponse =
  | {
      requestId: string
      ok: true
      method: 'list_sessions'
      sessions: RuntimeSessionSnapshot[]
    }
  | {
      requestId: string
      ok: true
      method: 'get_session'
      session: RuntimeSessionSnapshot | null
    }
  | {
      requestId: string
      ok: true
      method: 'get_session_detail'
      detail: RuntimeSessionDetail | null
    }
  | {
      requestId: string
      ok: true
      method: 'send_message'
      accepted: true
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      ok: true
      method: 'interrupt'
      interrupted: true
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      ok: true
      method: 'subscribe_runtime' | 'subscribe_session'
      subscriptionId: string
    }
  | {
      requestId: string
      ok: true
      method: 'unsubscribe'
      unsubscribed: boolean
      subscriptionId: string
    }

export type RuntimeProtocolErrorResponse = {
  requestId: string
  ok: false
  error: string
}

export type RuntimeProtocolResponse =
  | RuntimeProtocolSuccessResponse
  | RuntimeProtocolErrorResponse

export type RuntimeProtocolEvent =
  | {
      type: 'runtime_bootstrap'
      subscriptionId: string
      sessions: RuntimeSessionSnapshot[]
      timestamp: string
    }
  | {
      type: 'session_bootstrap'
      subscriptionId: string
      session: RuntimeSessionSnapshot
      timestamp: string
    }
  | {
      type: 'runtime_registry_event'
      subscriptionId: string
      event: RuntimeRegistryEvent
      timestamp: string
    }
  | {
      type: 'runtime_session_event'
      subscriptionId: string
      sessionId: RuntimeSessionId
      event: RuntimeEvent
      timestamp: string
    }

export type RuntimeProtocolEventListener = (
  event: RuntimeProtocolEvent,
) => void

export type RuntimeProtocolEventUnsubscribe = () => void

export type RuntimeProtocolMessage =
  | RuntimeProtocolResponse
  | RuntimeProtocolEvent
