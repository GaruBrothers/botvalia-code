import React from 'react'
import { SwarmDialog } from '../../components/swarm/SwarmDialog.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

function buildSwarmCreatePrompt(teamName: string, roles: string[]): string {
  const normalizedRoles = roles.length > 0 ? roles : ['planner', 'coder', 'qa']
  const roleList = normalizedRoles.join(', ')

  return [
    `Crea un swarm llamado ${teamName} con ${normalizedRoles.length} teammates: ${roleList}.`,
    'Usa el runtime real de team en esta sesión.',
    'Empieza usando TeamCreate ahora; no investigues el codebase antes de crear el team.',
    'Después lanza los teammates con el Agent tool usando team_name y name.',
    'Si es posible, prioriza same-process o in-process para que los wakeups sean inmediatos.',
    'Haz que se hablen entre sí mientras trabajan, no solo al final.',
    'Abre al menos un thread compartido entre dos agentes apenas arranquen.',
    'Dame una confirmación corta cuando el swarm ya esté activo y listo para abrir /swarm.',
  ].join(' ')
}

const SWARM_HELP = [
  '/swarm abre la sala de control viva del swarm.',
  '/swarm create [team-name] [roles...] dispara el prompt correcto para crear un swarm activo.',
  'Antes de abrirlo, crea un team real en la sesión actual con un prompt natural.',
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
    onDone(SWARM_HELP, { display: 'system' })
    return null
  }

  if (normalizedArgs.startsWith('create')) {
    const parts = trimmedArgs.split(/\s+/).filter(Boolean)
    const teamName = parts[1] || 'demo-swarm'
    const roles = parts.slice(2)
    const prompt = buildSwarmCreatePrompt(teamName, roles)

    onDone(`Lanzando prompt para crear swarm ${teamName}.`, {
      display: 'system',
      nextInput: prompt,
      submitNextInput: true,
    })
    return null
  }

  return <SwarmDialog onDone={onDone} />
}
