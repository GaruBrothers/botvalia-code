export type RuntimeProtocolErrorCode =
  | 'unauthorized'
  | 'lease_expired'
  | 'channel_conflict'
  | 'session_not_found'
  | 'runtime_unavailable'
  | 'validation_error'

export class RuntimeProtocolError extends Error {
  readonly code: RuntimeProtocolErrorCode

  constructor(code: RuntimeProtocolErrorCode, message: string) {
    super(message)
    this.name = 'RuntimeProtocolError'
    this.code = code
  }
}

export function toRuntimeProtocolError(error: unknown): RuntimeProtocolError {
  if (error instanceof RuntimeProtocolError) {
    return error
  }

  return new RuntimeProtocolError(
    'validation_error',
    error instanceof Error ? error.message : String(error),
  )
}
