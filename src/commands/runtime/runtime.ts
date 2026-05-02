import type { LocalCommandCall } from '../../types/command.js'
import {
  stopRuntimeInspectorServer,
} from '../../runtime/runtimeInspectorServer.js'
import { getGlobalRuntimeService } from '../../runtime/runtimeService.js'
import {
  ensureRuntimeServer,
  getRuntimeServerStatus,
  stopRuntimeServer,
} from '../../runtime/runtimeServerManager.js'

const HELP_TEXT = [
  '/runtime inicia o muestra el bridge local para BotValia Desktop.',
  '/runtime start [puerto] inicia el server WebSocket local.',
  '/runtime status muestra el estado actual.',
  '/runtime ui informa que la UI web fue retirada de este repo.',
  '/runtime open informa que la UI web fue retirada de este repo.',
  '/runtime stop apaga el server local.',
  '/runtime help muestra esta ayuda.',
].join('\n')

function parsePort(rawPort?: string): number | undefined {
  if (!rawPort) {
    return undefined
  }

  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Puerto inválido: ${rawPort}`)
  }

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Puerto fuera de rango: ${rawPort}`)
  }

  return port
}

function getSessionCount(): number {
  return getGlobalRuntimeService().listSessions().length
}

function formatRuntimeStatus(): string {
  const runtimeStatus = getRuntimeServerStatus()
  const lines: string[] = []

  if (runtimeStatus.status === 'running') {
    lines.push('Bridge runtime activo.')
    lines.push(`URL runtime: ${runtimeStatus.server.url}`)
    lines.push(`Host runtime: ${runtimeStatus.server.host}`)
    lines.push(`Puerto runtime: ${runtimeStatus.server.port}`)
    lines.push(`Sesiones activas: ${getSessionCount()}`)
  } else if (runtimeStatus.status === 'starting') {
    lines.push('Bridge runtime iniciando.')
  } else if (runtimeStatus.status === 'failed') {
    lines.push(`Bridge runtime con error: ${runtimeStatus.error.message}`)
  } else {
    lines.push('Bridge runtime apagado.')
  }

  lines.push('UI web del runtime: retirada de este repo.')

  return lines.join('\n')
}

export const call: LocalCommandCall = async args => {
  try {
    const trimmedArgs = args.trim()
    const [subcommand = '', portArg] = trimmedArgs.split(/\s+/).filter(Boolean)
    const normalizedSubcommand = subcommand.toLowerCase()

    if (!trimmedArgs || normalizedSubcommand === 'start') {
      const requestedPort = parsePort(portArg)
      const wasRunning = getRuntimeServerStatus()
      const server = await ensureRuntimeServer({
        port: requestedPort,
      })

      const reusedExistingServer =
        wasRunning.status === 'running' &&
        requestedPort !== undefined &&
        wasRunning.server.port !== requestedPort

      return {
        type: 'text',
        value: [
          reusedExistingServer
            ? 'Bridge runtime ya estaba activo y se reutilizó.'
            : 'Bridge runtime activo.',
          `URL: ${server.url}`,
          `Host: ${server.host}`,
          `Puerto: ${server.port}`,
          `Sesiones activas: ${getSessionCount()}`,
          'Conecta una app desktop o cliente local a esa URL por WebSocket.',
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'status') {
      return {
        type: 'text',
        value: formatRuntimeStatus(),
      }
    }

    if (normalizedSubcommand === 'ui') {
      return {
        type: 'text',
        value: [
          'La UI web del runtime fue retirada de este repo.',
          'El bridge runtime sigue disponible por WebSocket.',
          formatRuntimeStatus(),
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'open') {
      return {
        type: 'text',
        value: [
          'La UI web del runtime fue retirada de este repo.',
          'No se abrirá navegador porque ya no existe inspector embebido aquí.',
          'Usa /runtime status para ver el bridge activo.',
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'stop') {
      await stopRuntimeInspectorServer()
      const runtimeStopped = await stopRuntimeServer()
      return {
        type: 'text',
        value: runtimeStopped
          ? 'Bridge runtime detenido.'
          : 'El bridge runtime ya estaba apagado.',
      }
    }

    if (normalizedSubcommand === 'help' || normalizedSubcommand === '?') {
      return {
        type: 'text',
        value: HELP_TEXT,
      }
    }

    return {
      type: 'text',
      value: `Subcomando desconocido: ${subcommand}\n\n${HELP_TEXT}`,
    }
  } catch (error) {
    return {
      type: 'text',
      value:
        error instanceof Error
          ? `No pude ejecutar /runtime: ${error.message}`
          : 'No pude ejecutar /runtime por un error desconocido.',
    }
  }
}
