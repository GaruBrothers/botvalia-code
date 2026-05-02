import type { LocalCommandCall } from '../../types/command.js'
import {
  ensureRuntimeInspectorServer,
  getRuntimeInspectorServerStatus,
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
  '/runtime ui inicia la app web BotValia-CodeUI conectada al runtime local.',
  '/runtime open inicia la app web y abre la URL conectada al runtime actual.',
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

function buildInspectorLaunchUrl(
  inspectorUrl: string,
  runtimeUrl?: string,
): string {
  if (!runtimeUrl) {
    return inspectorUrl
  }

  const url = new URL(inspectorUrl)
  url.searchParams.set('runtime', runtimeUrl)
  return url.toString()
}

function formatRuntimeStatus(): string {
  const runtimeStatus = getRuntimeServerStatus()
  const inspectorStatus = getRuntimeInspectorServerStatus()
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

  if (inspectorStatus.status === 'running') {
    lines.push('UI web BotValia-CodeUI activa.')
    lines.push(`URL inspector: ${inspectorStatus.server.url}`)
    if (runtimeStatus.status === 'running') {
      lines.push(
        `Launch URL: ${buildInspectorLaunchUrl(
          inspectorStatus.server.url,
          runtimeStatus.server.url,
        )}`,
      )
    }
  } else if (inspectorStatus.status === 'starting') {
    lines.push('UI web BotValia-CodeUI iniciando.')
  } else if (inspectorStatus.status === 'failed') {
    lines.push(`UI web BotValia-CodeUI con error: ${inspectorStatus.error.message}`)
  } else {
    lines.push('UI web BotValia-CodeUI apagada.')
  }

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
      const runtimeServer = await ensureRuntimeServer()
      const inspectorServer = await ensureRuntimeInspectorServer()
      const inspectorUrl = buildInspectorLaunchUrl(
        inspectorServer.url,
        runtimeServer.url,
      )

      return {
        type: 'text',
        value: [
          `BotValia-CodeUI lista en ${inspectorUrl}`,
          `Runtime WebSocket: ${runtimeServer.url}`,
          `Sesiones activas: ${getSessionCount()}`,
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'open') {
      const runtimeServer = await ensureRuntimeServer()
      const inspectorServer = await ensureRuntimeInspectorServer()
      const inspectorUrl = buildInspectorLaunchUrl(
        inspectorServer.url,
        runtimeServer.url,
      )

      return {
        type: 'text',
        value: [
          `Inspector visual abierto en ${inspectorUrl}`,
          `Runtime WebSocket: ${runtimeServer.url}`,
          `Sesiones activas: ${getSessionCount()}`,
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'stop') {
      const inspectorStopped = await stopRuntimeInspectorServer()
      const runtimeStopped = await stopRuntimeServer()
      return {
        type: 'text',
        value:
          inspectorStopped || runtimeStopped
            ? 'Bridge runtime y UI BotValia-CodeUI detenidos.'
            : 'El bridge runtime y la UI ya estaban apagados.',
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
