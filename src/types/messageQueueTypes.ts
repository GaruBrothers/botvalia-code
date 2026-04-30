export type QueueOperation = 'enqueue' | 'dequeue' | 'remove' | 'popAll'

export type MessageQueueEntry = {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
}

export type QueueOperationMessage = MessageQueueEntry
