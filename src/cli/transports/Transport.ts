import type { StdoutMessage } from 'src/entrypoints/sdk/controlTypes.js'
import type { StreamClientEvent } from './SSETransport.js'

export interface Transport {
  connect(): Promise<void>
  close(): void | Promise<void>
  write(message: StdoutMessage): Promise<void>
  setOnData(handler: (data: string) => void): void
  setOnClose(handler: (closeCode?: number) => void): void
  setOnConnect?(handler: () => void): void
  setOnEvent?(handler: (event: StreamClientEvent) => void): void
}
