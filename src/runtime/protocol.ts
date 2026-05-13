import type { RuntimeEvent } from './events.js'
import type { RuntimeProtocolErrorCode } from './runtimeErrors.js'
import type { RuntimeRegistryEvent } from './runtimeService.js'
import type {
  RuntimeModelOption,
  RuntimeSessionChannel,
  RuntimeSessionEventRecord,
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
      leaseId?: string
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
      leaseId?: string
      channel?: RuntimeSessionChannel
    }
  | {
      requestId: string
      method: 'rename_session'
      sessionId: RuntimeSessionId
      leaseId?: string
      title: string
    }
  | {
      requestId: string
      method: 'create_session'
      title: string
      cwd: string
      notes?: string
    }
  | {
      requestId: string
      method: 'archive_session'
      sessionId: RuntimeSessionId
      leaseId?: string
    }
  | {
      requestId: string
      method: 'unarchive_session'
      sessionId: RuntimeSessionId
      leaseId?: string
    }
  | {
      requestId: string
      method: 'pin_session'
      sessionId: RuntimeSessionId
      leaseId?: string
      pinned: boolean
    }
  | {
      requestId: string
      method: 'update_session_notes'
      sessionId: RuntimeSessionId
      leaseId?: string
      notes: string
    }
  | {
      requestId: string
      method: 'set_session_model'
      sessionId: RuntimeSessionId
      leaseId?: string
      model: string | null
    }
  | {
      requestId: string
      method: 'list_models'
    }
  | {
      requestId: string
      method: 'get_session_events'
      sessionId: RuntimeSessionId
    }
  | {
      requestId: string
      method: 'set_permission_mode'
      sessionId: RuntimeSessionId
      mode: PermissionMode
      leaseId?: string
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
      clientId: string
      leaseId: string | null
      leaseExpiresAt: string | null
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
      method: 'create_session'
      clientId: string
      leaseId: string | null
      leaseExpiresAt: string | null
      session: RuntimeSessionSnapshot
    }
  | {
      requestId: string
      ok: true
      method: 'archive_session' | 'unarchive_session'
      sessionId: RuntimeSessionId
      archived: boolean
      snapshot: RuntimeSessionSnapshot
    }
  | {
      requestId: string
      ok: true
      method: 'pin_session'
      sessionId: RuntimeSessionId
      pinned: boolean
      snapshot: RuntimeSessionSnapshot
    }
  | {
      requestId: string
      ok: true
      method: 'update_session_notes'
      sessionId: RuntimeSessionId
      notes: string
      snapshot: RuntimeSessionSnapshot
    }
  | {
      requestId: string
      ok: true
      method: 'set_session_model'
      sessionId: RuntimeSessionId
      model: string | null
      snapshot: RuntimeSessionSnapshot
    }
  | {
      requestId: string
      ok: true
      method: 'list_models'
      models: RuntimeModelOption[]
    }
  | {
      requestId: string
      ok: true
      method: 'get_session_events'
      sessionId: RuntimeSessionId
      events: RuntimeSessionEventRecord[]
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
      clientId: string
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
  code: RuntimeProtocolErrorCode
  error: string
}

export type RuntimeProtocolResponse =
  | RuntimeProtocolSuccessResponse
  | RuntimeProtocolErrorResponse

export type RuntimeProtocolEvent =
  | {
      type: 'runtime_bootstrap'
      clientId: string
      subscriptionId: string
      sessions: RuntimeSessionSnapshot[]
      timestamp: string
    }
  | {
      type: 'session_bootstrap'
      clientId: string
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
