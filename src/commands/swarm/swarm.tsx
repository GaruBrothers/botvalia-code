import React from 'react'
import { SwarmDialog } from '../../components/swarm/SwarmDialog.js'
import { spawnTeammate } from '../../tools/shared/spawnMultiAgent.js'
import { TeamCreateTool } from '../../tools/TeamCreateTool/TeamCreateTool.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { TEAM_LEAD_NAME } from '../../utils/swarm/constants.js'
import {
  createTeamConversationEvent,
  getTeamConversationEventSummary,
} from '../../utils/swarm/teamConversationEvents.js'
import { writeToMailbox } from '../../utils/teammateMailbox.js'

function shortId(value: string): string {
  return value.slice(0, 8)
}

function normalizeRoles(roles: string[]): string[] {
  const requestedRoles = roles.length > 0 ? roles : ['planner', 'coder', 'qa']
  const uniqueRoles = new Set<string>()

  for (const role of requestedRoles) {
    const trimmed = role.trim().toLowerCase()
    if (!trimmed || trimmed === TEAM_LEAD_NAME.toLowerCase()) {
      continue
    }
    uniqueRoles.add(trimmed)
  }

  const normalized = Array.from(uniqueRoles)
  return normalized.length > 0 ? normalized : ['planner', 'coder', 'qa']
}

function buildTeammatePrompt(
  teamName: string,
  role: string,
  peers: string[],
): string {
  const peerMentions = peers.map(peer => `@${peer}`).join(', ')
  const collaborationLine = peers.length
    ? `Tus peers directos son ${peerMentions}.`
    : 'Trabaja coordinado con el team lead.'

  const roleMission =
    role === 'planner'
      ? 'Tu foco es ordenar el trabajo, detectar bloqueos y pedir avances parciales.'
      : role === 'coder'
        ? 'Tu foco es la implementación técnica y desbloquear el trabajo práctico.'
        : role === 'qa'
          ? 'Tu foco es validar, buscar edge cases y confirmar calidad.'
          : `Tu foco es cumplir el rol ${role} y colaborar activamente.`

  return [
    `Eres @${role} dentro del swarm ${teamName}.`,
    collaborationLine,
    roleMission,
    'Arranca en modo silencioso.',
    'No uses SendMessage para saludar, confirmar disponibilidad, decir que estas listo o mandar acknowledged.',
    'Si todavia no tienes una tarea concreta o una pregunta concreta, no respondas a este arranque y espera instrucciones utiles por thread o task list.',
    'Habla con los demás usando SendMessage cuando necesites coordinar, preguntar o responder.',
    'Solo manda avances parciales cuando tengan contenido concreto: una decision, un bloqueo, una pregunta o un resultado.',
  ].join(' ')
}

function buildKickoffBody(role: string, peers: string[]): string {
  const peerMentions = peers.map(peer => `@${peer}`)
  const peerList =
    peerMentions.length > 0 ? peerMentions.join(', ') : '@team-lead'

  if (role === 'planner') {
    return [
      `Coordínate con ${peerList}.`,
      'Define el primer paso real, reparte trabajo y abre las preguntas necesarias sin esperar al final.',
      'Tu primera respuesta debe traer un plan breve o un bloqueo concreto, no disponibilidad.',
      'Pídele a @coder un camino técnico inicial y a @qa los edge cases que más riesgo ve.',
    ].join(' ')
  }

  if (role === 'coder') {
    return [
      `Coordínate con ${peerList}.`,
      'Propón la ruta técnica inicial y qué tocarías primero.',
      'Consulta a @planner si el orden del trabajo cambia y a @qa qué edge cases debes cubrir antes de editar.',
      'Tu primera respuesta debe ser una acción concreta o una pregunta técnica real, no disponibilidad.',
    ].join(' ')
  }

  if (role === 'qa') {
    return [
      `Coordínate con ${peerList}.`,
      'Define los criterios de validación y los edge cases que no se pueden escapar.',
      'Pregunta a @coder qué superficie tocará y confirma con @planner el orden de revisión.',
      'Tu primera respuesta debe traer validaciones concretas o un riesgo real, no disponibilidad.',
    ].join(' ')
  }

  return [
    `Coordínate con ${peerList}.`,
    'Define tu primer aporte concreto dentro del swarm y abre las preguntas que necesites de inmediato.',
    'No respondas con disponibilidad: responde con acción, riesgo o bloqueo real.',
  ].join(' ')
}

async function openKickoffThread(
  teamName: string,
  roles: string[],
): Promise<string> {
  const activeRoles = normalizeRoles(roles)
  if (activeRoles.length === 0) {
    throw new Error('No hay teammates activos para abrir el kickoff del swarm.')
  }

  const topic = `Kickoff ${teamName}`
  const firstRole = activeRoles[0]!
  const firstEvent = createTeamConversationEvent({
    from: TEAM_LEAD_NAME,
    to: firstRole,
    kind: 'task',
    body: buildKickoffBody(
      firstRole,
      activeRoles.filter(role => role !== firstRole),
    ),
    topic,
    priority: 'high',
    requires_response: true,
    metadata: {
      initiated_via: 'swarm-command',
    },
  })

  const followupEvents = activeRoles.slice(1).map(role =>
    createTeamConversationEvent({
      from: TEAM_LEAD_NAME,
      to: role,
      kind: role === 'qa' ? 'question' : 'handoff',
      body: buildKickoffBody(
        role,
        activeRoles.filter(candidate => candidate !== role),
      ),
      topic,
      thread_id: firstEvent.thread_id,
      reply_to: firstEvent.event_id,
      priority: 'high',
      requires_response: true,
      metadata: {
        initiated_via: 'swarm-command',
      },
    }),
  )

  for (const event of [firstEvent, ...followupEvents]) {
    await writeToMailbox(
      event.to,
      {
        from: event.from,
        event,
        summary: getTeamConversationEventSummary(event),
        timestamp: new Date().toISOString(),
      },
      teamName,
    )
  }

  return firstEvent.thread_id
}

async function createSwarmRuntime(
  context: Parameters<LocalJSXCommandCall>[1],
  requestedTeamName: string,
  requestedRoles: string[],
): Promise<{
  teamName: string
  activeRoles: string[]
  spawnedRoles: string[]
  threadId?: string
}> {
  const normalizedRoles = normalizeRoles(requestedRoles)
  const currentTeamName = context.getAppState().teamContext?.teamName

  if (currentTeamName && currentTeamName !== requestedTeamName) {
    throw new Error(
      `Ya hay un swarm activo (${currentTeamName}). Cierra ese team antes de crear ${requestedTeamName}.`,
    )
  }

  const teamName =
    currentTeamName ||
    (
      await TeamCreateTool.call(
        {
          team_name: requestedTeamName,
          description: `Swarm ${normalizedRoles.join(', ') || 'general'}`,
          agent_type: 'team-lead',
        },
        context,
      )
    ).data.team_name

  const refreshedState = context.getAppState()
  const leaderModelSetting = refreshedState.mainLoopModel ?? undefined
  const existingNames = new Set(
    Object.values(refreshedState.teamContext?.teammates || {}).map(teammate =>
      teammate.name.toLowerCase(),
    ),
  )

  const rolesToSpawn = normalizedRoles.filter(
    role => !existingNames.has(role.toLowerCase()),
  )

  const spawnedRoles: string[] = []
  for (const role of rolesToSpawn) {
    const peers = normalizedRoles.filter(candidate => candidate !== role)
    const result = await spawnTeammate(
      {
        name: role,
        description: `${role} teammate`,
        prompt: buildTeammatePrompt(teamName, role, peers),
        team_name: teamName,
        use_splitpane: true,
        model: leaderModelSetting,
      },
      context,
    )

    spawnedRoles.push(result.data.name)
  }

  const activeRoles = normalizedRoles.filter(role =>
    rolesToSpawn.includes(role) || existingNames.has(role.toLowerCase()),
  )

  let threadId: string | undefined
  if (activeRoles.length >= 1) {
    threadId = await openKickoffThread(teamName, activeRoles)
  }

  return {
    teamName,
    activeRoles,
    spawnedRoles,
    threadId,
  }
}

const SWARM_HELP = [
  '/swarm abre la sala de control viva del swarm.',
  '/swarm create [team-name] [roles...] crea el team runtime y lanza los teammates directamente.',
  'Puedes crear el swarm desde el propio comando o desde un prompt natural en la sesión actual.',
  'No uses /agents para levantar el swarm activo: /agents sirve para definir agentes, no para iniciar el team runtime.',
  'Ejemplo: crea un swarm llamado demo-swarm con planner, coder y qa; quiero que se coordinen entre ustedes y me den avances parciales.',
  'Vistas: agents, threads, waiting.',
  'Desde agents puedes escribirle a un teammate o abrir un thread entre dos teammates.',
  'Desde threads/waiting puedes inspeccionar la conversación y empujar al agente que está en espera.',
  'La coordinación en vivo funciona mejor con teammates same-process porque sus wakeups de mailbox son inmediatos.',
].join('\n')

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmedArgs = args?.trim() || ''
  const normalizedArgs = trimmedArgs.toLowerCase()

  if (normalizedArgs === 'help' || normalizedArgs === '?') {
    onDone(SWARM_HELP, { display: 'system', shouldQuery: false })
    return null
  }

  if (normalizedArgs.startsWith('create')) {
    const parts = trimmedArgs.split(/\s+/).filter(Boolean)
    const teamName = parts[1] || 'demo-swarm'
    const roles = parts.slice(2)
    try {
      const result = await createSwarmRuntime(_context, teamName, roles)
      const threadSuffix = result.threadId
        ? ` Thread inicial ${shortId(result.threadId)} abierto.`
        : ''
      const spawnedSuffix =
        result.spawnedRoles.length > 0
          ? ` Nuevos teammates: ${result.spawnedRoles.map(role => `@${role}`).join(', ')}.`
          : ' Los teammates ya existían y el swarm quedó reutilizado.'

      onDone(
        `Swarm ${result.teamName} activo con ${result.activeRoles.map(role => `@${role}`).join(', ')}.${spawnedSuffix}${threadSuffix} Abre /swarm para dirigirlo.`,
        {
          display: 'system',
          shouldQuery: false,
        },
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No pude crear el swarm por un error desconocido.'
      onDone(`No pude crear el swarm ${teamName}: ${message}`, {
        display: 'system',
        shouldQuery: false,
      })
    }
    return null
  }

  return <SwarmDialog onDone={onDone} />
}
