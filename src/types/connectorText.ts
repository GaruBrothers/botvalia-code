export type ConnectorTextBlock = {
  type?: string
  text?: string
  [key: string]: unknown
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(value: unknown): value is ConnectorTextBlock {
  return !!value && typeof value === 'object' && 'text' in (value as Record<string, unknown>)
}
