export function sanitizeWebhookPayload<T>(value: T): T {
  return value
}

export const sanitizeInboundWebhookContent = sanitizeWebhookPayload
