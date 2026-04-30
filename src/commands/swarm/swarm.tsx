import React from 'react'
import { SwarmDialog } from '../../components/swarm/SwarmDialog.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

const SWARM_HELP = [
  '/swarm abre la sala de control viva del swarm.',
  'Antes de abrirlo, crea un team real en la sesión actual con un prompt natural.',
  'No uses /agents para levantar el swarm activo: /agents sirve para definir agentes, no para iniciar el team runtime.',
  'Ejemplo: crea un swarm llamado demo-swarm con planner, coder y qa; quiero que se coordinen entre ustedes y me den avances parciales.',
  'Vistas: agents, threads, waiting.',
  'Desde agents puedes escribirle a un teammate o abrir un thread entre dos teammates.',
  'Desde threads/waiting puedes inspeccionar la conversación y empujar al agente que está en espera.',
  'La coordinación en vivo funciona mejor con teammates same-process porque sus wakeups de mailbox son inmediatos.',
].join('\n')

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const normalizedArgs = args?.trim().toLowerCase() || ''

  if (normalizedArgs === 'help' || normalizedArgs === '?') {
    onDone(SWARM_HELP, { display: 'system' })
    return null
  }

  return <SwarmDialog onDone={onDone} />
}
