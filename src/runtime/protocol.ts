import type { RuntimeEvent } from './events.js'
import type { RuntimeRegistryEvent } from './runtimeService.js'
import type {
  RuntimeSessionChannel,
  RuntimeSendMessageInput,
  RuntimeSessionDetail,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './types.js'
import type { PermissionMode } from '../types/permissions.js'

export const RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM = 'runtimeToken'

export function withRuntimeWebSocketAuthToken(
  rawUrl: string,
  authToken: string,
): string {
  const url = new URL(rawUrl)
  url.searchParams.set(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM, authToken)
  return url.toString()
}

export function getRuntimeWebSocketAuthToken(
  rawUrl: string | URL,
): string | null {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl)
  return url.searchParams.get(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM)
}

export function hasRuntimeWebSocketAuthToken(
  rawUrl: string | URL,
  expectedAuthToken: string,
): boolean {
  const providedAuthToken = getRuntimeWebSocketAuthToken(rawUrl)
  return (
    typeof providedAuthToken === 'string' &&
    providedAuthToken.length > 0 &&
    providedAuthToken === expectedAuthToken
  )
}

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
      method: 'claim_session'
      sessionId: RuntimeSessionId
      channel: RuntimeSessionChannel
    }
  | {
      requestId: string
      method: 'interrupt'
      sessionId: RuntimeSessionId
      channel?: RuntimeSessionChannel
    }
  | {
      requestId: string
      method: 'rename_session'
      sessionId: RuntimeSessionId
      title: string
    }
  | {
      requestId: string
      method: 'set_permission_mode'
      sessionId: RuntimeSessionId
      mode: PermissionMode
      channel?: RuntimeSessionChannel
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
      method: 'claim_session'
      sessionId: RuntimeSessionId
      channel: RuntimeSessionChannel
      snapshot: RuntimeSessionSnapshot
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
      channel?: RuntimeSessionChannel
    }
  | {
      requestId: string
      ok: true
      method: 'rename_session'
      renamed: true
      sessionId: RuntimeSessionId
      title: string
    }
  | {
      requestId: string
      ok: true
      method: 'set_permission_mode'
      sessionId: RuntimeSessionId
      mode: PermissionMode
      channel?: RuntimeSessionChannel
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
