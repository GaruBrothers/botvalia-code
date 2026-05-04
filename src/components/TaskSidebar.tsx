import * as React from 'react'
import figures from 'figures'
import { basename } from 'path'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { Box, Text } from '../ink.js'
import type { StreamingThinking, StreamingToolUse } from '../utils/messages.js'
import type { Task } from '../utils/tasks.js'
import { truncateToWidth } from '../utils/format.js'

type TeamContextSummary = {
  teamName: string
  selfAgentName?: string
  isLeader?: boolean
  teammates: Record<
    string,
    {
      name: string
    }
  >
}

type Props = {
  tasks: Task[]
  side?: 'left' | 'right'
  isLoading?: boolean
  streamingThinking?: StreamingThinking | null
  streamingToolUses?: StreamingToolUse[]
  teamContext?: TeamContextSummary
  currentModel?: string
  cwd?: string
  streamMode?: string
  spinnerMessage?: string | null
  quietMode?: boolean
  transcriptShortcut?: string
  tasksShortcut?: string
  noiseShortcut?: string
}

function byPriority(left: Task, right: Task): number {
  const statusRank = (status: Task['status']) => {
    switch (status) {
      case 'in_progress':
        return 0
      case 'pending':
        return 1
      case 'completed':
        return 2
    }
  }

  const leftRank = statusRank(left.status)
  const rightRank = statusRank(right.status)
  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  const leftId = Number.parseInt(left.id, 10)
  const rightId = Number.parseInt(right.id, 10)
  if (!Number.isNaN(leftId) && !Number.isNaN(rightId)) {
    return leftId - rightId
  }

  return left.id.localeCompare(right.id)
}

function getStatusTone(status: Task['status']): {
  marker: string
  color: string | undefined
  label: string
} {
  switch (status) {
    case 'in_progress':
      return {
        marker: figures.pointer,
        color: 'professionalBlue',
        label: 'active',
      }
    case 'completed':
      return {
        marker: figures.tick,
        color: 'success',
        label: 'done',
      }
    case 'pending':
      return {
        marker: figures.squareSmall,
        color: 'subtle',
        label: 'queued',
      }
  }
}

function compactText(value: string, maxWidth: number): string {
  return truncateToWidth(value.replace(/\s+/g, ' ').trim(), maxWidth)
}

function sanitizeThinkingPreview(value: string): string {
  return value
    .replace(/powered by Anthropic'?s Claude/gi, 'running in BotValia auto mode')
    .replace(/powered by Claude/gi, 'running in BotValia auto mode')
    .replace(/arquitectura de Claude de Anthropic/gi, 'routing actual de BotValia')
    .replace(/Claude de Anthropic/gi, 'runtime de BotValia')
    .replace(/Anthropic'?s Claude/gi, 'runtime de BotValia')
    .replace(/claude\.ai/gi, 'BotValia Web')
    .replace(/\bAnthropic\b/gi, 'BotValia')
    .replace(/\bClaude\b/gi, 'BotValia')
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]))
}

function formatStreamMode(
  isLoading: boolean,
  streamMode: string | undefined,
  spinnerMessage: string | null | undefined,
): string {
  if (!isLoading) {
    return 'idle'
  }
  if (spinnerMessage?.trim()) {
    return spinnerMessage
  }
  switch (streamMode) {
    case 'thinking':
      return 'thinking'
    case 'tool_use':
      return 'running tools'
    case 'responding':
      return 'responding'
    default:
      return 'working'
  }
}

function Section({
  title,
  badge,
  children,
  muted = false,
}: {
  title: string
  badge?: string
  children: React.ReactNode
  muted?: boolean
}): React.ReactNode {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box justifyContent="space-between">
        <Text bold color={muted ? 'subtle' : undefined}>
          {title}
        </Text>
        {badge ? <Text dimColor>{badge}</Text> : null}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

function KeyValueRow({
  label,
  value,
  width,
}: {
  label: string
  value: string
  width: number
}): React.ReactNode {
  return (
    <Box>
      <Text dimColor>{label}</Text>
      <Text> </Text>
      <Text>{compactText(value, width)}</Text>
    </Box>
  )
}

export function TaskSidebar({
  tasks,
  side = 'right',
  isLoading = false,
  streamingThinking = null,
  streamingToolUses = [],
  teamContext,
  currentModel,
  cwd,
  streamMode,
  spinnerMessage,
  quietMode = false,
  transcriptShortcut,
  tasksShortcut,
  noiseShortcut,
}: Props): React.ReactNode {
  const { columns, rows } = useTerminalSize()
  const width = Math.max(36, Math.min(52, Math.floor(columns * 0.28)))
  const ordered = [...tasks].sort(byPriority)
  const maxVisibleTasks = quietMode
    ? Math.max(3, Math.min(5, rows - 30))
    : Math.max(4, Math.min(7, rows - 26))
  const visibleTasks = ordered.slice(0, maxVisibleTasks)
  const overflowCount = Math.max(0, ordered.length - visibleTasks.length)
  const activeCount = tasks.filter(task => task.status === 'in_progress').length
  const queuedCount = tasks.filter(task => task.status === 'pending').length
  const doneCount = tasks.filter(task => task.status === 'completed').length
  const headerColor =
    isLoading || activeCount > 0 || streamingToolUses.length > 0
      ? 'professionalBlue'
      : 'subtle'
  const sideSpacing = side === 'right' ? { paddingLeft: 1 } : { paddingRight: 1 }
  const contentWidth = Math.max(18, width - 8)
  const toolPreviewWidth = Math.max(16, width - 14)
  const contextValueWidth = Math.max(18, width - 14)
  const presetLabel = quietMode ? 'focus' : 'ops'
  const projectLabel = cwd ? basename(cwd) : undefined
  const railSummary = formatStreamMode(isLoading, streamMode, spinnerMessage)

  const thinkingPreview =
    isLoading && streamingThinking?.thinking?.trim()
      ? compactText(sanitizeThinkingPreview(streamingThinking.thinking), contentWidth)
      : null

  const visibleTools = streamingToolUses.slice(0, quietMode ? 3 : 4).map(toolUse => ({
    name: toolUse.contentBlock.name,
    input:
      compactText(toolUse.unparsedToolInput || 'waiting for input…', toolPreviewWidth),
  }))

  const knownAgents = unique([
    teamContext?.selfAgentName,
    ...Object.values(teamContext?.teammates ?? {}).map(teammate => teammate.name),
    ...tasks.map(task => task.owner),
  ])
  const activeAgents = new Set(
    unique([
      ...tasks
        .filter(task => task.status === 'in_progress')
        .map(task => task.owner),
      isLoading ? teamContext?.selfAgentName : undefined,
    ]),
  )

  return (
    <Box
      width={width}
      flexShrink={0}
      flexDirection="column"
      {...sideSpacing}
      paddingBottom={1}
      overflow="hidden"
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={headerColor}
        paddingX={2}
        paddingY={1}
        overflow="hidden"
      >
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={headerColor}>
            Shell rail
          </Text>
          <Text dimColor>{presetLabel}</Text>
        </Box>

        <Text dimColor>{compactText(railSummary, contentWidth)}</Text>

        <Section
          title="Tasks"
          badge={`${activeCount}/${queuedCount}/${doneCount}`}
          muted={tasks.length === 0}
        >
          {tasks.length === 0 ? (
            <Text dimColor>No active task plan</Text>
          ) : (
            <>
              {visibleTasks.map((task, index) => {
                const tone = getStatusTone(task.status)
                const owner = task.owner ? ` @${task.owner}` : ''
                const label = compactText(
                  task.subject || task.description || `Task ${task.id}`,
                  Math.max(14, width - 14),
                )

                return (
                  <Box
                    key={task.id}
                    flexDirection="column"
                    marginBottom={index === visibleTasks.length - 1 ? 0 : 1}
                  >
                    <Box>
                      <Text color="subtle">{String(index + 1).padStart(2, '0')}.</Text>
                      <Text> </Text>
                      <Text color={tone.color}>{tone.marker}</Text>
                      <Text> </Text>
                      <Text
                        bold={task.status === 'in_progress'}
                        strikethrough={task.status === 'completed'}
                        dimColor={task.status === 'completed'}
                      >
                        {label}
                      </Text>
                    </Box>
                    <Box paddingLeft={5}>
                      <Text dimColor>
                        {tone.label}
                        {owner}
                        {task.blockedBy.length > 0
                          ? ` · blocked by ${task.blockedBy.map(id => `#${id}`).join(', ')}`
                          : ''}
                      </Text>
                    </Box>
                  </Box>
                )
              })}
              {overflowCount > 0 ? (
                <Text dimColor>… {overflowCount} more in the backlog</Text>
              ) : null}
            </>
          )}
        </Section>

        <Section
          title="Thinking"
          badge={isLoading && streamingThinking?.isStreaming ? 'live' : undefined}
          muted={!thinkingPreview && !isLoading}
        >
          {thinkingPreview ? (
            <Text color={quietMode ? 'subtle' : undefined}>{thinkingPreview}</Text>
          ) : isLoading ? (
            <Text dimColor>{compactText(railSummary, contentWidth)}</Text>
          ) : (
            <Text dimColor>No active reasoning stream</Text>
          )}
        </Section>

        <Section
          title="Tools"
          badge={streamingToolUses.length > 0 ? `${streamingToolUses.length}` : undefined}
          muted={visibleTools.length === 0}
        >
          {visibleTools.length === 0 ? (
            <Text dimColor>
              {isLoading ? 'Waiting for the next tool call' : 'No live tool calls'}
            </Text>
          ) : (
            visibleTools.map(toolUse => (
              <Box key={`${toolUse.name}:${toolUse.input}`} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color="professionalBlue">{figures.pointerSmall}</Text>
                  <Text> </Text>
                  <Text bold>{compactText(toolUse.name, contentWidth)}</Text>
                </Box>
                <Box paddingLeft={4}>
                  <Text dimColor>{toolUse.input}</Text>
                </Box>
              </Box>
            ))
          )}
        </Section>

        <Section
          title="Agents"
          badge={teamContext ? teamContext.teamName : `${knownAgents.length}`}
          muted={knownAgents.length === 0}
        >
          {knownAgents.length === 0 ? (
            <Text dimColor>Solo run</Text>
          ) : (
            <>
              {knownAgents.slice(0, quietMode ? 4 : 6).map(agentName => (
                <Box key={agentName}>
                  <Text color={activeAgents.has(agentName) ? 'success' : 'subtle'}>
                    {activeAgents.has(agentName) ? figures.circleFilled : figures.circle}
                  </Text>
                  <Text> </Text>
                  <Text dimColor={!activeAgents.has(agentName)}>
                    {compactText(agentName, contentWidth)}
                  </Text>
                </Box>
              ))}
              {teamContext?.isLeader ? (
                <Text dimColor>Leader session · {Object.keys(teamContext.teammates).length} teammates</Text>
              ) : null}
            </>
          )}
        </Section>

        <Section title="Context">
          <KeyValueRow label="Mode" value={quietMode ? 'quiet shell' : 'live shell'} width={contextValueWidth} />
          <KeyValueRow label="State" value={railSummary} width={contextValueWidth} />
          {currentModel ? (
            <KeyValueRow
              label="Model"
              value={currentModel}
              width={contextValueWidth}
            />
          ) : null}
          {projectLabel ? (
            <KeyValueRow
              label="Root"
              value={projectLabel}
              width={contextValueWidth}
            />
          ) : null}
          <Text dimColor>
            {[
              tasksShortcut ? `${tasksShortcut} tasks` : null,
              transcriptShortcut ? `${transcriptShortcut} transcript` : null,
              noiseShortcut
                ? `${noiseShortcut} ${quietMode ? 'show chatter' : 'quiet mode'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Section>
      </Box>
    </Box>
  )
}
