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
import {
  getRuntimeWebSocketAuthToken,
  RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM,
} from '../../runtime/protocol.js'
import {
  formatSecurityPreflightAudit,
  runSecurityPreflightAudit,
} from '../../runtime/securityAudit.js'
import type {
  RuntimeModelOption,
  RuntimeSessionSnapshot,
} from '../../runtime/types.js'
import { openBrowser } from '../../utils/browser.js'
import { getCwd } from '../../utils/cwd.js'

const HELP_TEXT = [
  '/runtime inicia o muestra el bridge local para BotValia Desktop.',
  '/runtime start [puerto] inicia el server WebSocket local.',
  '/runtime status muestra el estado actual.',
  '/runtime sessions lista sesiones vivas y persistidas.',
  '/runtime create ["titulo"] [--cwd path] [--notes "texto"] crea un record local de sesión.',
  '/runtime archive <session-id> archiva una sesión.',
  '/runtime restore <session-id> restaura una sesión archivada.',
  '/runtime pin <session-id> [on|off] fija o desfija una sesión.',
  '/runtime model list muestra los modelos válidos para sesiones.',
  '/runtime model get <session-id> muestra el override de modelo actual.',
  '/runtime model set <session-id> <modelo|default> actualiza el override por sesión.',
  '/runtime security ejecuta el preflight OSS local.',
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

function getRuntimeService() {
  return getGlobalRuntimeService()
}

function getSessionCount(): number {
  return getRuntimeService().listSessions().length
}

function buildInspectorLaunchUrl(
  inspectorUrl: string,
  runtimeUrl?: string,
): string {
  if (!runtimeUrl) {
    return inspectorUrl
  }

  const url = new URL(inspectorUrl)
  const runtimeSocketUrl = new URL(runtimeUrl)
  const runtimeAuthToken = getRuntimeWebSocketAuthToken(runtimeSocketUrl)
  runtimeSocketUrl.searchParams.delete(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM)
  url.searchParams.set('runtime', runtimeSocketUrl.toString())
  if (runtimeAuthToken) {
    const hashParams = new URLSearchParams(
      url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
    )
    hashParams.set(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM, runtimeAuthToken)
    url.hash = hashParams.toString()
  }
  return url.toString()
}

function sanitizeRuntimeWebSocketUrl(runtimeUrl: string): string {
  const url = new URL(runtimeUrl)
  url.searchParams.delete(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM)
  return url.toString()
}

function sanitizeInspectorLaunchUrl(launchUrl: string): string {
  const url = new URL(launchUrl)
  const hashParams = new URLSearchParams(
    url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
  )
  hashParams.delete(RUNTIME_WS_AUTH_TOKEN_QUERY_PARAM)
  url.hash = hashParams.toString()
  return url.toString()
}

function tokenizeArgs(rawArgs: string): string[] {
  const matches = rawArgs.match(/"([^"]*)"|'([^']*)'|[^\s]+/g)
  if (!matches) {
    return []
  }

  return matches.map(token => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1)
    }

    return token
  })
}

function resolveSession(sessionIdOrPrefix: string): RuntimeSessionSnapshot {
  const sessions = getRuntimeService().listSessions()
  const exact = sessions.find(session => session.sessionId === sessionIdOrPrefix)
  if (exact) {
    return exact
  }

  const matches = sessions.filter(session =>
    session.sessionId.startsWith(sessionIdOrPrefix),
  )

  if (matches.length === 1) {
    return matches[0]
  }

  if (matches.length > 1) {
    throw new Error(
      `El id ${sessionIdOrPrefix} es ambiguo. Coincide con ${matches.length} sesiones.`,
    )
  }

  throw new Error(`No existe una sesión con id ${sessionIdOrPrefix}.`)
}

function formatOwner(snapshot: RuntimeSessionSnapshot): string {
  if (!snapshot.channelOwner) {
    return 'none'
  }

  const owner = snapshot.channelOwner
  if (owner.channel !== 'web-ui') {
    return owner.channel
  }

  const clientId = owner.clientId ? owner.clientId.slice(0, 8) : 'unknown'
  return `${owner.channel}:${clientId}`
}

function formatSessionLine(snapshot: RuntimeSessionSnapshot, index: number): string {
  const stateBits = [
    snapshot.hasLiveRuntime ? 'live' : 'persisted',
    snapshot.isArchived ? 'archived' : 'active',
    snapshot.isPinned ? 'pinned' : 'unpinned',
    snapshot.status,
  ]

  return [
    `${index + 1}. ${snapshot.title}`,
    `id=${snapshot.sessionId}`,
    `cwd=${snapshot.cwd}`,
    `state=${stateBits.join('/')}`,
    `channel=${snapshot.activeChannel}`,
    `owner=${formatOwner(snapshot)}`,
    `model=${snapshot.mainLoopModelForSession ?? snapshot.mainLoopModel ?? 'default'}`,
    `updated=${snapshot.updatedAt}`,
  ].join(' | ')
}

function formatSessions(sessions: RuntimeSessionSnapshot[]): string {
  if (sessions.length === 0) {
    return 'No hay sesiones runtime vivas ni persistidas.'
  }

  return sessions.map(formatSessionLine).join('\n')
}

function parseCreateArgs(tokens: string[]): {
  title: string
  cwd: string
  notes?: string
} {
  const positional: string[] = []
  let cwd = getCwd()
  let notes: string | undefined

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token === '--cwd') {
      const value = tokens[index + 1]
      if (!value) {
        throw new Error('Falta el valor para --cwd.')
      }
      cwd = value
      index += 1
      continue
    }

    if (token === '--notes') {
      const value = tokens[index + 1]
      if (!value) {
        throw new Error('Falta el valor para --notes.')
      }
      notes = value
      index += 1
      continue
    }

    positional.push(token)
  }

  const title =
    positional.join(' ').trim() ||
    `Session ${new Date().toISOString().replace('T', ' ').slice(0, 16)}`

  return {
    title,
    cwd,
    notes,
  }
}

function formatRuntimeStatus(): string {
  const runtimeStatus = getRuntimeServerStatus()
  const inspectorStatus = getRuntimeInspectorServerStatus()
  const lines: string[] = []

  if (runtimeStatus.status === 'running') {
    lines.push('Bridge runtime activo.')
    lines.push(
      `URL runtime: ${sanitizeRuntimeWebSocketUrl(runtimeStatus.server.url)}`,
    )
    lines.push(`Host runtime: ${runtimeStatus.server.host}`)
    lines.push(`Puerto runtime: ${runtimeStatus.server.port}`)
    lines.push(`Sesiones conocidas: ${getSessionCount()}`)
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
        `Launch URL: ${sanitizeInspectorLaunchUrl(
          buildInspectorLaunchUrl(
            inspectorStatus.server.url,
            runtimeStatus.server.url,
          ),
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

function formatModelOptions(models: RuntimeModelOption[]): string {
  if (models.length === 0) {
    return 'No hay modelos publicados por el runtime actual.'
  }

  return models
    .map(model => `${model.value}: ${model.label} - ${model.description}`)
    .join('\n')
}

export const call: LocalCommandCall = async args => {
  try {
    const trimmedArgs = args.trim()
    const tokens = tokenizeArgs(trimmedArgs)
    const [subcommand = '', ...rest] = tokens
    const normalizedSubcommand = subcommand.toLowerCase()
    const runtimeService = getRuntimeService()

    if (!trimmedArgs || normalizedSubcommand === 'start') {
      const requestedPort = parsePort(rest[0])
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
          `URL: ${sanitizeRuntimeWebSocketUrl(server.url)}`,
          `Host: ${server.host}`,
          `Puerto: ${server.port}`,
          `Sesiones conocidas: ${getSessionCount()}`,
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

    if (normalizedSubcommand === 'sessions') {
      return {
        type: 'text',
        value: formatSessions(runtimeService.listSessions()),
      }
    }

    if (normalizedSubcommand === 'create') {
      const created = await runtimeService.createSession(parseCreateArgs(rest), {
        channel: 'cli',
      })

      return {
        type: 'text',
        value: [
          'Sesión runtime persistida creada.',
          formatSessionLine(created.session, 0),
          created.session.hasLiveRuntime
            ? 'Worker vivo: sí.'
            : 'Worker vivo: no. Este record todavía no procesa prompts hasta que exista un runtime activo para esa sesión.',
        ].join('\n'),
      }
    }

    if (normalizedSubcommand === 'archive') {
      const sessionId = rest[0]
      if (!sessionId) {
        throw new Error('Uso: /runtime archive <session-id>')
      }

      const session = resolveSession(sessionId)
      const snapshot = await runtimeService.archiveSession(session.sessionId, {
        channel: 'cli',
      })
      return {
        type: 'text',
        value: `Sesión archivada.\n${formatSessionLine(snapshot, 0)}`,
      }
    }

    if (
      normalizedSubcommand === 'restore' ||
      normalizedSubcommand === 'unarchive'
    ) {
      const sessionId = rest[0]
      if (!sessionId) {
        throw new Error('Uso: /runtime restore <session-id>')
      }

      const session = resolveSession(sessionId)
      const snapshot = await runtimeService.unarchiveSession(session.sessionId, {
        channel: 'cli',
      })
      return {
        type: 'text',
        value: `Sesión restaurada.\n${formatSessionLine(snapshot, 0)}`,
      }
    }

    if (normalizedSubcommand === 'pin') {
      const sessionId = rest[0]
      if (!sessionId) {
        throw new Error('Uso: /runtime pin <session-id> [on|off]')
      }

      const session = resolveSession(sessionId)
      const requestedState = rest[1]?.toLowerCase()
      const pinned =
        requestedState === 'on'
          ? true
          : requestedState === 'off'
            ? false
            : !session.isPinned

      const snapshot = await runtimeService.pinSession(
        session.sessionId,
        pinned,
        {
          channel: 'cli',
        },
      )

      return {
        type: 'text',
        value: `${pinned ? 'Sesión fijada.' : 'Sesión desfijada.'}\n${formatSessionLine(snapshot, 0)}`,
      }
    }

    if (normalizedSubcommand === 'model') {
      const action = rest[0]?.toLowerCase()

      if (!action || action === 'list') {
        return {
          type: 'text',
          value: formatModelOptions(runtimeService.listModels()),
        }
      }

      if (action === 'get') {
        const sessionId = rest[1]
        if (!sessionId) {
          throw new Error('Uso: /runtime model get <session-id>')
        }

        const session = resolveSession(sessionId)
        return {
          type: 'text',
          value: [
            `Sesión: ${session.title}`,
            `id: ${session.sessionId}`,
            `override: ${session.mainLoopModelForSession ?? 'default'}`,
            `runtime actual: ${session.mainLoopModel ?? 'default'}`,
          ].join('\n'),
        }
      }

      if (action === 'set') {
        const sessionId = rest[1]
        const rawModel = rest.slice(2).join(' ').trim()
        if (!sessionId || !rawModel) {
          throw new Error('Uso: /runtime model set <session-id> <modelo|default>')
        }

        const session = resolveSession(sessionId)
        const snapshot = await runtimeService.setSessionModel(
          session.sessionId,
          rawModel === 'default' ? null : rawModel,
          {
            channel: 'cli',
          },
        )

        return {
          type: 'text',
          value: [
            'Modelo de sesión actualizado.',
            `Sesión: ${snapshot.title}`,
            `Override: ${snapshot.mainLoopModelForSession ?? 'default'}`,
            `Runtime actual: ${snapshot.mainLoopModel ?? 'default'}`,
          ].join('\n'),
        }
      }

      throw new Error(`Subcomando de modelo desconocido: ${rest[0]}`)
    }

    if (normalizedSubcommand === 'security') {
      const audit = runSecurityPreflightAudit()
      return {
        type: 'text',
        value: formatSecurityPreflightAudit(audit),
      }
    }

    if (normalizedSubcommand === 'ui') {
      const runtimeServer = await ensureRuntimeServer()
      const inspectorServer = await ensureRuntimeInspectorServer()
      const inspectorUrl = buildInspectorLaunchUrl(
        inspectorServer.url,
        runtimeServer.url,
      )
      const visibleInspectorUrl = sanitizeInspectorLaunchUrl(inspectorUrl)

      return {
        type: 'text',
        value: [
          `BotValia-CodeUI lista en ${visibleInspectorUrl}`,
          `Runtime WebSocket: ${sanitizeRuntimeWebSocketUrl(runtimeServer.url)}`,
          `Sesiones conocidas: ${getSessionCount()}`,
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
      const visibleInspectorUrl = sanitizeInspectorLaunchUrl(inspectorUrl)
      const opened = await openBrowser(inspectorUrl)

      return {
        type: 'text',
        value: [
          opened
            ? `Inspector visual abierto en ${visibleInspectorUrl}`
            : `Inspector visual listo en ${visibleInspectorUrl}`,
          `Runtime WebSocket: ${sanitizeRuntimeWebSocketUrl(runtimeServer.url)}`,
          `Sesiones conocidas: ${getSessionCount()}`,
          opened
            ? 'Se abrió el navegador por defecto.'
            : 'No pude abrir el navegador automáticamente; abre esa URL manualmente.',
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
