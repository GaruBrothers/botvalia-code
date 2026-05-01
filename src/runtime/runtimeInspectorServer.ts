import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { errorMessage } from '../utils/errors.js'
import {
  ensureRuntimeServer,
  getRuntimeServerStatus,
  type RuntimeServerStatus,
} from './runtimeServerManager.js'

export type RuntimeInspectorServerConfig = {
  host?: string
  port?: number
}

export type RunningRuntimeInspectorServer = {
  host: string
  port: number
  url: string
  stop: () => Promise<void>
}

export type RuntimeInspectorStatus =
  | { status: 'stopped' }
  | { status: 'starting' }
  | { status: 'running'; server: RunningRuntimeInspectorServer }
  | { status: 'failed'; error: Error }

let activeInspectorServer: RunningRuntimeInspectorServer | undefined
let inspectorServerStartPromise:
  | Promise<RunningRuntimeInspectorServer>
  | undefined
let lastInspectorServerError: Error | undefined

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error))
}

function getRuntimeStatusPayload(status: RuntimeServerStatus) {
  if (status.status === 'running') {
    return {
      status: status.status,
      url: status.server.url,
      host: status.server.host,
      port: status.server.port,
    }
  }

  if (status.status === 'failed') {
    return {
      status: status.status,
      error: status.error.message,
    }
  }

  return {
    status: status.status,
  }
}

function renderInspectorHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BotValia Runtime Inspector</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --panel: rgba(11, 23, 41, 0.92);
        --panel-2: rgba(17, 31, 52, 0.92);
        --border: rgba(120, 180, 255, 0.16);
        --text: #eaf3ff;
        --muted: #8ca6c7;
        --cyan: #37d7ff;
        --blue: #53a8ff;
        --violet: #8a6dff;
        --green: #39d98a;
        --amber: #f6c453;
        --red: #ff7a90;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(83, 168, 255, 0.18), transparent 24%),
          radial-gradient(circle at top right, rgba(138, 109, 255, 0.18), transparent 22%),
          linear-gradient(180deg, #030813 0%, #07111f 100%);
        color: var(--text);
      }
      .shell {
        max-width: 1600px;
        margin: 0 auto;
        padding: 24px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .title {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .logo {
        width: 16px;
        height: 52px;
        border-radius: 999px;
        background: linear-gradient(180deg, #eafcff 0%, var(--cyan) 20%, var(--blue) 54%, var(--violet) 100%);
        box-shadow: 0 0 24px rgba(83, 168, 255, 0.25);
        transform: skew(-18deg);
      }
      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1;
        letter-spacing: -0.03em;
      }
      .subtitle {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
      }
      .toolbar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      .toggle input {
        accent-color: var(--cyan);
      }
      button {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: rgba(18, 34, 55, 0.9);
        color: var(--text);
        padding: 10px 14px;
        cursor: pointer;
        font: inherit;
      }
      button:hover {
        border-color: rgba(83, 168, 255, 0.35);
        background: rgba(25, 43, 67, 0.95);
      }
      .grid {
        display: grid;
        grid-template-columns: 320px minmax(360px, 1fr) minmax(360px, 1fr);
        gap: 16px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        min-height: 520px;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
      }
      .panel h2 {
        margin: 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }
      .panel-head {
        padding: 16px 18px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .panel-body {
        padding: 16px 18px;
        overflow: auto;
        flex: 1;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .statusline {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .badge {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border);
        font-size: 12px;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--muted);
      }
      .dot.running { background: var(--green); }
      .dot.connecting { background: var(--amber); }
      .dot.error { background: var(--red); }
      .muted { color: var(--muted); }
      .sessions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .session-item {
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.02);
        border-radius: 14px;
        padding: 14px;
        cursor: pointer;
      }
      .session-item.active {
        border-color: rgba(83, 168, 255, 0.45);
        box-shadow: inset 0 0 0 1px rgba(83, 168, 255, 0.15);
      }
      .session-title {
        font-weight: 600;
        font-size: 13px;
      }
      .session-meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      pre {
        margin: 0;
        padding: 14px;
        border-radius: 14px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        color: var(--text);
        overflow: auto;
        font-size: 12px;
        line-height: 1.5;
      }
      textarea {
        width: 100%;
        min-height: 120px;
        resize: vertical;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--panel-2);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }
      textarea:focus {
        outline: none;
        border-color: rgba(83, 168, 255, 0.45);
        box-shadow: 0 0 0 1px rgba(83, 168, 255, 0.18);
      }
      .composer {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.02);
        padding: 14px;
      }
      .composer-head {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 10px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
      }
      .composer-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .button-primary {
        background: linear-gradient(135deg, rgba(55, 215, 255, 0.22), rgba(83, 168, 255, 0.22));
        border-color: rgba(83, 168, 255, 0.45);
      }
      .button-danger {
        border-color: rgba(255, 122, 144, 0.28);
        background: rgba(255, 122, 144, 0.08);
      }
      .button-danger:hover {
        border-color: rgba(255, 122, 144, 0.45);
        background: rgba(255, 122, 144, 0.12);
      }
      .status-note {
        margin-top: 10px;
        font-size: 12px;
        line-height: 1.5;
      }
      .status-note.error {
        color: var(--red);
      }
      .summary-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .chat-feed {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .chat-message {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.02);
      }
      .chat-message.user {
        background: rgba(55, 215, 255, 0.08);
        border-color: rgba(55, 215, 255, 0.18);
      }
      .chat-message.assistant {
        background: rgba(83, 168, 255, 0.08);
        border-color: rgba(83, 168, 255, 0.18);
      }
      .chat-message.system,
      .chat-message.progress,
      .chat-message.attachment {
        background: rgba(255, 255, 255, 0.03);
      }
      .chat-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .chat-body {
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .chip {
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(83, 168, 255, 0.08);
        color: var(--text);
        padding: 8px 12px;
        font-size: 12px;
      }
      .summary-card {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.02);
      }
      .summary-title {
        font-size: 12px;
        color: var(--text);
        font-weight: 600;
      }
      .summary-meta {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .events {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .event-item {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.02);
      }
      .event-kind {
        font-size: 11px;
        color: var(--cyan);
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .event-meta {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
      }
      .event-body {
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      @media (max-width: 1180px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <div class="title">
            <div class="logo"></div>
            <div>
              <h1>BotValia Runtime Inspector</h1>
              <div class="subtitle">Cliente visual mínimo para sesiones, eventos y swarm sobre el mismo motor local.</div>
            </div>
          </div>
        </div>
        <div class="toolbar">
          <label class="toggle"><input id="autoRefresh" type="checkbox" checked /> Auto refresh</label>
          <button id="reconnect">Reconectar</button>
          <button id="refreshSessions">Refrescar sesiones</button>
          <button id="refreshSelected">Refrescar sesión</button>
        </div>
      </div>

      <div class="statusline">
        <div class="badge"><span id="runtimeDot" class="dot connecting"></span><span id="runtimeStatus">Cargando bridge runtime...</span></div>
        <div class="badge"><span id="socketDot" class="dot connecting"></span><span id="socketStatus">Conectando WebSocket...</span></div>
        <div class="badge"><span id="runtimeUrl">URL runtime: --</span></div>
      </div>

      <div class="grid">
        <section class="panel">
          <div class="panel-head">
            <h2>Sesiones</h2>
            <span id="sessionCount" class="muted">0 activas</span>
          </div>
          <div class="panel-body">
            <div id="sessions" class="sessions"></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Snapshot</h2>
            <span id="selectedSessionLabel" class="muted">Ninguna sesión seleccionada</span>
          </div>
          <div class="panel-body">
            <div class="stack">
              <pre id="snapshot">{}</pre>

              <div class="composer">
                <div class="composer-head">Control de sesión</div>
                <label class="field">
                  <span>Prompt para la sesión seleccionada</span>
                  <textarea id="promptInput" placeholder="Escribe aquí un prompt para enviarlo al motor en vivo."></textarea>
                </label>
                <div class="composer-actions">
                  <button id="sendPrompt" class="button-primary">Enviar prompt</button>
                  <button id="interruptSession" class="button-danger">Interrumpir sesión</button>
                </div>
                <div id="actionStatus" class="status-note muted">Selecciona una sesión activa para empezar a controlarla.</div>
              </div>

              <div class="composer">
                <div class="composer-head">Salida reciente</div>
                <pre id="activityLog">Sin actividad reciente para la sesión seleccionada.</pre>
              </div>

              <div class="composer">
                <div class="composer-head">Conversación reciente</div>
                <div id="conversation" class="chat-feed">
                  <div class="muted">Sin mensajes recientes todavía.</div>
                </div>
              </div>

              <div class="composer">
                <div class="composer-head">Swarm y tasks</div>
                <div id="taskSummary" class="summary-list">
                  <div class="muted">Sin datos de swarm o tasks todavía.</div>
                </div>
              </div>

              <div class="composer">
                <div class="composer-head">Threads y waiting</div>
                <div id="swarmThreads" class="summary-list">
                  <div class="muted">Sin threads de swarm todavía.</div>
                </div>
              </div>

              <div class="composer">
                <div class="composer-head">Acciones de swarm</div>
                <div id="swarmControls" class="summary-list">
                  <div class="muted">Selecciona una sesión para ver acciones del swarm.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Eventos</h2>
            <span id="eventCount" class="muted">0 recientes</span>
          </div>
          <div class="panel-body">
            <div id="events" class="events"></div>
          </div>
        </section>
      </div>
    </div>

    <script>
      const state = {
        runtimeUrl: '',
        socket: null,
        connected: false,
        pending: new Map(),
        runtimeSubscriptionId: null,
        sessionSubscriptionId: null,
        sessions: [],
        selectedSessionId: null,
        selectedSnapshot: null,
        selectedDetail: null,
        events: [],
        sessionActivity: new Map(),
        autoRefresh: true,
        autoRefreshTimer: null,
      }

      const els = {
        runtimeDot: document.getElementById('runtimeDot'),
        runtimeStatus: document.getElementById('runtimeStatus'),
        socketDot: document.getElementById('socketDot'),
        socketStatus: document.getElementById('socketStatus'),
        runtimeUrl: document.getElementById('runtimeUrl'),
        autoRefresh: document.getElementById('autoRefresh'),
        sessions: document.getElementById('sessions'),
        sessionCount: document.getElementById('sessionCount'),
        selectedSessionLabel: document.getElementById('selectedSessionLabel'),
        snapshot: document.getElementById('snapshot'),
        promptInput: document.getElementById('promptInput'),
        sendPrompt: document.getElementById('sendPrompt'),
        interruptSession: document.getElementById('interruptSession'),
        actionStatus: document.getElementById('actionStatus'),
        activityLog: document.getElementById('activityLog'),
        conversation: document.getElementById('conversation'),
        taskSummary: document.getElementById('taskSummary'),
        swarmThreads: document.getElementById('swarmThreads'),
        swarmControls: document.getElementById('swarmControls'),
        events: document.getElementById('events'),
        eventCount: document.getElementById('eventCount'),
        reconnect: document.getElementById('reconnect'),
        refreshSessions: document.getElementById('refreshSessions'),
        refreshSelected: document.getElementById('refreshSelected'),
      }

      function setBadge(target, tone) {
        target.className = 'dot ' + tone
      }

      function addEvent(kind, meta, body) {
        state.events.unshift({
          id: crypto.randomUUID(),
          kind,
          meta,
          body,
        })
        state.events = state.events.slice(0, 30)
        renderEvents()
      }

      function summarizeContentBlock(block) {
        if (typeof block === 'string') {
          return block
        }

        if (!block || typeof block !== 'object') {
          return ''
        }

        if (typeof block.text === 'string') {
          return block.text
        }

        if (typeof block.type === 'string') {
          if (block.type === 'thinking') {
            return '[thinking]'
          }

          return '[' + block.type + ']'
        }

        return ''
      }

      function extractMessageText(message) {
        if (!message || typeof message !== 'object') {
          return ''
        }

        const content = message.message?.content ?? message.content
        if (typeof content === 'string') {
          return content
        }

        if (Array.isArray(content)) {
          return content
            .map(summarizeContentBlock)
            .filter(Boolean)
            .join('\n')
            .trim()
        }

        return ''
      }

      function ensureSessionActivity(sessionId) {
        if (!state.sessionActivity.has(sessionId)) {
          state.sessionActivity.set(sessionId, {
            delta: '',
            completed: [],
            notes: [],
          })
        }

        return state.sessionActivity.get(sessionId)
      }

      function trimActivity(activity) {
        activity.delta = activity.delta.slice(-4000)
        activity.completed = activity.completed.slice(-4)
        activity.notes = activity.notes.slice(-8)
      }

      function updateSessionActivity(sessionId, event) {
        const activity = ensureSessionActivity(sessionId)

        if (event.type === 'message_delta') {
          activity.delta += event.delta
        } else if (event.type === 'message_completed') {
          const text = extractMessageText(event.message)
          activity.completed.push(text || '[mensaje sin texto renderizable]')
          activity.delta = ''
        } else if (event.type === 'model_switched') {
          activity.notes.push('Modelo activo: ' + event.model + (event.reason ? ' · ' + event.reason : ''))
        } else if (event.type === 'interrupted') {
          activity.notes.push('La sesión fue interrumpida.')
        } else if (event.type === 'error') {
          activity.notes.push('Error: ' + event.error)
        } else if (event.type === 'task_updated') {
          activity.notes.push('Task ' + event.task.id + ' → ' + event.task.status)
        } else if (event.type === 'swarm_updated') {
          const names = event.swarm?.teammateNames?.join(', ') || 'sin teammates'
          activity.notes.push('Swarm: ' + names)
        }

        trimActivity(activity)

        if (sessionId === state.selectedSessionId) {
          renderActivity()
        }
      }

      function renderSessions() {
        els.sessionCount.textContent = state.sessions.length + ' activas'
        if (!state.sessions.length) {
          els.sessions.innerHTML = '<div class="muted">No hay sesiones activas todavía.</div>'
          return
        }

        els.sessions.innerHTML = state.sessions.map(session => {
          const active = session.sessionId === state.selectedSessionId ? ' active' : ''
          const swarmLabel = session.swarm?.teamName ? ' · ' + session.swarm.teamName : ''
          const modelLabel = session.mainLoopModelForSession || session.mainLoopModel || 'sin modelo'
          return '<button class="session-item' + active + '" data-session-id="' + session.sessionId + '">' +
            '<div class="session-title">' + escapeHtml(session.sessionId.slice(0, 8)) + swarmLabel + '</div>' +
            '<div class="session-meta">Estado: ' + escapeHtml(session.status) + '<br/>Modelo: ' + escapeHtml(String(modelLabel)) + '<br/>Mensajes: ' + session.messageCount + ' · Tasks: ' + session.taskCount + '</div>' +
          '</button>'
        }).join('')

        for (const button of els.sessions.querySelectorAll('[data-session-id]')) {
          button.addEventListener('click', () => selectSession(button.getAttribute('data-session-id')))
        }
      }

      function renderSnapshot() {
        els.selectedSessionLabel.textContent = state.selectedSessionId
          ? state.selectedSessionId
          : 'Ninguna sesión seleccionada'
        els.snapshot.textContent = JSON.stringify(state.selectedSnapshot ?? {}, null, 2)
        renderActionState()
        renderConversation()
        renderTaskSummary()
        renderSwarmThreads()
        renderSwarmControls()
      }

      function renderActionState(message, tone = 'muted') {
        const hasSession = Boolean(state.selectedSessionId)
        els.sendPrompt.disabled = !hasSession
        els.interruptSession.disabled = !hasSession
        els.promptInput.disabled = !hasSession

        if (message) {
          els.actionStatus.textContent = message
          els.actionStatus.className = 'status-note ' + tone
          return
        }

        if (!hasSession) {
          els.actionStatus.textContent = 'Selecciona una sesión activa para empezar a controlarla.'
          els.actionStatus.className = 'status-note muted'
          return
        }

        const snapshot = state.selectedSnapshot
        const status = snapshot?.status ?? 'desconocido'
        els.actionStatus.textContent = 'Sesión seleccionada lista. Estado actual: ' + status + '.'
        els.actionStatus.className = 'status-note muted'
      }

      function renderActivity() {
        if (!state.selectedSessionId) {
          els.activityLog.textContent = 'Sin actividad reciente para la sesión seleccionada.'
          return
        }

        const activity = state.sessionActivity.get(state.selectedSessionId)
        if (!activity) {
          els.activityLog.textContent = 'Aún no llegaron eventos útiles para esta sesión.'
          return
        }

        const blocks = []
        if (activity.delta) {
          blocks.push('Streaming actual:\n' + activity.delta)
        }
        if (activity.completed.length) {
          blocks.push('Mensajes completados:\n' + activity.completed.join('\n\n---\n\n'))
        }
        if (activity.notes.length) {
          blocks.push('Notas:\n- ' + activity.notes.join('\n- '))
        }

        els.activityLog.textContent = blocks.length
          ? blocks.join('\n\n====\n\n')
          : 'Aún no llegaron eventos útiles para esta sesión.'
      }

      function renderConversation() {
        const detail = state.selectedDetail
        if (!detail || !detail.messages.length) {
          els.conversation.innerHTML = '<div class="muted">Sin mensajes recientes todavía.</div>'
          return
        }

        els.conversation.innerHTML = detail.messages.slice().reverse().map(message => {
          const meta = [
            message.timestamp,
            message.isMeta ? 'meta' : null,
          ].filter(Boolean).join(' · ')

          return '<div class="chat-message ' + escapeHtml(message.type) + '">' +
            '<div class="chat-head"><span>' + escapeHtml(message.label) + '</span><span>' + escapeHtml(meta) + '</span></div>' +
            '<div class="chat-body">' + escapeHtml(message.text || '[sin texto renderizable]') + '</div>' +
          '</div>'
        }).join('')
      }

      function renderTaskSummary() {
        const detail = state.selectedDetail
        const snapshot = detail?.snapshot || state.selectedSnapshot
        const tasks = detail?.tasks || []
        const swarm = snapshot?.swarm
        const blocks = []

        if (swarm) {
          const swarmText = [
            swarm.teamName ? 'Team: ' + swarm.teamName : 'Sin team activo',
            'Líder: ' + (swarm.isLeader ? 'sí' : 'no'),
            'Teammates: ' + ((swarm.teammateNames && swarm.teammateNames.length)
              ? swarm.teammateNames.join(', ')
              : 'ninguno'),
          ].join('\n')

          blocks.push(
            '<div class="summary-card">' +
              '<div class="summary-title">Swarm</div>' +
              '<div class="summary-meta">' + escapeHtml(swarmText) + '</div>' +
            '</div>'
          )
        }

        if (tasks.length) {
          blocks.push(
            tasks.map(task => {
              const lines = [
                'Status: ' + task.status,
                task.kind ? 'Tipo: ' + task.kind : null,
                task.title ? 'Título: ' + task.title : null,
                task.isBackgrounded === true ? 'Background: sí' : null,
              ].filter(Boolean).join('\n')

              return '<div class="summary-card">' +
                '<div class="summary-title">' + escapeHtml(task.id) + '</div>' +
                '<div class="summary-meta">' + escapeHtml(lines) + '</div>' +
              '</div>'
            }).join('')
          )
        }

        els.taskSummary.innerHTML = blocks.length
          ? blocks.join('')
          : '<div class="muted">Sin datos de swarm o tasks todavía.</div>'
      }

      function renderSwarmThreads() {
        const detail = state.selectedDetail
        if (!detail) {
          els.swarmThreads.innerHTML = '<div class="muted">Sin threads de swarm todavía.</div>'
          return
        }

        const waitingBlocks = detail.swarmWaitingEdges.map(edge =>
          '<div class="summary-card">' +
            '<div class="summary-title">Waiting: @' + escapeHtml(edge.from) + ' → @' + escapeHtml(edge.to) + '</div>' +
            '<div class="summary-meta">' + escapeHtml(
              (edge.topic ? edge.topic + '\n' : '') +
              edge.body +
              '\n\n' +
              edge.createdAt
            ) + '</div>' +
          '</div>'
        )

        const threadBlocks = detail.swarmThreads.slice(0, 8).map(thread =>
          '<div class="summary-card">' +
            '<div class="summary-title">' + escapeHtml(thread.topic || thread.threadId.slice(0, 8)) + '</div>' +
            '<div class="summary-meta">' + escapeHtml(
              'Participantes: ' + thread.participants.filter(p => p !== '*').join(', ') +
              '\nÚltimo: ' + thread.lastKind +
              '\nAbierto: ' + (thread.open ? 'sí' : 'no') +
              '\n' + thread.lastBody
            ) + '</div>' +
          '</div>'
        )

        const blocks = [...waitingBlocks, ...threadBlocks]
        els.swarmThreads.innerHTML = blocks.length
          ? blocks.join('')
          : '<div class="muted">Sin threads de swarm todavía.</div>'
      }

      function renderSwarmControls() {
        const snapshot = state.selectedDetail?.snapshot || state.selectedSnapshot
        if (!snapshot) {
          els.swarmControls.innerHTML = '<div class="muted">Selecciona una sesión para ver acciones del swarm.</div>'
          return
        }

        const swarm = snapshot.swarm
        if (!swarm || (!swarm.teamName && !(swarm.teammateNames && swarm.teammateNames.length))) {
          els.swarmControls.innerHTML = [
            '<div class="summary-card">',
            '<div class="summary-title">Sin swarm activo</div>',
            '<div class="summary-meta">Puedes crear uno desde aquí con un atajo listo.</div>',
            '<div class="chip-row" style="margin-top:10px;">',
            '<button class="chip" data-swarm-prompt="/swarm create demo-swarm planner coder qa">Crear demo-swarm</button>',
            '</div>',
            '</div>',
          ].join('')
        } else {
          const teammateButtons = (swarm.teammateNames || []).map(name =>
            '<button class="chip" data-swarm-prompt="Pregúntale a @' + escapeHtml(name) + ' cómo va, si está bloqueado y qué necesita del equipo.">Preguntar a @' + escapeHtml(name) + '</button>'
          ).join('')

          els.swarmControls.innerHTML = [
            '<div class="summary-card">',
            '<div class="summary-title">Swarm activo</div>',
            '<div class="summary-meta">' + escapeHtml(
              (swarm.teamName ? 'Team: ' + swarm.teamName + '\n' : '') +
              'Teammates: ' + ((swarm.teammateNames && swarm.teammateNames.length)
                ? swarm.teammateNames.join(', ')
                : 'ninguno')
            ) + '</div>',
            '<div class="chip-row" style="margin-top:10px;">',
            '<button class="chip" data-swarm-prompt="/swarm">Abrir /swarm</button>',
            '<button class="chip" data-swarm-prompt="Dame un estado corto del swarm activo, quién está bloqueado y cuál es el siguiente paso.">Pedir estado</button>',
            '<button class="chip" data-swarm-prompt="Haz que el swarm se coordine entre sí ahora mismo y dame avances parciales.">Forzar coordinación</button>',
            teammateButtons,
            '</div>',
            '</div>',
          ].join('')
        }

        for (const button of els.swarmControls.querySelectorAll('[data-swarm-prompt]')) {
          button.addEventListener('click', () => {
            const prompt = button.getAttribute('data-swarm-prompt')
            if (prompt) {
              sendRuntimePrompt(prompt, 'Enviando acción de swarm...', 'Acción de swarm enviada.').catch(error => {
                renderActionState(error instanceof Error ? error.message : String(error), 'error')
                addEvent('swarm_action_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
              })
            }
          })
        }
      }

      function renderEvents() {
        els.eventCount.textContent = state.events.length + ' recientes'
        if (!state.events.length) {
          els.events.innerHTML = '<div class="muted">Todavía no llegaron eventos.</div>'
          return
        }

        els.events.innerHTML = state.events.map(event => {
          return '<div class="event-item">' +
            '<div class="event-kind">' + escapeHtml(event.kind) + '</div>' +
            '<div class="event-meta">' + escapeHtml(event.meta) + '</div>' +
            '<div class="event-body">' + escapeHtml(event.body) + '</div>' +
          '</div>'
        }).join('')
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
      }

      async function fetchConfig() {
        const response = await fetch('/config')
        if (!response.ok) {
          throw new Error('No pude leer /config del inspector.')
        }
        return response.json()
      }

      function closeSocket() {
        if (state.socket) {
          try {
            state.socket.close()
          } catch {}
          state.socket = null
        }
        state.connected = false
      }

      function sendRequest(method, payload = {}) {
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
          return Promise.reject(new Error('El WebSocket runtime no está conectado.'))
        }

        const requestId = crypto.randomUUID()
        state.socket.send(JSON.stringify({ requestId, method, ...payload }))

        return new Promise((resolve, reject) => {
          state.pending.set(requestId, { resolve, reject })
          setTimeout(() => {
            if (!state.pending.has(requestId)) {
              return
            }
            state.pending.delete(requestId)
            reject(new Error('Timeout esperando respuesta del runtime.'))
          }, 10000)
        })
      }

      async function performAutoRefresh() {
        if (!state.connected || !state.autoRefresh) {
          return
        }

        await refreshSessions().catch(() => {})
        if (state.selectedSessionId) {
          await refreshSelectedSession().catch(() => {})
        }
      }

      function syncAutoRefreshLoop() {
        if (state.autoRefreshTimer) {
          clearInterval(state.autoRefreshTimer)
          state.autoRefreshTimer = null
        }

        if (!state.autoRefresh) {
          return
        }

        state.autoRefreshTimer = setInterval(() => {
          void performAutoRefresh()
        }, 2500)
      }

      async function refreshSessions() {
        const response = await sendRequest('list_sessions')
        if (!response.ok) {
          throw new Error(response.error)
        }
        state.sessions = response.sessions
        const selectedExists = state.selectedSessionId
          && state.sessions.some(session => session.sessionId === state.selectedSessionId)
        if (!selectedExists) {
          state.selectedSessionId = state.sessions[0]?.sessionId ?? null
        }
        renderSessions()
        if (state.selectedSessionId) {
          await ensureSelectedSessionSubscription()
        } else {
          state.selectedSnapshot = null
          renderSnapshot()
          renderActivity()
        }
      }

      async function refreshSelectedSession() {
        if (!state.selectedSessionId) {
          state.selectedSnapshot = null
          state.selectedDetail = null
          renderSnapshot()
          return
        }

        const response = await sendRequest('get_session_detail', {
          sessionId: state.selectedSessionId,
        })
        if (!response.ok) {
          throw new Error(response.error)
        }
        state.selectedDetail = response.detail
        state.selectedSnapshot = response.detail?.snapshot ?? null
        renderSnapshot()
      }

      async function ensureSelectedSessionSubscription() {
        if (state.sessionSubscriptionId) {
          try {
            await sendRequest('unsubscribe', {
              subscriptionId: state.sessionSubscriptionId,
            })
          } catch {}
          state.sessionSubscriptionId = null
        }

        if (!state.selectedSessionId) {
          state.selectedSnapshot = null
          state.selectedDetail = null
          renderSnapshot()
          renderActivity()
          return
        }

        await refreshSelectedSession()
        const response = await sendRequest('subscribe_session', {
          sessionId: state.selectedSessionId,
        })
        if (response.ok) {
          state.sessionSubscriptionId = response.subscriptionId
        }
      }

      async function selectSession(sessionId) {
        state.selectedSessionId = sessionId
        await ensureSelectedSessionSubscription()
        renderSessions()
      }

      async function sendRuntimePrompt(text, pendingMessage, successMessage) {
        if (!state.selectedSessionId) {
          renderActionState('No hay una sesión seleccionada para enviar el prompt.', 'error')
          return
        }

        if (!text) {
          renderActionState('Escribe un prompt antes de enviarlo.', 'error')
          return
        }

        renderActionState(pendingMessage, 'muted')
        const response = await sendRequest('send_message', {
          sessionId: state.selectedSessionId,
          input: { text },
        })

        if (!response.ok) {
          throw new Error(response.error)
        }

        ensureSessionActivity(state.selectedSessionId).notes.push('Prompt enviado desde el inspector.')
        trimActivity(ensureSessionActivity(state.selectedSessionId))
        renderActionState(successMessage, 'muted')
        renderActivity()
      }

      async function sendPromptToSession() {
        const text = els.promptInput.value.trim()
        await sendRuntimePrompt(text, 'Enviando prompt al runtime...', 'Prompt enviado correctamente.')
        els.promptInput.value = ''
      }

      async function interruptSelectedSession() {
        if (!state.selectedSessionId) {
          renderActionState('No hay una sesión seleccionada para interrumpir.', 'error')
          return
        }

        renderActionState('Interrumpiendo sesión...', 'muted')
        const response = await sendRequest('interrupt', {
          sessionId: state.selectedSessionId,
        })

        if (!response.ok) {
          throw new Error(response.error)
        }

        ensureSessionActivity(state.selectedSessionId).notes.push('Interrupción enviada desde el inspector.')
        trimActivity(ensureSessionActivity(state.selectedSessionId))
        renderActionState('Interrupción enviada correctamente.', 'muted')
        renderActivity()
      }

      function updateRuntimeStatus(config) {
        const runtime = config.runtime
        state.runtimeUrl = runtime.url || ''
        els.runtimeUrl.textContent = state.runtimeUrl
          ? 'URL runtime: ' + state.runtimeUrl
          : 'URL runtime: no disponible'

        if (runtime.status === 'running') {
          setBadge(els.runtimeDot, 'running')
          els.runtimeStatus.textContent = 'Bridge runtime activo'
          return
        }

        if (runtime.status === 'failed') {
          setBadge(els.runtimeDot, 'error')
          els.runtimeStatus.textContent = 'Bridge runtime con error: ' + runtime.error
          return
        }

        setBadge(els.runtimeDot, 'connecting')
        els.runtimeStatus.textContent = 'Bridge runtime ' + runtime.status
      }

      async function bootstrapRuntimeSubscription() {
        const subscribeResponse = await sendRequest('subscribe_runtime')
        if (!subscribeResponse.ok) {
          throw new Error(subscribeResponse.error)
        }
        state.runtimeSubscriptionId = subscribeResponse.subscriptionId
      }

      async function connectRuntime() {
        closeSocket()
        setBadge(els.socketDot, 'connecting')
        els.socketStatus.textContent = 'Conectando WebSocket...'

        const config = await fetchConfig()
        updateRuntimeStatus(config)

        if (!config.runtime.url) {
          els.socketStatus.textContent = 'No hay URL runtime disponible.'
          setBadge(els.socketDot, 'error')
          return
        }

        state.socket = new WebSocket(config.runtime.url)

        state.socket.addEventListener('open', async () => {
          state.connected = true
          setBadge(els.socketDot, 'running')
          els.socketStatus.textContent = 'WebSocket conectado'
          addEvent('socket_open', config.runtime.url, 'Conexión runtime abierta')
          try {
            await refreshSessions()
            await bootstrapRuntimeSubscription()
            if (state.selectedSessionId) {
              await selectSession(state.selectedSessionId)
            }
          } catch (error) {
            addEvent('runtime_error', 'bootstrap', error instanceof Error ? error.message : String(error))
          }
        })

        state.socket.addEventListener('message', async raw => {
          const message = JSON.parse(raw.data)
          if ('requestId' in message) {
            const pending = state.pending.get(message.requestId)
            if (!pending) {
              return
            }
            state.pending.delete(message.requestId)
            pending.resolve(message)
            return
          }

          if (message.type === 'runtime_bootstrap') {
            state.sessions = message.sessions
            renderSessions()
            if (!state.selectedSessionId && state.sessions[0]?.sessionId) {
              state.selectedSessionId = state.sessions[0].sessionId
              await ensureSelectedSessionSubscription().catch(() => {})
              renderSessions()
            }
            addEvent(message.type, 'runtime', 'Recibido bootstrap con ' + message.sessions.length + ' sesiones.')
            return
          }

          if (message.type === 'session_bootstrap') {
            ensureSessionActivity(message.session.sessionId)
            if (message.session.sessionId === state.selectedSessionId) {
              state.selectedSnapshot = message.session
              renderSnapshot()
              renderActivity()
            }
            addEvent(message.type, message.session.sessionId, 'Snapshot inicial recibido para la sesión seleccionada.')
            return
          }

          if (message.type === 'runtime_registry_event') {
            addEvent(message.event.type, message.event.sessionId || 'runtime', JSON.stringify(message.event, null, 2))
            await refreshSessions().catch(() => {})
            if (state.selectedSessionId) {
              await refreshSelectedSession().catch(() => {})
            }
            return
          }

          if (message.type === 'runtime_session_event') {
            updateSessionActivity(message.sessionId, message.event)
            addEvent(message.event.type, message.sessionId, JSON.stringify(message.event, null, 2))
            if (message.sessionId === state.selectedSessionId) {
              await refreshSelectedSession().catch(() => {})
            }
          }
        })

        state.socket.addEventListener('close', () => {
          state.connected = false
          setBadge(els.socketDot, 'error')
          els.socketStatus.textContent = 'WebSocket desconectado'
          addEvent('socket_close', state.runtimeUrl || 'runtime', 'Conexión runtime cerrada')
        })

        state.socket.addEventListener('error', () => {
          state.connected = false
          setBadge(els.socketDot, 'error')
          els.socketStatus.textContent = 'Error en WebSocket'
        })
      }

      els.reconnect.addEventListener('click', () => {
        connectRuntime().catch(error => {
          addEvent('reconnect_error', 'runtime', error instanceof Error ? error.message : String(error))
        })
      })

      els.autoRefresh.addEventListener('change', () => {
        state.autoRefresh = Boolean(els.autoRefresh.checked)
        syncAutoRefreshLoop()
      })

      els.refreshSessions.addEventListener('click', () => {
        refreshSessions().catch(error => {
          addEvent('refresh_sessions_error', 'runtime', error instanceof Error ? error.message : String(error))
        })
      })

      els.refreshSelected.addEventListener('click', () => {
        refreshSelectedSession().catch(error => {
          addEvent('refresh_session_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
        })
      })

      els.sendPrompt.addEventListener('click', () => {
        sendPromptToSession().catch(error => {
          renderActionState(error instanceof Error ? error.message : String(error), 'error')
          addEvent('send_prompt_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
        })
      })

      els.promptInput.addEventListener('keydown', event => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          els.sendPrompt.click()
        }
      })

      els.interruptSession.addEventListener('click', () => {
        interruptSelectedSession().catch(error => {
          renderActionState(error instanceof Error ? error.message : String(error), 'error')
          addEvent('interrupt_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
        })
      })

      connectRuntime().catch(error => {
        setBadge(els.socketDot, 'error')
        els.socketStatus.textContent = 'No pude conectar'
        addEvent('connect_error', 'runtime', error instanceof Error ? error.message : String(error))
      })
      syncAutoRefreshLoop()
    </script>
  </body>
</html>`
}

export function getRuntimeInspectorServerStatus(): RuntimeInspectorStatus {
  if (activeInspectorServer) {
    return {
      status: 'running',
      server: activeInspectorServer,
    }
  }

  if (inspectorServerStartPromise) {
    return { status: 'starting' }
  }

  if (lastInspectorServerError) {
    return {
      status: 'failed',
      error: lastInspectorServerError,
    }
  }

  return { status: 'stopped' }
}

export async function ensureRuntimeInspectorServer(
  config: RuntimeInspectorServerConfig = {},
): Promise<RunningRuntimeInspectorServer> {
  if (activeInspectorServer) {
    return activeInspectorServer
  }

  if (inspectorServerStartPromise) {
    return inspectorServerStartPromise
  }

  lastInspectorServerError = undefined
  inspectorServerStartPromise = (async () => {
    await ensureRuntimeServer()

    const host = config.host ?? '127.0.0.1'
    const port = config.port ?? 0
    const html = renderInspectorHtml()

    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname

      if (pathname === '/config') {
        const runtimeStatus = getRuntimeServerStatus()
        const payload = JSON.stringify(
          {
            runtime: getRuntimeStatusPayload(runtimeStatus),
            inspector:
              activeInspectorServer
                ? {
                    status: 'running',
                    url: activeInspectorServer.url,
                    host: activeInspectorServer.host,
                    port: activeInspectorServer.port,
                  }
                : {
                    status: 'starting',
                  },
          },
          null,
          2,
        )

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(payload)
        return
      }

      if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(html)
        return
      }

      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
      res.end('Not found')
    })

    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve())
      server.once('error', reject)
      server.listen(port, host)
    })

    const address = server.address() as AddressInfo | null
    const actualPort = address?.port ?? port
    const url = `http://${host}:${actualPort}/`

    const runningServer: RunningRuntimeInspectorServer = {
      host,
      port: actualPort,
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

    activeInspectorServer = runningServer
    return runningServer
  })()
    .catch(error => {
      lastInspectorServerError = normalizeError(error)
      throw lastInspectorServerError
    })
    .finally(() => {
      inspectorServerStartPromise = undefined
    })

  return inspectorServerStartPromise
}

export async function stopRuntimeInspectorServer(): Promise<boolean> {
  const server =
    activeInspectorServer ||
    (inspectorServerStartPromise ? await inspectorServerStartPromise : undefined)

  if (!server) {
    return false
  }

  await server.stop()

  if (activeInspectorServer === server) {
    activeInspectorServer = undefined
  }
  lastInspectorServerError = undefined

  return true
}
