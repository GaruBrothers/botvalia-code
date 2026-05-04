import type { SDKMessage } from '../entrypoints/sdk/coreTypes.js'
import type { QueryEngine } from '../QueryEngine.js'
import type { AppState } from '../state/AppStateStore.js'
import type { Message } from '../types/message.js'
import { SessionRuntime } from './sessionRuntime.js'
import type {
  RuntimeSendMessageInput,
  RuntimeTaskEventPayload,
  RuntimeTaskSummary,
  RuntimeToolEventPayload,
} from './types.js'
import {
  extractThinkingStreamStartMeta,
  extractStreamTextDelta,
  extractStreamThinkingDelta,
  extractStreamToolUseStart,
  isThinkingStreamStart,
} from './streamEventHelpers.js'

type QueryEngineSessionRuntimeConfig = {
  engine: QueryEngine
  cwd: string
  getAppState: () => AppState
  runtime?: SessionRuntime
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

function summarizeUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined
  }

  if (value === undefined) {
    return undefined
  }

  const serialized = JSON.stringify(value)
  return serialized ? serialized.slice(0, 400) : undefined
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

function getTaskSummaryFromAppState(
  taskId: string,
  getAppState: () => AppState,
  fallback: RuntimeTaskSummary,
): RuntimeTaskSummary {
  const task = getAppState().tasks[taskId]
  if (!task) {
    return fallback
  }

  return {
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
  }
}

function buildTaskEventPayload(
  message: SDKMessage,
  getAppState: () => AppState,
): RuntimeTaskEventPayload | null {
  const fallback = buildFallbackTaskSummary(message)
  if (!fallback || message.type !== 'system') {
    return null
  }

  const task = getTaskSummaryFromAppState(fallback.id, getAppState, fallback)

  if (message.subtype === 'task_started') {
    return {
      task,
      source: 'sdk-message',
      toolUseId: message.tool_use_id,
      workflowName: message.workflow_name,
      prompt: message.prompt,
      description: message.description,
    }
  }

  if (message.subtype === 'task_progress') {
    return {
      task,
      source: 'sdk-message',
      toolUseId: message.tool_use_id,
      description: message.description,
      summary: message.summary,
      progressText: message.summary || message.description,
      lastToolName: message.last_tool_name,
      usage: {
        totalTokens: message.usage.total_tokens,
        toolUses: message.usage.tool_uses,
        durationMs: message.usage.duration_ms,
      },
    }
  }

  return {
    task,
    source: 'sdk-message',
    toolUseId: message.tool_use_id,
    summary: message.summary,
    usage: message.usage
      ? {
          totalTokens: message.usage.total_tokens,
          toolUses: message.usage.tool_uses,
          durationMs: message.usage.duration_ms,
        }
      : undefined,
  }
}

function emitSwarmTaskPlaceholders(
  runtime: SessionRuntime,
  kind: 'task_started' | 'task_progress' | 'task_completed',
  payload: RuntimeTaskEventPayload,
): void {
  const swarm = runtime.getSnapshot().swarm
  if (!swarm.teamName && swarm.teammateNames.length === 0) {
    return
  }

  runtime.emitSwarmEvent({
    kind,
    source: payload.source,
    swarm,
    taskId: payload.task.id,
    taskTitle: payload.task.title,
    toolUseId: payload.toolUseId,
  })
}

function emitAgentTaskPlaceholder(
  runtime: SessionRuntime,
  kind: 'task_started' | 'task_progress' | 'task_completed',
  payload: RuntimeTaskEventPayload,
): void {
  const swarm = runtime.getSnapshot().swarm
  const taskKind = payload.task.kind?.toLowerCase()

  if (
    !payload.workflowName &&
    !taskKind?.includes('agent') &&
    swarm.teammateNames.length === 0
  ) {
    return
  }

  runtime.emitAgentEvent({
    kind,
    source: payload.source,
    agentName: payload.workflowName,
    taskId: payload.task.id,
    taskTitle: payload.task.title,
    detail: payload.summary || payload.progressText || payload.description,
  })
}

function emitSwarmToolPlaceholder(
  runtime: SessionRuntime,
  kind: 'tool_started' | 'tool_completed',
  payload: RuntimeToolEventPayload,
): void {
  const swarm = runtime.getSnapshot().swarm
  if (!swarm.teamName && swarm.teammateNames.length === 0) {
    return
  }

  runtime.emitSwarmEvent({
    kind,
    source: payload.source,
    swarm,
    taskId: payload.taskId,
    toolUseId: payload.toolUseId,
    toolName: payload.toolName,
  })
}

function emitAgentToolPlaceholder(
  runtime: SessionRuntime,
  kind: 'tool_started' | 'tool_completed',
  payload: RuntimeToolEventPayload,
): void {
  const swarm = runtime.getSnapshot().swarm
  if (!payload.taskId && swarm.teammateNames.length === 0) {
    return
  }

  runtime.emitAgentEvent({
    kind,
    source: payload.source,
    taskId: payload.taskId,
    detail: payload.summary || payload.toolName,
  })
}

function extractToolStartsFromAssistantMessage(
  message: Message,
): RuntimeToolEventPayload[] {
  if (message.type !== 'assistant') {
    return []
  }

  return message.message.content.flatMap(block => {
    if (!block || typeof block !== 'object') {
      return []
    }

    const candidate = block as {
      type?: unknown
      id?: unknown
      name?: unknown
      input?: unknown
    }

    if (
      candidate.type !== 'tool_use' ||
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string'
    ) {
      return []
    }

    return [
      {
        toolUseId: candidate.id,
        toolName: candidate.name,
        source: 'assistant-message',
        inputPreview: summarizeUnknown(candidate.input),
      },
    ]
  })
}

function extractToolCompletionsFromUserMessage(
  runtime: SessionRuntime,
  message: Message,
): RuntimeToolEventPayload[] {
  if (message.type !== 'user' || !Array.isArray(message.message.content)) {
    return []
  }

  return message.message.content.flatMap(block => {
    if (!block || typeof block !== 'object') {
      return []
    }

    const candidate = block as {
      type?: unknown
      tool_use_id?: unknown
      content?: unknown
    }

    if (
      candidate.type !== 'tool_result' ||
      typeof candidate.tool_use_id !== 'string'
    ) {
      return []
    }

    const activeTool = runtime.getActiveTool(candidate.tool_use_id)
    return [
      {
        toolUseId: candidate.tool_use_id,
        toolName: activeTool?.toolName ?? 'unknown',
        source: 'message-result',
        parentToolUseId: activeTool?.parentToolUseId,
        taskId: activeTool?.taskId,
        outputPreview: summarizeUnknown(candidate.content),
      },
    ]
  })
}

function emitTaskFromAppStateOrMessage(
  runtime: SessionRuntime,
  message: SDKMessage,
  getAppState: () => AppState,
): void {
  const payload = buildTaskEventPayload(message, getAppState)
  if (!payload || message.type !== 'system') {
    return
  }

  if (message.subtype === 'task_started') {
    runtime.emitTaskStarted(payload)
    emitSwarmTaskPlaceholders(runtime, 'task_started', payload)
    emitAgentTaskPlaceholder(runtime, 'task_started', payload)
  } else if (message.subtype === 'task_progress') {
    runtime.emitTaskProgress(payload)
    emitSwarmTaskPlaceholders(runtime, 'task_progress', payload)
    emitAgentTaskPlaceholder(runtime, 'task_progress', payload)
  } else {
    runtime.emitTaskCompleted(payload)
    emitSwarmTaskPlaceholders(runtime, 'task_completed', payload)
    emitAgentTaskPlaceholder(runtime, 'task_completed', payload)
  }

  if (payload.toolUseId && message.subtype === 'task_notification') {
    const activeTool = runtime.getActiveTool(payload.toolUseId)
    if (activeTool) {
      const completedPayload = {
        ...activeTool,
        source: 'sdk-message' as const,
        outputPreview: payload.summary,
        summary: payload.summary,
      }
      runtime.emitToolCompleted(completedPayload)
      emitSwarmToolPlaceholder(runtime, 'tool_completed', completedPayload)
      emitAgentToolPlaceholder(runtime, 'tool_completed', completedPayload)
    }
  }

  if (payload.toolUseId && message.subtype === 'task_progress' && message.last_tool_name) {
    const toolPayload = {
      ...(runtime.getActiveTool(payload.toolUseId) ?? {
        toolUseId: payload.toolUseId,
        toolName: message.last_tool_name,
        source: 'sdk-message' as const,
      }),
      toolUseId: payload.toolUseId,
      toolName: message.last_tool_name,
      source: 'sdk-message' as const,
      taskId: payload.task.id,
      summary: payload.summary,
    }

    if (runtime.getActiveTool(payload.toolUseId)) {
      runtime.emitToolProgress(toolPayload)
    } else {
      runtime.emitToolStarted(toolPayload)
      emitSwarmToolPlaceholder(runtime, 'tool_started', toolPayload)
      emitAgentToolPlaceholder(runtime, 'tool_started', toolPayload)
      runtime.emitToolProgress(toolPayload)
    }
  }

  runtime.emitSwarmUpdated()
}

function buildTransientChannelPrompt(
  input: RuntimeSendMessageInput,
): string | undefined {
  if (input.channel !== 'web-ui') {
    return undefined
  }

  return [
    'Channel context for this turn:',
    '- The user is speaking from the BotValia Runtime web UI in a browser.',
    '- Treat the web UI as the active interface for this turn.',
    '- If the user asks where they are chatting from, answer that they are in the web UI connected to the live BotValia session, not only in the terminal CLI.',
    '- Keep this as transient channel context only.',
  ].join('\n')
}

function handleSdkMessage(
  runtime: SessionRuntime,
  message: SDKMessage,
  engine: QueryEngine,
  getAppState: () => AppState,
): void {
  if (message.type === 'stream_event') {
    if (isThinkingStreamStart(message.event)) {
      runtime.emitThinkingStarted({
        source: 'sdk-stream',
        messageUuid: message.uuid,
        ...extractThinkingStreamStartMeta(message.event),
      })
    }

    const toolStart = extractStreamToolUseStart(message.event)
    if (toolStart) {
      const payload = {
        ...toolStart,
        source: 'sdk-stream' as const,
        parentToolUseId: message.parent_tool_use_id,
      }
      runtime.emitToolStarted(payload)
      emitSwarmToolPlaceholder(runtime, 'tool_started', payload)
      emitAgentToolPlaceholder(runtime, 'tool_started', payload)
    }

    const thinkingDelta = extractStreamThinkingDelta(message.event)
    if (thinkingDelta) {
      runtime.emitThinkingDelta(thinkingDelta, {
        source: 'sdk-stream',
        messageUuid: message.uuid,
      })
    }

    const delta = extractStreamTextDelta(message.event)
    if (delta) {
      runtime.emitThinkingCompleted({
        source: 'sdk-stream',
        messageUuid: message.uuid,
      })
      runtime.emitMessageDelta(delta)
    }
    return
  }

  if (message.type === 'tool_progress') {
    const existingTool = runtime.getActiveTool(message.tool_use_id)
    const payload = {
      ...(existingTool ?? {
        toolUseId: message.tool_use_id,
        toolName: message.tool_name,
      }),
      toolUseId: message.tool_use_id,
      toolName: message.tool_name,
      source: 'sdk-message' as const,
      parentToolUseId: message.parent_tool_use_id,
      taskId: message.task_id,
      elapsedTimeSeconds: message.elapsed_time_seconds,
    }

    if (!existingTool) {
      runtime.emitToolStarted(payload)
      emitSwarmToolPlaceholder(runtime, 'tool_started', payload)
      emitAgentToolPlaceholder(runtime, 'tool_started', payload)
    }

    runtime.emitToolProgress(payload)
    return
  }

  if (message.type === 'tool_use_summary') {
    for (const toolUseId of message.preceding_tool_use_ids) {
      const activeTool = runtime.getActiveTool(toolUseId)
      if (!activeTool) {
        continue
      }

      const payload = {
        ...activeTool,
        source: 'sdk-message' as const,
        summary: message.summary,
      }

      runtime.emitToolCompleted(payload)
      emitSwarmToolPlaceholder(runtime, 'tool_completed', payload)
      emitAgentToolPlaceholder(runtime, 'tool_completed', payload)
    }
    return
  }

  if (message.type === 'assistant' || message.type === 'user') {
    const matched = findMessageByUuid(engine.getMessages(), message.uuid)
    if (matched) {
      for (const toolStart of extractToolStartsFromAssistantMessage(matched)) {
        if (!runtime.getActiveTool(toolStart.toolUseId)) {
          runtime.emitToolStarted(toolStart)
          emitSwarmToolPlaceholder(runtime, 'tool_started', toolStart)
          emitAgentToolPlaceholder(runtime, 'tool_started', toolStart)
        }
      }

      for (const toolCompletion of extractToolCompletionsFromUserMessage(
        runtime,
        matched,
      )) {
        runtime.emitToolCompleted(toolCompletion)
        emitSwarmToolPlaceholder(runtime, 'tool_completed', toolCompletion)
        emitAgentToolPlaceholder(runtime, 'tool_completed', toolCompletion)
      }

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
  runtime: providedRuntime,
}: QueryEngineSessionRuntimeConfig): QueryEngineSessionRuntimeController {
  let runtime: SessionRuntime

  const runPrompt = async function* (
    input: RuntimeSendMessageInput,
  ): AsyncGenerator<SDKMessage, void, unknown> {
    const activeChannel = input.channel ?? 'cli'
    runtime.claimActiveChannel(activeChannel)
    runtime.setStatus('running')

    try {
      for await (const message of engine.submitMessage(input.text, {
        uuid: input.uuid,
        isMeta: input.isMeta,
        querySource: activeChannel === 'web-ui' ? 'runtime-web' : 'sdk',
        transientSystemPrompt: buildTransientChannelPrompt(input),
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

  runtime =
    providedRuntime ??
    new SessionRuntime({
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
