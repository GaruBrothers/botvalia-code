import type { Message } from '../types/message.js'

export async function createSessionTurnUploader(): Promise<
  (messages: Message[]) => Promise<void>
> {
  return async (_messages: Message[]) => {}
}
