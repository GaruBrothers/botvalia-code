import type { LocalCommandCall } from '../../types/command.js'
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

function formatRunningMessage(
  prefix: string,
  status: ReturnType<typeof getRuntimeServerStatus>,
): string {
  if (status.status !== 'running') {
    return prefix
  }

  return [
    prefix,
    `URL: ${status.server.url}`,
    `Host: ${status.server.host}`,
    `Puerto: ${status.server.port}`,
    `Sesiones activas: ${getSessionCount()}`,
    'Usa /runtime stop para apagarlo.',
  ].join('\n')
}

const call: LocalCommandCall = async args => {
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
      const status = getRuntimeServerStatus()
      if (status.status === 'running') {
        return {
          type: 'text',
          value: formatRunningMessage('Bridge runtime activo.', status),
        }
      }

      if (status.status === 'starting') {
        return {
          type: 'text',
          value:
            'El bridge runtime se está iniciando. Repite /runtime status en unos segundos.',
        }
      }

      if (status.status === 'failed') {
        return {
          type: 'text',
          value: `El bridge runtime falló al iniciar: ${status.error.message}`,
        }
      }

      return {
        type: 'text',
        value:
          'El bridge runtime no está activo. Usa /runtime o /runtime start para levantarlo.',
      }
    }

    if (normalizedSubcommand === 'stop') {
      const stopped = await stopRuntimeServer()
      return {
        type: 'text',
        value: stopped
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

export default {
  call,
} satisfies { call: LocalCommandCall }
