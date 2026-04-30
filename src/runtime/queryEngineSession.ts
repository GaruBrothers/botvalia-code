import type { SDKMessage } from '../entrypoints/sdk/coreTypes.js'
import type { QueryEngine } from '../QueryEngine.js'
import type { AppState } from '../state/AppStateStore.js'
import type { Message } from '../types/message.js'
import { SessionRuntime } from './sessionRuntime.js'
import type {
  RuntimeSendMessageInput,
  RuntimeTaskSummary,
} from './types.js'

type QueryEngineSessionRuntimeConfig = {
  engine: QueryEngine
  cwd: string
  getAppState: () => AppState
}

export type QueryEngineSessionRuntimeController = {
  runtime: SessionRuntime
  engine: QueryEngine
  runPrompt: (
    input: RuntimeSendMessageInput,
  ) => AsyncGenerator<SDKMessage, void, unknown>
}

function findMessageByUuid(
  messages: readonly Message[],
  uuid: string | undefined,
): Message | undefined {
  if (!uuid) {
    return undefined
  }

  return messages.findLast(message => message.uuid === uuid)
}

function buildFallbackTaskSummary(message: SDKMessage): RuntimeTaskSummary | null {
  if (message.type !== 'system') {
    return null
  }

  if (
    message.subtype !== 'task_started' &&
    message.subtype !== 'task_progress' &&
    message.subtype !== 'task_notification'
  ) {
    return null
  }

  if (message.subtype === 'task_started') {
    return {
      id: message.task_id,
      status: 'running',
      kind: message.task_type,
      title: message.description,
    }
  }

  if (message.subtype === 'task_progress') {
    return {
      id: message.task_id,
      status: 'running',
      title: message.summary || message.description,
    }
  }

  return {
    id: message.task_id,
    status: message.status,
    title: message.summary,
  }
}

function emitTaskFromAppStateOrMessage(
  runtime: SessionRuntime,
  message: SDKMessage,
  getAppState: () => AppState,
): void {
  const fallback = buildFallbackTaskSummary(message)
  if (!fallback) {
    return
  }

  const task = getAppState().tasks[fallback.id]
  if (task) {
    runtime.emitTaskUpdated({
      id: task.id,
      status: task.status,
      kind:
        ('type' in task && typeof task.type === 'string' ? task.type : undefined) ||
        fallback.kind,
      title:
        ('description' in task && typeof task.description === 'string'
          ? task.description
          : undefined) || fallback.title,
      isBackgrounded:
        'isBackgrounded' in task && typeof task.isBackgrounded === 'boolean'
          ? task.isBackgrounded
          : undefined,
    })
  } else {
    runtime.emitTaskUpdated(fallback)
  }

  runtime.emitSwarmUpdated()
}

function extractTextDelta(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  const candidate = event as {
    delta?: { text?: string }
    content_block?: { text?: string }
  }

  return candidate.delta?.text || candidate.content_block?.text || undefined
}

function handleSdkMessage(
  runtime: SessionRuntime,
  message: SDKMessage,
  engine: QueryEngine,
  getAppState: () => AppState,
): void {
  if (message.type === 'stream_event') {
    const delta = extractTextDelta(message.event)
    if (delta) {
      runtime.emitMessageDelta(delta)
    }
    return
  }

  if (message.type === 'assistant' || message.type === 'user') {
    const matched = findMessageByUuid(engine.getMessages(), message.uuid)
    if (matched) {
      runtime.emitMessageCompleted(matched)
      runtime.refreshSnapshot()
    }
    return
  }

  if (message.type === 'system') {
    if (message.subtype === 'session_state_changed') {
      const mappedState =
        message.state === 'requires_action' ? 'requires_action' : message.state
      runtime.setStatus(mappedState)
      return
    }

    emitTaskFromAppStateOrMessage(runtime, message, getAppState)
    return
  }

  if (message.type === 'result') {
    runtime.refreshSnapshot()
  }
}

export function createQueryEngineSessionRuntime({
  engine,
  cwd,
  getAppState,
}: QueryEngineSessionRuntimeConfig): SessionRuntime {
  return createQueryEngineSessionRuntimeController({
    engine,
    cwd,
    getAppState,
  }).runtime
}

export function createQueryEngineSessionRuntimeController({
  engine,
  cwd,
  getAppState,
}: QueryEngineSessionRuntimeConfig): QueryEngineSessionRuntimeController {
  let runtime: SessionRuntime

  const runPrompt = async function* (
    input: RuntimeSendMessageInput,
  ): AsyncGenerator<SDKMessage, void, unknown> {
    runtime.setStatus('running')

    try {
      for await (const message of engine.submitMessage(input.text, {
        uuid: input.uuid,
        isMeta: input.isMeta,
      })) {
        handleSdkMessage(runtime, message, engine, getAppState)
        yield message
      }

      if (runtime.getStatus() === 'running') {
        runtime.setStatus('completed')
      }
    } catch (error) {
      runtime.emitError(error)
      throw error
    }
  }

  const submitMessage = async (input: RuntimeSendMessageInput): Promise<void> => {
    for await (const _message of runPrompt(input)) {
      // SessionRuntime.submit only needs side effects and events.
    }
  }

  runtime = new SessionRuntime({
    sessionId: engine.getSessionId(),
    cwd,
    getAppState,
    getMessages: () => engine.getMessages(),
    submitMessage,
    interrupt: () => engine.interrupt(),
    initialStatus: 'idle',
  })

  runtime.emitSwarmUpdated()
  runtime.refreshSnapshot()

  return {
    runtime,
    engine,
    runPrompt,
  }
}
