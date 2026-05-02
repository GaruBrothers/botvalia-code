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
