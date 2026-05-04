export function extractStreamTextDelta(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  const candidate = event as {
    type?: unknown
    delta?: { type?: unknown; text?: string }
    content_block?: { text?: string }
  }

  if (
    candidate.type === 'content_block_delta' &&
    candidate.delta?.type === 'text_delta'
  ) {
    return candidate.delta.text
  }

  return candidate.delta?.text || candidate.content_block?.text || undefined
}

export function extractStreamThinkingDelta(
  event: unknown,
): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  const candidate = event as {
    type?: unknown
    delta?: { type?: unknown; thinking?: string }
  }

  if (
    candidate.type === 'content_block_delta' &&
    candidate.delta?.type === 'thinking_delta'
  ) {
    return candidate.delta.thinking
  }

  return candidate.delta?.thinking
}

export function isThinkingStreamStart(event: unknown): boolean {
  if (!event || typeof event !== 'object') {
    return false
  }

  const candidate = event as {
    type?: unknown
    content_block?: { type?: unknown }
  }

  if (candidate.type !== 'content_block_start') {
    return false
  }

  return (
    candidate.content_block?.type === 'thinking' ||
    candidate.content_block?.type === 'redacted_thinking'
  )
}

export function extractThinkingStreamStartMeta(event: unknown):
  | {
      blockType: 'thinking' | 'redacted_thinking'
    }
  | undefined {
  if (!isThinkingStreamStart(event)) {
    return undefined
  }

  const candidate = event as {
    content_block?: { type?: unknown }
  }

  return {
    blockType:
      candidate.content_block?.type === 'redacted_thinking'
        ? 'redacted_thinking'
        : 'thinking',
  }
}

export function extractStreamToolUseStart(event: unknown):
  | {
      toolUseId: string
      toolName: string
      inputPreview?: string
    }
  | undefined {
  if (!event || typeof event !== 'object') {
    return undefined
  }

  const candidate = event as {
    type?: unknown
    content_block?: {
      type?: unknown
      id?: unknown
      name?: unknown
      input?: unknown
    }
  }

  if (
    candidate.type !== 'content_block_start' ||
    candidate.content_block?.type !== 'tool_use' ||
    typeof candidate.content_block.id !== 'string' ||
    typeof candidate.content_block.name !== 'string'
  ) {
    return undefined
  }

  const inputPreview =
    candidate.content_block.input === undefined
      ? undefined
      : JSON.stringify(candidate.content_block.input).slice(0, 400)

  return {
    toolUseId: candidate.content_block.id,
    toolName: candidate.content_block.name,
    inputPreview,
  }
}
