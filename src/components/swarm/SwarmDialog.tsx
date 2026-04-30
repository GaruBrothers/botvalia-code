import figures from 'figures'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useInterval } from 'usehooks-ts'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import { Box, Text, useInput } from '../../ink.js'
import { useAppState } from '../../state/AppState.js'
import { TEAM_LEAD_NAME } from '../../utils/swarm/constants.js'
import {
  buildSwarmThreadSummaries,
  buildSwarmWaitingEdges,
  readTeamConversationEvents,
} from '../../utils/swarm/teamConversationLog.js'
import {
  createTeamConversationEvent,
  getTeamConversationEventSummary,
  type TeamConversationEvent,
} from '../../utils/swarm/teamConversationEvents.js'
import { getTeammateStatuses, type TeammateStatus } from '../../utils/teamDiscovery.js'
import { getAgentName, getTeammateColor, isTeamLead } from '../../utils/teammate.js'
import { writeToMailbox } from '../../utils/teammateMailbox.js'
import { Dialog } from '../design-system/Dialog.js'
import TextInput from '../TextInput.js'

type SwarmView = 'agents' | 'threads' | 'waiting'

type SwarmMode =
  | { type: 'browse' }
  | { type: 'message'; recipient: string }
  | { type: 'pick-thread-peer'; first?: string }
  | { type: 'compose-thread'; first: string; second: string }
  | { type: 'thread-detail'; threadId: string }

type Props = {
  onDone: (
    result?: string,
    options?: { display?: 'skip' | 'system' | 'user' },
  ) => void
}

const REFRESH_MS = 900
const MAX_THREAD_EVENTS = 12

function truncateText(value: string, max: number): string {
  if (value.length <= max) {
    return value
  }

  return `${value.slice(0, Math.max(0, max - 1))}…`
}

function shortId(value: string): string {
  return value.slice(0, 8)
}

function deriveTopic(body: string, fallback: string): string {
  const firstLine = body
    .trim()
    .split(/\r?\n/)[0]
    ?.replace(/\s+/g, ' ')

  return truncateText(firstLine || fallback, 60)
}

function formatParticipants(participants: string[]): string {
  return participants.filter(Boolean).join(', ')
}

function getSenderName(): string {
  return getAgentName() || TEAM_LEAD_NAME
}

function getSelected<T>(items: T[], index: number): T | undefined {
  if (items.length === 0) {
    return undefined
  }

  return items[Math.max(0, Math.min(index, items.length - 1))]
}

export function SwarmDialog({ onDone }: Props): React.ReactNode {
  useRegisterOverlay('swarm-dialog')

  const teamContext = useAppState(state => state.teamContext)
  const teamName = teamContext?.teamName
  const canSteer = isTeamLead(teamContext)

  const [view, setView] = useState<SwarmView>('agents')
  const [mode, setMode] = useState<SwarmMode>({ type: 'browse' })
  const [selectedByView, setSelectedByView] = useState<Record<SwarmView, number>>({
    agents: 0,
    threads: 0,
    waiting: 0,
  })
  const [pickerIndex, setPickerIndex] = useState(0)
  const [statuses, setStatuses] = useState<TeammateStatus[]>([])
  const [events, setEvents] = useState<TeamConversationEvent[]>([])
  const [draft, setDraft] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    if (!teamName) {
      setStatuses([])
      setEvents([])
      return
    }

    setStatuses(getTeammateStatuses(teamName))
    const nextEvents = await readTeamConversationEvents(teamName)
    setEvents(nextEvents)
  }, [teamName])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useInterval(() => {
    void refresh()
  }, teamName ? REFRESH_MS : null)

  const threadSummaries = useMemo(
    () => buildSwarmThreadSummaries(events),
    [events],
  )
  const waitingEdges = useMemo(() => buildSwarmWaitingEdges(events), [events])

  useEffect(() => {
    setSelectedByView(previous => ({
      agents: Math.max(0, Math.min(previous.agents, statuses.length - 1)),
      threads: Math.max(0, Math.min(previous.threads, threadSummaries.length - 1)),
      waiting: Math.max(0, Math.min(previous.waiting, waitingEdges.length - 1)),
    }))
  }, [statuses.length, threadSummaries.length, waitingEdges.length])

  useEffect(() => {
    if (mode.type === 'pick-thread-peer') {
      setPickerIndex(previous => Math.max(0, Math.min(previous, statuses.length - 1)))
    }
  }, [mode.type, statuses.length])

  const selectedAgent = getSelected(statuses, selectedByView.agents)
  const selectedThread = getSelected(threadSummaries, selectedByView.threads)
  const selectedWaiting = getSelected(waitingEdges, selectedByView.waiting)

  const detailThreadId = mode.type === 'thread-detail' ? mode.threadId : undefined
  const detailEvents = useMemo(() => {
    if (!detailThreadId) {
      return []
    }

    return events
      .filter(event => event.thread_id === detailThreadId)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .slice(-MAX_THREAD_EVENTS)
  }, [detailThreadId, events])

  const detailSummary = useMemo(() => {
    if (!detailThreadId) {
      return undefined
    }

    return threadSummaries.find(thread => thread.threadId === detailThreadId)
  }, [detailThreadId, threadSummaries])

  const resetComposer = useCallback(() => {
    setDraft('')
    setCursorOffset(0)
    setError(undefined)
  }, [])

  const openDirectMessage = useCallback(
    (recipient: string | undefined) => {
      if (!recipient || !teamName) {
        return
      }

      resetComposer()
      setMode({ type: 'message', recipient })
    },
    [resetComposer, teamName],
  )

  const sendDirectMessage = useCallback(
    async (recipient: string, body: string) => {
      const trimmed = body.trim()
      if (!trimmed || !teamName) {
        setError('Escribe un mensaje antes de enviarlo.')
        return
      }

      const kind = trimmed.endsWith('?') ? 'question' : 'task'
      const event = createTeamConversationEvent({
        from: getSenderName(),
        to: recipient,
        kind,
        body: trimmed,
        topic: deriveTopic(trimmed, `Leader -> ${recipient}`),
        priority: kind === 'question' ? 'normal' : 'high',
        requires_response: true,
        metadata: {
          initiated_via: 'swarm-dialog',
        },
      })

      await writeToMailbox(
        recipient,
        {
          from: event.from,
          event,
          summary: getTeamConversationEventSummary(event),
          timestamp: new Date().toISOString(),
          color: getTeammateColor(),
        },
        teamName,
      )

      setNotice(`Mensaje enviado a @${recipient} en thread ${shortId(event.thread_id)}.`)
      setMode({ type: 'thread-detail', threadId: event.thread_id })
      resetComposer()
      await refresh()
    },
    [refresh, resetComposer, teamName],
  )

  const sendThreadKickoff = useCallback(
    async (first: string, second: string, body: string) => {
      const trimmed = body.trim()
      if (!trimmed || !teamName) {
        setError('Describe qué deben coordinar antes de abrir el thread.')
        return
      }

      const threadId = createTeamConversationEvent({
        from: getSenderName(),
        to: first,
        kind: 'task',
        body: '',
      }).thread_id
      const topic = deriveTopic(trimmed, `${first} + ${second}`)

      const firstEvent = createTeamConversationEvent({
        from: getSenderName(),
        to: first,
        kind: 'task',
        body: `Coordínate con @${second}. ${trimmed}`,
        topic,
        thread_id: threadId,
        priority: 'high',
        requires_response: true,
        metadata: {
          counterpart: second,
          initiated_via: 'swarm-dialog',
        },
      })

      const secondEvent = createTeamConversationEvent({
        from: getSenderName(),
        to: second,
        kind: 'handoff',
        body: `Coordínate con @${first}. ${trimmed}`,
        topic,
        thread_id: threadId,
        reply_to: firstEvent.event_id,
        priority: 'high',
        requires_response: true,
        metadata: {
          counterpart: first,
          initiated_via: 'swarm-dialog',
        },
      })

      for (const event of [firstEvent, secondEvent]) {
        await writeToMailbox(
          event.to,
          {
            from: event.from,
            event,
            summary: getTeamConversationEventSummary(event),
            timestamp: new Date().toISOString(),
            color: getTeammateColor(),
          },
          teamName,
        )
      }

      setNotice(
        `Thread ${shortId(threadId)} abierto entre @${first} y @${second}.`,
      )
      setView('threads')
      setMode({ type: 'thread-detail', threadId })
      resetComposer()
      await refresh()
    },
    [refresh, resetComposer, teamName],
  )

  useInput((input, key) => {
    if (mode.type === 'message' || mode.type === 'compose-thread') {
      if (key.escape) {
        setMode({ type: 'browse' })
        resetComposer()
      }
      return
    }

    if (mode.type === 'pick-thread-peer') {
      if (key.escape) {
        if (mode.first) {
          setMode({ type: 'pick-thread-peer' })
        } else {
          setMode({ type: 'browse' })
        }
        setError(undefined)
        return
      }

      if (key.upArrow) {
        setPickerIndex(previous => Math.max(0, previous - 1))
        return
      }

      if (key.downArrow) {
        setPickerIndex(previous =>
          Math.min(Math.max(0, statuses.length - 1), previous + 1),
        )
        return
      }

      if (key.return) {
        const candidate = getSelected(statuses, pickerIndex)
        if (!candidate) {
          return
        }

        if (!mode.first) {
          setMode({ type: 'pick-thread-peer', first: candidate.name })
          setNotice(undefined)
          setError(undefined)
          return
        }

        if (candidate.name === mode.first) {
          setError('Elige un segundo agente diferente.')
          return
        }

        resetComposer()
        setMode({
          type: 'compose-thread',
          first: mode.first,
          second: candidate.name,
        })
      }

      return
    }

    if (mode.type === 'thread-detail') {
      if (key.escape) {
        setMode({ type: 'browse' })
        return
      }

      if (input === 'm') {
        const waitingTarget = detailSummary?.waitingOn?.to
        if (waitingTarget) {
          openDirectMessage(waitingTarget)
        }
      }

      return
    }

    if (key.leftArrow) {
      setView(previous => {
        if (previous === 'agents') return 'waiting'
        if (previous === 'threads') return 'agents'
        return 'threads'
      })
      return
    }

    if (key.rightArrow) {
      setView(previous => {
        if (previous === 'agents') return 'threads'
        if (previous === 'threads') return 'waiting'
        return 'agents'
      })
      return
    }

    if (key.upArrow) {
      setSelectedByView(previous => ({
        ...previous,
        [view]: Math.max(0, previous[view] - 1),
      }))
      return
    }

    if (key.downArrow) {
      const maxIndex =
        view === 'agents'
          ? statuses.length - 1
          : view === 'threads'
            ? threadSummaries.length - 1
            : waitingEdges.length - 1

      setSelectedByView(previous => ({
        ...previous,
        [view]: Math.min(Math.max(0, maxIndex), previous[view] + 1),
      }))
      return
    }

    if (key.return) {
      if (view === 'agents') {
        if (!canSteer) {
          setNotice('Sólo el team lead puede dirigir el swarm desde aquí.')
          return
        }
        openDirectMessage(selectedAgent?.name)
        return
      }

      if (view === 'threads' && selectedThread) {
        setMode({ type: 'thread-detail', threadId: selectedThread.threadId })
        return
      }

      if (view === 'waiting' && selectedWaiting) {
        setMode({ type: 'thread-detail', threadId: selectedWaiting.threadId })
      }
      return
    }

    if (input === 'm') {
      if (!canSteer) {
        setNotice('Sólo el team lead puede mandar mensajes desde /swarm.')
        return
      }

      if (view === 'agents') {
        openDirectMessage(selectedAgent?.name)
        return
      }

      if (view === 'waiting') {
        openDirectMessage(selectedWaiting?.to)
        return
      }

      if (view === 'threads' && selectedThread?.waitingOn) {
        openDirectMessage(selectedThread.waitingOn.to)
      }
      return
    }

    if (input === 't' && view === 'agents') {
      if (!canSteer) {
        setNotice('Sólo el team lead puede abrir threads entre agentes.')
        return
      }

      if (statuses.length < 2) {
        setNotice('Necesitas al menos dos agentes activos para abrir un thread.')
        return
      }

      setPickerIndex(selectedByView.agents)
      setError(undefined)
      setMode({ type: 'pick-thread-peer' })
    }
  })

  const renderBrowseContent = (): React.ReactNode => {
    if (!teamName) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text>No hay un swarm activo en esta sesión.</Text>
          <Text dimColor>
            Pídele a BotValia que cree un team o un swarm, y luego vuelve a abrir
            /swarm.
          </Text>
        </Box>
      )
    }

    if (view === 'agents') {
      return (
        <Box flexDirection="column" gap={1}>
          {statuses.length === 0 ? (
            <Text dimColor>No hay teammates registrados todavía.</Text>
          ) : (
            statuses.map((status, index) => {
              const selected = index === selectedByView.agents
              const stateLabel = status.status === 'running' ? 'running' : 'idle'
              const modelSuffix = status.model
                ? ` · ${truncateText(status.model, 28)}`
                : ''

              return (
                <Text
                  key={status.agentId}
                  color={selected ? 'suggestion' : undefined}
                  dimColor={!selected && status.status === 'idle'}
                >
                  {selected ? `${figures.pointer} ` : '  '}
                  @{status.name} [{stateLabel}]
                  {modelSuffix}
                </Text>
              )
            })
          )}
        </Box>
      )
    }

    if (view === 'threads') {
      return (
        <Box flexDirection="column" gap={1}>
          {threadSummaries.length === 0 ? (
            <Text dimColor>Aún no hay threads registrados.</Text>
          ) : (
            threadSummaries.map((thread, index) => {
              const selected = index === selectedByView.threads
              const title =
                thread.topic || `thread ${shortId(thread.threadId)}`
              const stateLabel = thread.open
                ? `waiting on @${thread.waitingOn?.to}`
                : 'resolved'

              return (
                <Box key={thread.threadId} flexDirection="column">
                  <Text color={selected ? 'suggestion' : undefined}>
                    {selected ? `${figures.pointer} ` : '  '}
                    {truncateText(title, 58)}
                  </Text>
                  <Text dimColor>
                    {formatParticipants(thread.participants)} · {stateLabel}
                  </Text>
                </Box>
              )
            })
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {waitingEdges.length === 0 ? (
          <Text dimColor>No hay dependencias abiertas en este momento.</Text>
        ) : (
          waitingEdges.map((edge, index) => {
            const selected = index === selectedByView.waiting
            const title = edge.topic || truncateText(edge.body, 56)
            return (
              <Box key={edge.eventId} flexDirection="column">
                <Text color={selected ? 'suggestion' : undefined}>
                  {selected ? `${figures.pointer} ` : '  '}
                  @{edge.from} waiting on @{edge.to}
                </Text>
                <Text dimColor>{truncateText(title, 74)}</Text>
              </Box>
            )
          })
        )}
      </Box>
    )
  }

  const renderPickerContent = (): React.ReactNode => {
    const current = getSelected(statuses, pickerIndex)

    return (
      <Box flexDirection="column" gap={1}>
        <Text>
          {!mode.first
            ? 'Elige el primer agente del thread'
            : `Ahora elige con quién debe coordinarse @${mode.first}`}
        </Text>
        {statuses.map((status, index) => {
          const selected = index === pickerIndex
          const disabled = mode.first === status.name

          return (
            <Text
              key={status.agentId}
              color={selected ? 'suggestion' : undefined}
              dimColor={disabled}
            >
              {selected ? `${figures.pointer} ` : '  '}
              @{status.name}
              {disabled ? ' (ya elegido)' : ''}
            </Text>
          )
        })}
        {current && (
          <Text dimColor>
            Enter para seleccionar @{current.name}
            {mode.first ? ` como segundo participante` : ' como origen del thread'}
          </Text>
        )}
      </Box>
    )
  }

  const renderThreadDetail = (): React.ReactNode => {
    if (!detailSummary) {
      return <Text dimColor>El thread seleccionado ya no tiene eventos.</Text>
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text>
          {detailSummary.topic || `thread ${shortId(detailSummary.threadId)}`}
        </Text>
        <Text dimColor>
          Participantes: {formatParticipants(detailSummary.participants)}
        </Text>
        {detailSummary.waitingOn ? (
          <Text dimColor>
            Waiting: @{detailSummary.waitingOn.from} -> @{detailSummary.waitingOn.to}
          </Text>
        ) : (
          <Text dimColor>Estado: resuelto</Text>
        )}
        <Box flexDirection="column" gap={1}>
          {detailEvents.length === 0 ? (
            <Text dimColor>Sin eventos visibles aún.</Text>
          ) : (
            detailEvents.map(event => (
              <Box key={event.event_id} flexDirection="column">
                <Text>
                  {event.kind} · @{event.from} -> @{event.to}
                  {event.topic ? ` · ${truncateText(event.topic, 36)}` : ''}
                </Text>
                <Text dimColor>{truncateText(event.body, 140)}</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>
    )
  }

  const renderComposer = (): React.ReactNode => {
    if (mode.type === 'message') {
      return (
        <Box flexDirection="column" gap={1}>
          <Text>Mensaje directo para @{mode.recipient}</Text>
          <Text dimColor>
            Se enviará como team_event y abrirá un thread si hace falta.
          </Text>
          <TextInput
            value={draft}
            onChange={setDraft}
            onSubmit={value => void sendDirectMessage(mode.recipient, value)}
            placeholder='Ej.: revisa el bug de auth y pregunta a QA si falta un edge case'
            columns={90}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            focus
            showCursor
          />
        </Box>
      )
    }

    if (mode.type === 'compose-thread') {
      return (
        <Box flexDirection="column" gap={1}>
          <Text>
            Abriendo thread entre @{mode.first} y @{mode.second}
          </Text>
          <Text dimColor>
            Describe qué deben coordinar. BotValia abrirá el mismo thread para
            ambos y podrán hablarse en vivo mientras trabajan.
          </Text>
          <TextInput
            value={draft}
            onChange={setDraft}
            onSubmit={value => void sendThreadKickoff(mode.first, mode.second, value)}
            placeholder='Ej.: frontend y QA deben validar el flujo de login y acordar edge cases antes del fix final'
            columns={90}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            focus
            showCursor
          />
        </Box>
      )
    }

    return null
  }

  const title =
    mode.type === 'thread-detail'
      ? 'Swarm Thread'
      : mode.type === 'message'
        ? 'Swarm Message'
        : mode.type === 'compose-thread'
          ? 'Open Swarm Thread'
          : mode.type === 'pick-thread-peer'
            ? 'Pick Swarm Teammates'
            : 'Swarm Control'

  const subtitle = teamName
    ? `${teamName} · ${canSteer ? 'team lead' : 'read-only teammate'}`
    : 'No active swarm'

  return (
    <Dialog
      title={title}
      subtitle={subtitle}
      onCancel={() => onDone()}
      color="background"
      isCancelActive={mode.type === 'browse'}
      inputGuide={() => {
        if (mode.type === 'message' || mode.type === 'compose-thread') {
          return 'Enter enviar · Esc volver'
        }

        if (mode.type === 'pick-thread-peer') {
          return '↑↓ elegir · Enter confirmar · Esc volver'
        }

        if (mode.type === 'thread-detail') {
          return 'm escribir al agente en espera · Esc volver'
        }

        return '←→ cambiar vista · ↑↓ elegir · Enter abrir · m mensaje · t abrir thread · Esc cerrar'
      }}
    >
      <Box flexDirection="column" gap={1}>
        {notice ? <Text color="success">{notice}</Text> : null}
        {error ? <Text color="error">{error}</Text> : null}

        {mode.type === 'browse' ? (
          <Text dimColor>
            {view === 'agents' ? 'AGENTS' : 'agents'} ·{' '}
            {view === 'threads' ? 'THREADS' : 'threads'} ·{' '}
            {view === 'waiting' ? 'WAITING' : 'waiting'}
          </Text>
        ) : null}

        {mode.type === 'browse'
          ? renderBrowseContent()
          : mode.type === 'pick-thread-peer'
            ? renderPickerContent()
            : mode.type === 'thread-detail'
              ? renderThreadDetail()
              : renderComposer()}
      </Box>
    </Dialog>
  )
}
