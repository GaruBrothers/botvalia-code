import type { Message, SystemMessage } from '../../types/message.js'

export function isSnipBoundaryMessage(
  _message?: Message,
): _message is SystemMessage {
  return false
}

export function projectSnippedMessages<T>(messages: T): T {
  return messages
}

export function projectSnippedView<T>(messages: T): T {
  return messages
}
