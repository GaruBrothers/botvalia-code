import type { AddressInfo } from 'net'
import { WebSocket, WebSocketServer } from 'ws'
import type { RuntimeProtocolMessage, RuntimeProtocolRequest } from './protocol.js'
import { RuntimeBridge } from './runtimeBridge.js'
import { createRuntimeService, type RuntimeService } from './runtimeService.js'

export type RuntimeWebSocketServerConfig = {
  host?: string
  port?: number
  path?: string
  runtimeService?: RuntimeService
}

export type RunningRuntimeWebSocketServer = {
  host: string
  port: number
  path: string
  url: string
  stop: () => Promise<void>
}

function isRuntimeProtocolRequest(
  value: unknown,
): value is RuntimeProtocolRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { requestId?: unknown; method?: unknown }
  return (
    typeof candidate.requestId === 'string' &&
    typeof candidate.method === 'string'
  )
}

function serializeMessage(message: RuntimeProtocolMessage): string {
  return JSON.stringify(message)
}

export async function startRuntimeWebSocketServer(
  config: RuntimeWebSocketServerConfig = {},
): Promise<RunningRuntimeWebSocketServer> {
  const host = config.host ?? '127.0.0.1'
  const port = config.port ?? 0
  const path = config.path ?? '/botvalia-runtime'
  const runtimeService = config.runtimeService ?? createRuntimeService()

  const server = new WebSocketServer({
    host,
    port,
    path,
  })

  server.on('connection', socket => {
    const bridge = new RuntimeBridge(runtimeService)
    const unsubscribe = bridge.onEvent(event => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeMessage(event))
      }
    })

    socket.on('message', async raw => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              requestId: 'unknown',
              ok: false,
              error: 'No pude parsear el mensaje JSON del cliente runtime.',
            }),
          )
        }
        return
      }

      if (!isRuntimeProtocolRequest(parsed)) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              requestId: 'unknown',
              ok: false,
              error: 'El mensaje no cumple el contrato RuntimeProtocolRequest.',
            }),
          )
        }
        return
      }

      const response = await bridge.handleRequest(parsed)
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializeMessage(response))
      }
    })

    socket.on('close', () => {
      unsubscribe()
      bridge.close()
    })

    socket.on('error', () => {
      unsubscribe()
      bridge.close()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', reject)
  })

  const address = server.address() as AddressInfo | null
  const actualPort = address?.port ?? port
  const url = `ws://${host}:${actualPort}${path}`

  return {
    host,
    port: actualPort,
    path,
    url,
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
}
