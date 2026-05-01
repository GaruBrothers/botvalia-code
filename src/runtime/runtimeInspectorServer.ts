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
        --bg: #050d18;
        --panel: rgba(8, 17, 31, 0.92);
        --panel-2: rgba(11, 24, 42, 0.96);
        --panel-3: rgba(15, 31, 52, 0.9);
        --border: rgba(123, 175, 255, 0.14);
        --border-strong: rgba(123, 175, 255, 0.3);
        --text: #eef5ff;
        --muted: #8ca4c4;
        --muted-strong: #b7c9e3;
        --cyan: #35d7ff;
        --blue: #56a7ff;
        --violet: #8d73ff;
        --green: #38d98f;
        --amber: #f5c65c;
        --red: #ff7c96;
        --shadow: 0 22px 60px rgba(3, 9, 18, 0.45);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
      }

      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(86, 167, 255, 0.16), transparent 24%),
          radial-gradient(circle at top right, rgba(141, 115, 255, 0.18), transparent 22%),
          linear-gradient(180deg, #020812 0%, #061120 58%, #050d18 100%);
        color: var(--text);
      }

      .shell {
        min-height: 100vh;
        max-width: 1720px;
        margin: 0 auto;
        padding: 22px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        margin-bottom: 14px;
      }

      .brand {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .logo {
        width: 18px;
        height: 60px;
        border-radius: 999px;
        background: linear-gradient(180deg, #eafcff 0%, var(--cyan) 20%, var(--blue) 54%, var(--violet) 100%);
        box-shadow: 0 0 28px rgba(86, 167, 255, 0.28);
        transform: skew(-18deg);
      }

      h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.02;
        letter-spacing: -0.03em;
      }

      .subtitle {
        margin-top: 7px;
        color: var(--muted);
        font-size: 13px;
      }

      .toolbar {
        display: flex;
        justify-content: flex-end;
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
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border);
      }

      .toggle input {
        accent-color: var(--cyan);
      }

      button {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: rgba(18, 34, 55, 0.92);
        color: var(--text);
        padding: 11px 15px;
        cursor: pointer;
        font: inherit;
        transition: border-color 120ms ease, transform 120ms ease, background 120ms ease, opacity 120ms ease;
      }

      button:hover {
        border-color: rgba(86, 167, 255, 0.35);
        background: rgba(25, 43, 67, 0.95);
        transform: translateY(-1px);
      }

      button:disabled {
        opacity: 0.48;
        cursor: not-allowed;
        transform: none;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel-2);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }

      input::placeholder,
      textarea::placeholder {
        color: rgba(140, 164, 196, 0.78);
      }

      input:focus,
      textarea:focus {
        outline: none;
        border-color: rgba(86, 167, 255, 0.48);
        box-shadow: 0 0 0 1px rgba(86, 167, 255, 0.18);
      }

      textarea {
        min-height: 96px;
        resize: vertical;
      }

      .statusbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 14px;
      }

      .badge {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 10px 13px;
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

      .dot.running {
        background: var(--green);
      }

      .dot.connecting {
        background: var(--amber);
      }

      .dot.error {
        background: var(--red);
      }

      .workspace {
        display: grid;
        grid-template-columns: 300px minmax(520px, 1fr) 380px;
        gap: 16px;
        min-height: calc(100vh - 152px);
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 22px;
        overflow: hidden;
        min-height: 0;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow);
      }

      .panel h2 {
        margin: 0;
        font-size: 22px;
        letter-spacing: -0.025em;
      }

      .eyebrow {
        display: inline-block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--cyan);
        margin-bottom: 8px;
      }

      .panel-head {
        padding: 18px 20px 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .panel-body {
        padding: 18px 20px 20px;
        overflow: auto;
        flex: 1;
      }

      .muted {
        color: var(--muted);
      }

      .sidebar-body,
      .inspector-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .search-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 12px;
        color: var(--muted);
      }

      .sessions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .session-item {
        width: 100%;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.015));
        padding: 15px;
        text-align: left;
      }

      .session-item.active {
        border-color: rgba(86, 167, 255, 0.38);
        box-shadow: inset 0 0 0 1px rgba(86, 167, 255, 0.18), 0 0 0 1px rgba(86, 167, 255, 0.08);
        background: linear-gradient(180deg, rgba(53, 215, 255, 0.08), rgba(83, 168, 255, 0.07));
      }

      .session-title-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }

      .session-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
      }

      .session-subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
      }

      .session-meta {
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
        line-height: 1.55;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border);
        color: var(--muted-strong);
        font-size: 12px;
      }

      .pill-strong {
        border-color: rgba(53, 215, 255, 0.22);
        background: rgba(53, 215, 255, 0.08);
        color: var(--text);
      }

      .pill-success {
        border-color: rgba(56, 217, 143, 0.22);
        background: rgba(56, 217, 143, 0.08);
      }

      .pill-warning {
        border-color: rgba(245, 198, 92, 0.24);
        background: rgba(245, 198, 92, 0.1);
      }

      .pill-danger {
        border-color: rgba(255, 124, 150, 0.24);
        background: rgba(255, 124, 150, 0.1);
      }

      .chat-shell {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
      }

      .chat-header {
        padding: 20px 22px 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
      }

      .chat-title {
        margin: 0;
        font-size: 24px;
        line-height: 1.04;
        letter-spacing: -0.03em;
      }

      .chat-meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .chat-scroll {
        overflow: auto;
        padding: 18px 22px 22px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .live-strip {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.03);
        padding: 14px;
      }

      .section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 10px;
      }

      .section-subtitle {
        font-size: 12px;
        color: var(--muted);
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .live-log {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .live-item {
        border: 1px solid rgba(123, 175, 255, 0.12);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.03);
        padding: 10px 12px;
      }

      .live-kind {
        display: inline-block;
        margin-bottom: 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--cyan);
      }

      .live-body {
        font-size: 12px;
        color: var(--text);
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .chat-feed {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .chat-empty,
      .empty-state {
        border: 1px dashed var(--border);
        border-radius: 18px;
        padding: 18px;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.025);
        line-height: 1.6;
      }

      .chat-row {
        display: flex;
        width: 100%;
      }

      .chat-row.user {
        justify-content: flex-end;
      }

      .chat-card {
        max-width: 88%;
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.03);
      }

      .chat-row.user .chat-card {
        background: linear-gradient(135deg, rgba(53, 215, 255, 0.14), rgba(83, 168, 255, 0.14));
        border-color: rgba(86, 167, 255, 0.3);
      }

      .chat-row.assistant .chat-card {
        background: rgba(83, 168, 255, 0.08);
      }

      .chat-row.system .chat-card,
      .chat-row.progress .chat-card,
      .chat-row.attachment .chat-card {
        background: rgba(255, 255, 255, 0.04);
      }

      .chat-row.pending .chat-card {
        border-style: dashed;
        opacity: 0.92;
      }

      .chat-card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }

      .chat-card-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
      }

      .chat-card-meta {
        font-size: 11px;
        color: var(--muted);
        letter-spacing: 0.04em;
      }

      .chat-card-body {
        font-size: 13px;
        line-height: 1.7;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .composer-chat {
        border-top: 1px solid var(--border);
        padding: 18px 22px 20px;
        background: linear-gradient(180deg, rgba(6, 12, 22, 0.92), rgba(8, 17, 31, 0.96));
      }

      .composer-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        margin-bottom: 12px;
      }

      .composer-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
      }

      .composer-hint {
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
      }

      .status-inline {
        font-size: 12px;
        line-height: 1.5;
        max-width: 300px;
        text-align: right;
      }

      .status-inline.success {
        color: var(--green);
      }

      .status-inline.error {
        color: var(--red);
      }

      .composer-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .quick-actions,
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

      .chip:hover {
        border-color: rgba(86, 167, 255, 0.32);
      }

      .composer-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .button-primary {
        background: linear-gradient(135deg, rgba(53, 215, 255, 0.26), rgba(83, 168, 255, 0.22));
        border-color: rgba(86, 167, 255, 0.4);
      }

      .button-secondary {
        background: rgba(255, 255, 255, 0.04);
      }

      .button-danger {
        border-color: rgba(255, 124, 150, 0.24);
        background: rgba(255, 124, 150, 0.08);
      }

      .button-danger:hover {
        border-color: rgba(255, 124, 150, 0.4);
        background: rgba(255, 124, 150, 0.12);
      }

      .inspector-scroll {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .summary-card {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.03);
      }

      .summary-kicker {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .summary-title {
        font-size: 15px;
        color: var(--text);
        font-weight: 600;
        line-height: 1.35;
      }

      .summary-meta {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .inspector-section {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.025);
        padding: 14px;
      }

      .summary-list,
      .events {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .event-item {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.03);
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

      .details-card {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.025);
        overflow: hidden;
      }

      .details-card summary {
        cursor: pointer;
        list-style: none;
        padding: 14px 16px;
        font-size: 13px;
        font-weight: 600;
      }

      .details-card summary::-webkit-details-marker {
        display: none;
      }

      .details-card pre {
        margin: 0 14px 14px;
        padding: 14px;
        border-radius: 16px;
        background: var(--panel-3);
        border: 1px solid var(--border);
        color: var(--text);
        overflow: auto;
        font-size: 12px;
        line-height: 1.55;
      }

      @media (max-width: 1380px) {
        .workspace {
          grid-template-columns: 280px minmax(420px, 1fr);
        }

        .inspector-shell {
          grid-column: 1 / -1;
          min-height: 0;
        }
      }

      @media (max-width: 1080px) {
        .topbar,
        .composer-top,
        .composer-footer,
        .chat-header {
          flex-direction: column;
          align-items: stretch;
        }

        .workspace {
          grid-template-columns: 1fr;
          min-height: auto;
        }

        .chat-card {
          max-width: 100%;
        }

        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="topbar">
        <div class="brand">
          <div class="logo"></div>
          <div>
            <h1>BotValia Runtime Inspector</h1>
            <div class="subtitle">Workspace visual para sesiones, swarm y control del mismo motor local.</div>
          </div>
        </div>
        <div class="toolbar">
          <label class="toggle"><input id="autoRefresh" type="checkbox" checked /> Auto refresh</label>
          <button id="reconnect" type="button">Reconectar</button>
          <button id="refreshSessions" type="button">Refrescar sesiones</button>
          <button id="refreshSelected" type="button">Refrescar sesión</button>
        </div>
      </div>

      <div class="statusbar">
        <div class="badge"><span id="runtimeDot" class="dot connecting"></span><span id="runtimeStatus">Cargando bridge runtime...</span></div>
        <div class="badge"><span id="socketDot" class="dot connecting"></span><span id="socketStatus">Conectando WebSocket...</span></div>
        <div class="badge"><span id="runtimeUrl">URL runtime: --</span></div>
      </div>

      <div class="workspace">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="eyebrow">Sesiones</div>
              <h2>Sesiones activas</h2>
              <div class="subtitle">Elige una sesión viva del runtime y salta a su conversación.</div>
            </div>
            <span id="sessionCount" class="muted">0 activas</span>
          </div>
          <div class="panel-body sidebar-body">
            <label class="search-field">
              <span>Buscar sesión</span>
              <input id="sessionSearch" type="search" placeholder="Filtra por estado, modelo o team..." />
            </label>
            <div id="sessions" class="sessions"></div>
          </div>
        </section>

        <section class="panel chat-shell">
          <div class="chat-header">
            <div>
              <div class="eyebrow">Workspace</div>
              <h2 id="selectedSessionTitle" class="chat-title">Selecciona una sesión</h2>
              <div id="selectedSessionMeta" class="chat-meta">Cuando elijas una sesión, aquí verás su estado, modelo, proyecto y ritmo actual.</div>
            </div>
            <div class="pill-row">
              <span id="selectedSessionStatus" class="pill">sin sesión</span>
              <span id="selectedSessionModel" class="pill">modelo --</span>
            </div>
          </div>

          <div class="chat-scroll">
            <div class="live-strip">
              <div class="section-title">Actividad en vivo</div>
              <div class="section-subtitle">Cambios de modelo, streaming reciente, interrupciones y señales del swarm.</div>
              <div id="activityLog" class="live-log">
                <div class="empty-state">Sin actividad reciente para la sesión seleccionada.</div>
              </div>
            </div>

            <div>
              <div class="section-title">Conversación</div>
              <div class="section-subtitle">Feed tipo chat con el transcript más reciente de la sesión viva.</div>
              <div id="conversation" class="chat-feed">
                <div class="chat-empty">Sin mensajes recientes todavía.</div>
              </div>
            </div>
          </div>

          <form id="promptForm" class="composer-chat">
            <div class="composer-top">
              <div>
                <div class="composer-title">Habla con la sesión</div>
                <div class="composer-hint">Enter envía · Shift+Enter inserta nueva línea · Ctrl/Cmd+Enter también envía.</div>
              </div>
              <div id="actionStatus" class="status-inline muted">Selecciona una sesión activa para empezar a controlarla.</div>
            </div>
            <textarea id="promptInput" placeholder="Escribe aquí un prompt para enviarlo al motor en vivo."></textarea>
            <div class="composer-footer">
              <div class="quick-actions">
                <button class="chip" type="button" data-fill-prompt="Dame un resumen corto del estado actual y el siguiente paso.">Resumen</button>
                <button class="chip" type="button" data-fill-prompt="¿Qué estás haciendo ahora mismo y si estás bloqueado por algo?">Estado</button>
                <button class="chip" type="button" data-fill-prompt="Si hay swarm activo, coordínate con el equipo y dame avances parciales.">Coordinar swarm</button>
              </div>
              <div class="composer-actions">
                <button id="interruptSession" type="button" class="button-secondary button-danger">Interrumpir</button>
                <button id="sendPrompt" type="submit" class="button-primary">Enviar</button>
              </div>
            </div>
          </form>
        </section>

        <section class="panel inspector-shell">
          <div class="panel-head">
            <div>
              <div class="eyebrow">Inspector</div>
              <h2>Contexto y swarm</h2>
              <div class="subtitle">Resumen ejecutivo, tareas, threads y depuración cruda cuando haga falta.</div>
            </div>
            <span id="eventCount" class="muted">0 recientes</span>
          </div>
          <div class="panel-body inspector-body">
            <div class="inspector-scroll">
              <div>
                <div class="section-title">Resumen de sesión</div>
                <div id="overviewSummary" class="summary-grid"></div>
              </div>

              <div class="inspector-section">
                <div class="section-title">Swarm y tasks</div>
                <div id="taskSummary" class="summary-list">
                  <div class="empty-state">Sin datos de swarm o tasks todavía.</div>
                </div>
              </div>

              <div class="inspector-section">
                <div class="section-title">Threads y waiting</div>
                <div id="swarmThreads" class="summary-list">
                  <div class="empty-state">Sin threads de swarm todavía.</div>
                </div>
              </div>

              <div class="inspector-section">
                <div class="section-title">Acciones de swarm</div>
                <div id="swarmControls" class="summary-list">
                  <div class="empty-state">Selecciona una sesión para ver acciones del swarm.</div>
                </div>
              </div>

              <details class="details-card">
                <summary>Snapshot JSON</summary>
                <pre id="snapshot">{}</pre>
              </details>

              <details class="details-card" open>
                <summary>Eventos recientes</summary>
                <div id="events" class="events" style="padding: 0 14px 14px;">
                  <div class="empty-state">Todavía no llegaron eventos.</div>
                </div>
              </details>
            </div>
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
        sessionFilter: '',
        sendingPrompt: false,
        interruptingSession: false,
        refreshSelectedTimer: null,
        actionStatus: {
          message: '',
          tone: 'muted',
          expiresAt: 0,
        },
        optimisticMessages: new Map(),
      }

      const els = {
        runtimeDot: document.getElementById('runtimeDot'),
        runtimeStatus: document.getElementById('runtimeStatus'),
        socketDot: document.getElementById('socketDot'),
        socketStatus: document.getElementById('socketStatus'),
        runtimeUrl: document.getElementById('runtimeUrl'),
        autoRefresh: document.getElementById('autoRefresh'),
        sessionSearch: document.getElementById('sessionSearch'),
        sessions: document.getElementById('sessions'),
        sessionCount: document.getElementById('sessionCount'),
        selectedSessionTitle: document.getElementById('selectedSessionTitle'),
        selectedSessionMeta: document.getElementById('selectedSessionMeta'),
        selectedSessionStatus: document.getElementById('selectedSessionStatus'),
        selectedSessionModel: document.getElementById('selectedSessionModel'),
        overviewSummary: document.getElementById('overviewSummary'),
        snapshot: document.getElementById('snapshot'),
        promptForm: document.getElementById('promptForm'),
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

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
      }

      function formatTimestamp(value) {
        if (!value) {
          return 'sin hora'
        }

        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
          return String(value)
        }

        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      }

      function getSessionTitle(session) {
        if (session.swarm?.teamName) {
          return session.swarm.teamName
        }

        return 'Sesión ' + session.sessionId.slice(0, 8)
      }

      function getSessionSubtitle(session) {
        const parts = [session.sessionId.slice(0, 8)]
        if (session.swarm?.teammateNames?.length) {
          parts.push(session.swarm.teammateNames.length + ' teammates')
        }
        return parts.join(' · ')
      }

      function getStatusTone(status) {
        if (status === 'running') {
          return 'pill-success'
        }

        if (status === 'requires_action') {
          return 'pill-warning'
        }

        if (status === 'errored' || status === 'interrupted') {
          return 'pill-danger'
        }

        return ''
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
            .join('\\n')
            .trim()
        }

        return ''
      }

      function getOptimisticMessages(sessionId) {
        if (!state.optimisticMessages.has(sessionId)) {
          state.optimisticMessages.set(sessionId, [])
        }

        return state.optimisticMessages.get(sessionId)
      }

      function addOptimisticMessage(sessionId, message) {
        const messages = getOptimisticMessages(sessionId)
        messages.push(message)
        state.optimisticMessages.set(sessionId, messages.slice(-6))
      }

      function removeOptimisticMessage(sessionId, uuid) {
        if (!state.optimisticMessages.has(sessionId)) {
          return
        }

        state.optimisticMessages.set(
          sessionId,
          state.optimisticMessages
            .get(sessionId)
            .filter(message => message.uuid !== uuid),
        )
      }

      function reconcileOptimisticMessages(sessionId, detail) {
        if (!state.optimisticMessages.has(sessionId)) {
          return
        }

        const recentUserTexts = new Set(
          (detail?.messages || [])
            .filter(message => message.type === 'user')
            .map(message => (message.text || '').trim())
            .filter(Boolean)
        )

        state.optimisticMessages.set(
          sessionId,
          state.optimisticMessages
            .get(sessionId)
            .filter(message => !recentUserTexts.has((message.text || '').trim())),
        )
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
          els.sessions.innerHTML = '<div class="empty-state">No hay sesiones activas todavía. Mantén abierta una sesión del CLI o manda un prompt para verla aquí.</div>'
          return
        }

        const filter = state.sessionFilter.trim().toLowerCase()
        const filteredSessions = filter
          ? state.sessions.filter(session => {
              const haystack = [
                session.sessionId,
                session.status,
                session.mainLoopModelForSession || '',
                session.mainLoopModel || '',
                session.swarm?.teamName || '',
                ...(session.swarm?.teammateNames || []),
              ]
                .join(' ')
                .toLowerCase()

              return haystack.includes(filter)
            })
          : state.sessions

        if (!filteredSessions.length) {
          els.sessions.innerHTML = '<div class="empty-state">No encontré sesiones con ese filtro. Prueba por estado, modelo o nombre del team.</div>'
          return
        }

        els.sessions.innerHTML = filteredSessions.map(session => {
          const active = session.sessionId === state.selectedSessionId ? ' active' : ''
          const modelLabel = session.mainLoopModelForSession || session.mainLoopModel || 'sin modelo'
          const swarmPill = session.swarm?.teamName
            ? '<span class="pill pill-strong">' + escapeHtml(session.swarm.teamName) + '</span>'
            : ''
          const teammateCount = session.swarm?.teammateNames?.length
            ? '<span class="pill">' + session.swarm.teammateNames.length + ' teammates</span>'
            : ''

          return '<button class="session-item' + active + '" data-session-id="' + session.sessionId + '">' +
            '<div class="session-title-row">' +
              '<div>' +
                '<div class="session-title">' + escapeHtml(getSessionTitle(session)) + '</div>' +
                '<div class="session-subtitle">' + escapeHtml(getSessionSubtitle(session)) + '</div>' +
              '</div>' +
              '<span class="pill ' + getStatusTone(session.status) + '">' + escapeHtml(session.status) + '</span>' +
            '</div>' +
            '<div class="session-meta">' +
              'Modelo: ' + escapeHtml(String(modelLabel)) + '<br/>' +
              'Mensajes: ' + session.messageCount + ' · Tasks: ' + session.taskCount +
            '</div>' +
            '<div class="pill-row" style="margin-top:12px;">' +
              swarmPill +
              teammateCount +
            '</div>' +
          '</button>'
        }).join('')

        for (const button of els.sessions.querySelectorAll('[data-session-id]')) {
          button.addEventListener('click', () => {
            void selectSession(button.getAttribute('data-session-id'))
          })
        }
      }

      function setActionStatus(message, tone = 'muted', stickyMs = 3500) {
        state.actionStatus.message = message
        state.actionStatus.tone = tone
        state.actionStatus.expiresAt =
          stickyMs === Number.POSITIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : Date.now() + stickyMs
        renderComposerState()

        if (stickyMs && stickyMs !== Number.POSITIVE_INFINITY) {
          setTimeout(() => {
            renderComposerState()
          }, stickyMs + 50)
        }
      }

      function renderOverview() {
        const snapshot = state.selectedDetail?.snapshot || state.selectedSnapshot
        if (!snapshot) {
          els.overviewSummary.innerHTML = '<div class="summary-card"><div class="summary-kicker">Resumen</div><div class="summary-title">Ninguna sesión seleccionada</div><div class="summary-meta">Elige una sesión para ver su contexto operativo, proyecto y estado del swarm.</div></div>'
          return
        }

        const modelLabel = snapshot.mainLoopModelForSession || snapshot.mainLoopModel || 'sin modelo'
        const cards = [
          {
            kicker: 'Estado',
            title: snapshot.status,
            meta: 'Mensajes: ' + snapshot.messageCount + '\\nTasks: ' + snapshot.taskCount,
          },
          {
            kicker: 'Modelo',
            title: String(modelLabel),
            meta: 'Modo principal: ' + String(snapshot.mainLoopModel || 'sin modelo'),
          },
          {
            kicker: 'Proyecto',
            title: snapshot.cwd.split('\\\\').pop() || snapshot.cwd,
            meta: snapshot.cwd,
          },
          {
            kicker: 'Swarm',
            title: snapshot.swarm.teamName || 'Sin team activo',
            meta:
              'Líder: ' + (snapshot.swarm.isLeader ? 'sí' : 'no') +
              '\\nTeammates: ' +
              (snapshot.swarm.teammateNames.length
                ? snapshot.swarm.teammateNames.join(', ')
                : 'ninguno'),
          },
        ]

        els.overviewSummary.innerHTML = cards.map(card =>
          '<div class="summary-card">' +
            '<div class="summary-kicker">' + escapeHtml(card.kicker) + '</div>' +
            '<div class="summary-title">' + escapeHtml(card.title) + '</div>' +
            '<div class="summary-meta">' + escapeHtml(card.meta) + '</div>' +
          '</div>'
        ).join('')
      }

      function canInterruptSession(status) {
        return status === 'running' || status === 'requires_action'
      }

      function getVisibleActionStatus() {
        const hasSession = Boolean(state.selectedSessionId)
        if (!hasSession) {
          return {
            message: 'Selecciona una sesión activa para empezar a controlarla.',
            tone: 'muted',
          }
        }

        if (!state.connected) {
          return {
            message: 'No hay conexión con el runtime. Reconecta antes de enviar o interrumpir.',
            tone: 'error',
          }
        }

        if (state.actionStatus.message && state.actionStatus.expiresAt > Date.now()) {
          return {
            message: state.actionStatus.message,
            tone: state.actionStatus.tone,
          }
        }

        return {
          message: 'Listo para enviar. Enter envía y Shift+Enter añade una línea.',
          tone: 'muted',
        }
      }

      function renderComposerState() {
        const hasSession = Boolean(state.selectedSessionId)
        const snapshot = state.selectedDetail?.snapshot || state.selectedSnapshot
        const hasText = Boolean(els.promptInput.value.trim())
        const canInterrupt = hasSession && state.connected && canInterruptSession(snapshot?.status)

        els.promptInput.disabled = !hasSession || !state.connected || state.sendingPrompt
        els.sendPrompt.disabled = !hasSession || !state.connected || !hasText || state.sendingPrompt
        els.interruptSession.disabled = !canInterrupt || state.interruptingSession
        els.sendPrompt.textContent = state.sendingPrompt ? 'Enviando...' : 'Enviar'
        els.interruptSession.textContent = state.interruptingSession ? 'Interrumpiendo...' : 'Interrumpir'

        const status = getVisibleActionStatus()
        els.actionStatus.textContent = status.message
        els.actionStatus.className = 'status-inline ' + status.tone
      }

      function renderSelectedSession() {
        const snapshot = state.selectedDetail?.snapshot || state.selectedSnapshot
        if (!snapshot) {
          els.selectedSessionTitle.textContent = 'Selecciona una sesión'
          els.selectedSessionMeta.textContent = 'Cuando elijas una sesión, aquí verás su estado, modelo, proyecto y ritmo actual.'
          els.selectedSessionStatus.className = 'pill'
          els.selectedSessionStatus.textContent = 'sin sesión'
          els.selectedSessionModel.textContent = 'modelo --'
          els.snapshot.textContent = JSON.stringify({}, null, 2)
          renderOverview()
          renderComposerState()
          renderActivity()
          renderConversation()
          renderTaskSummary()
          renderSwarmThreads()
          renderSwarmControls()
          return
        }

        const modelLabel = snapshot.mainLoopModelForSession || snapshot.mainLoopModel || 'sin modelo'
        els.selectedSessionTitle.textContent = getSessionTitle(snapshot)
        els.selectedSessionMeta.textContent = [
          snapshot.sessionId,
          'Mensajes: ' + snapshot.messageCount,
          'Tasks: ' + snapshot.taskCount,
          snapshot.cwd,
        ].join('\\n')
        els.selectedSessionStatus.className = 'pill ' + getStatusTone(snapshot.status)
        els.selectedSessionStatus.textContent = snapshot.status
        els.selectedSessionModel.textContent = 'modelo ' + String(modelLabel)
        els.snapshot.textContent = JSON.stringify(snapshot, null, 2)
        renderOverview()
        renderComposerState()
        renderActivity()
        renderConversation()
        renderTaskSummary()
        renderSwarmThreads()
        renderSwarmControls()
      }

      function renderActivity() {
        if (!state.selectedSessionId) {
          els.activityLog.innerHTML = '<div class="empty-state">Sin actividad reciente para la sesión seleccionada.</div>'
          return
        }

        const activity = state.sessionActivity.get(state.selectedSessionId)
        if (!activity) {
          els.activityLog.innerHTML = '<div class="empty-state">Aún no llegaron eventos útiles para esta sesión.</div>'
          return
        }

        const blocks = []
        if (activity.delta) {
          blocks.push(
            '<div class="live-item">' +
              '<div class="live-kind">streaming</div>' +
              '<div class="live-body">' + escapeHtml(activity.delta) + '</div>' +
            '</div>'
          )
        }

        for (const completedMessage of activity.completed.slice(-2).reverse()) {
          blocks.push(
            '<div class="live-item">' +
              '<div class="live-kind">respuesta completada</div>' +
              '<div class="live-body">' + escapeHtml(completedMessage) + '</div>' +
            '</div>'
          )
        }

        for (const note of activity.notes.slice(-5).reverse()) {
          blocks.push(
            '<div class="live-item">' +
              '<div class="live-kind">nota</div>' +
              '<div class="live-body">' + escapeHtml(note) + '</div>' +
            '</div>'
          )
        }

        els.activityLog.innerHTML = blocks.length
          ? blocks.join('')
          : '<div class="empty-state">Aún no llegaron eventos útiles para esta sesión.</div>'
      }

      function getMessageLabel(message) {
        if (message.type === 'user') {
          return 'Tú'
        }

        if (message.type === 'assistant') {
          return 'BotValia'
        }

        if (message.type === 'system') {
          return 'Sistema'
        }

        if (message.type === 'progress') {
          return 'Actividad'
        }

        if (message.type === 'attachment') {
          return 'Adjunto'
        }

        return message.label || 'Mensaje'
      }

      function renderConversation() {
        const detail = state.selectedDetail
        const optimistic = state.selectedSessionId
          ? getOptimisticMessages(state.selectedSessionId)
          : []
        const messages = [...(detail?.messages || []), ...optimistic].sort((left, right) =>
          String(left.timestamp).localeCompare(String(right.timestamp))
        )

        if (!messages.length) {
          els.conversation.innerHTML = '<div class="chat-empty">Aún no hay conversación visible. Envía un prompt desde aquí o desde el CLI para poblar este workspace.</div>'
          return
        }

        els.conversation.innerHTML = messages.map(message => {
          const metaParts = [formatTimestamp(message.timestamp)]
          if (message.pending) {
            metaParts.push('pendiente')
          }
          if (message.isMeta) {
            metaParts.push('meta')
          }

          return '<div class="chat-row ' + escapeHtml(message.type) + (message.pending ? ' pending' : '') + '">' +
            '<div class="chat-card">' +
              '<div class="chat-card-head">' +
                '<div class="chat-card-label">' + escapeHtml(getMessageLabel(message)) + '</div>' +
                '<div class="chat-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</div>' +
              '</div>' +
              '<div class="chat-card-body">' + escapeHtml(message.text || '[sin texto renderizable]') + '</div>' +
            '</div>' +
          '</div>'
        }).join('')

        requestAnimationFrame(() => {
          els.conversation.scrollTop = els.conversation.scrollHeight
        })
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
          ].join('\\n')

          blocks.push(
            '<div class="summary-card">' +
              '<div class="summary-kicker">Swarm</div>' +
              '<div class="summary-title">' + escapeHtml(swarm.teamName || 'Sin team activo') + '</div>' +
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
              ].filter(Boolean).join('\\n')

              return '<div class="summary-card">' +
                '<div class="summary-kicker">Task</div>' +
                '<div class="summary-title">' + escapeHtml(task.id) + '</div>' +
                '<div class="summary-meta">' + escapeHtml(lines) + '</div>' +
              '</div>'
            }).join('')
          )
        }

        els.taskSummary.innerHTML = blocks.length
          ? blocks.join('')
          : '<div class="empty-state">Sin datos de swarm o tasks todavía.</div>'
      }

      function renderSwarmThreads() {
        const detail = state.selectedDetail
        if (!detail) {
          els.swarmThreads.innerHTML = '<div class="empty-state">Sin threads de swarm todavía.</div>'
          return
        }

        const waitingBlocks = detail.swarmWaitingEdges.map(edge =>
          '<div class="summary-card">' +
            '<div class="summary-kicker">Waiting</div>' +
            '<div class="summary-title">@' + escapeHtml(edge.from) + ' → @' + escapeHtml(edge.to) + '</div>' +
            '<div class="summary-meta">' + escapeHtml(
              (edge.topic ? edge.topic + '\\n' : '') +
              edge.body +
              '\\n\\n' +
              edge.createdAt
            ) + '</div>' +
          '</div>'
        )

        const threadBlocks = detail.swarmThreads.slice(0, 8).map(thread =>
          '<div class="summary-card">' +
            '<div class="summary-kicker">Thread</div>' +
            '<div class="summary-title">' + escapeHtml(thread.topic || thread.threadId.slice(0, 8)) + '</div>' +
            '<div class="summary-meta">' + escapeHtml(
              'Participantes: ' + thread.participants.filter(p => p !== '*').join(', ') +
              '\\nÚltimo: ' + thread.lastKind +
              '\\nAbierto: ' + (thread.open ? 'sí' : 'no') +
              '\\n' + thread.lastBody
            ) + '</div>' +
          '</div>'
        )

        const blocks = [...waitingBlocks, ...threadBlocks]
        els.swarmThreads.innerHTML = blocks.length
          ? blocks.join('')
          : '<div class="empty-state">Sin threads de swarm todavía.</div>'
      }

      function renderSwarmControls() {
        const snapshot = state.selectedDetail?.snapshot || state.selectedSnapshot
        if (!snapshot) {
          els.swarmControls.innerHTML = '<div class="empty-state">Selecciona una sesión para ver acciones del swarm.</div>'
          return
        }

        const swarm = snapshot.swarm
        if (!swarm || (!swarm.teamName && !(swarm.teammateNames && swarm.teammateNames.length))) {
          els.swarmControls.innerHTML = [
            '<div class="summary-card">',
            '<div class="summary-kicker">Swarm</div>',
            '<div class="summary-title">Sin swarm activo</div>',
            '<div class="summary-meta">Puedes crear uno desde aquí con un atajo listo o arrancarlo desde la sesión principal.</div>',
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
            '<div class="summary-kicker">Swarm</div>',
            '<div class="summary-title">Swarm activo</div>',
            '<div class="summary-meta">' + escapeHtml(
              (swarm.teamName ? 'Team: ' + swarm.teamName + '\\n' : '') +
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
              void sendRuntimePrompt(prompt, 'Enviando acción de swarm...', 'Acción de swarm enviada.').catch(error => {
                setActionStatus(error instanceof Error ? error.message : String(error), 'error', 9000)
                addEvent('swarm_action_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
              })
            }
          })
        }
      }

      function renderEvents() {
        els.eventCount.textContent = state.events.length + ' recientes'
        if (!state.events.length) {
          els.events.innerHTML = '<div class="empty-state">Todavía no llegaron eventos.</div>'
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
          state.selectedDetail = null
          renderSelectedSession()
          renderActivity()
        }
      }

      async function refreshSelectedSession() {
        if (!state.selectedSessionId) {
          state.selectedSnapshot = null
          state.selectedDetail = null
          renderSelectedSession()
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
        if (state.selectedSessionId) {
          reconcileOptimisticMessages(state.selectedSessionId, response.detail)
        }
        renderSelectedSession()
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
          renderSelectedSession()
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

      function scheduleSelectedSessionRefresh(delay = 300) {
        if (state.refreshSelectedTimer) {
          clearTimeout(state.refreshSelectedTimer)
        }

        state.refreshSelectedTimer = setTimeout(() => {
          state.refreshSelectedTimer = null
          void refreshSelectedSession().catch(() => {})
        }, delay)
      }

      async function selectSession(sessionId) {
        state.selectedSessionId = sessionId
        await ensureSelectedSessionSubscription()
        renderSessions()
      }

      async function sendRuntimePrompt(text, pendingMessage, successMessage) {
        const normalizedText = text.trim()
        if (!state.selectedSessionId) {
          setActionStatus('No hay una sesión seleccionada para enviar el prompt.', 'error', 9000)
          return
        }

        if (!state.connected) {
          setActionStatus('No hay conexión con el runtime en este momento.', 'error', 9000)
          return
        }

        if (!normalizedText) {
          setActionStatus('Escribe un prompt antes de enviarlo.', 'error', 9000)
          return
        }

        const sessionId = state.selectedSessionId
        const optimisticMessage = {
          uuid: 'optimistic-' + crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'user',
          label: 'user',
          text: normalizedText,
          pending: true,
        }

        addOptimisticMessage(sessionId, optimisticMessage)
        renderConversation()
        state.sendingPrompt = true
        renderComposerState()
        setActionStatus(pendingMessage, 'muted', Number.POSITIVE_INFINITY)

        try {
          const response = await sendRequest('send_message', {
            sessionId,
            input: { text: normalizedText },
          })

          if (!response.ok) {
            throw new Error(response.error)
          }

          ensureSessionActivity(sessionId).notes.push('Prompt enviado desde el inspector.')
          trimActivity(ensureSessionActivity(sessionId))
          renderActivity()
          els.promptInput.value = ''
          await refreshSelectedSession().catch(() => {})
          setActionStatus(successMessage, 'success', 4000)
        } catch (error) {
          removeOptimisticMessage(sessionId, optimisticMessage.uuid)
          renderConversation()
          throw error
        } finally {
          state.sendingPrompt = false
          renderComposerState()
          els.promptInput.focus()
        }
      }

      async function sendPromptToSession() {
        const text = els.promptInput.value
        await sendRuntimePrompt(text, 'Enviando prompt al runtime...', 'Prompt enviado correctamente.')
      }

      async function interruptSelectedSession() {
        if (!state.selectedSessionId) {
          setActionStatus('No hay una sesión seleccionada para interrumpir.', 'error', 9000)
          return
        }

        if (!state.connected) {
          setActionStatus('No hay conexión con el runtime para interrumpir esta sesión.', 'error', 9000)
          return
        }

        state.interruptingSession = true
        renderComposerState()
        setActionStatus('Interrumpiendo sesión...', 'muted', Number.POSITIVE_INFINITY)

        try {
          const response = await sendRequest('interrupt', {
            sessionId: state.selectedSessionId,
          })

          if (!response.ok) {
            throw new Error(response.error)
          }

          ensureSessionActivity(state.selectedSessionId).notes.push('Interrupción enviada desde el inspector.')
          trimActivity(ensureSessionActivity(state.selectedSessionId))
          renderActivity()
          await refreshSelectedSession().catch(() => {})
          setActionStatus('Interrupción enviada correctamente.', 'success', 4000)
        } finally {
          state.interruptingSession = false
          renderComposerState()
        }
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
          } finally {
            renderComposerState()
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
              renderSelectedSession()
              renderActivity()
            }
            addEvent(message.type, message.session.sessionId, 'Snapshot inicial recibido para la sesión seleccionada.')
            return
          }

          if (message.type === 'runtime_registry_event') {
            addEvent(message.event.type, message.event.sessionId || 'runtime', JSON.stringify(message.event, null, 2))
            await refreshSessions().catch(() => {})
            if (state.selectedSessionId) {
              scheduleSelectedSessionRefresh(350)
            }
            return
          }

          if (message.type === 'runtime_session_event') {
            updateSessionActivity(message.sessionId, message.event)
            addEvent(message.event.type, message.sessionId, JSON.stringify(message.event, null, 2))
            if (message.sessionId === state.selectedSessionId) {
              scheduleSelectedSessionRefresh(300)
            }
          }
        })

        state.socket.addEventListener('close', () => {
          state.connected = false
          setBadge(els.socketDot, 'error')
          els.socketStatus.textContent = 'WebSocket desconectado'
          addEvent('socket_close', state.runtimeUrl || 'runtime', 'Conexión runtime cerrada')
          renderComposerState()
        })

        state.socket.addEventListener('error', () => {
          state.connected = false
          setBadge(els.socketDot, 'error')
          els.socketStatus.textContent = 'Error en WebSocket'
          renderComposerState()
        })
      }

      els.reconnect.addEventListener('click', () => {
        connectRuntime().catch(error => {
          addEvent('reconnect_error', 'runtime', error instanceof Error ? error.message : String(error))
        })
      })

      els.sessionSearch.addEventListener('input', () => {
        state.sessionFilter = els.sessionSearch.value
        renderSessions()
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

      els.promptInput.addEventListener('input', () => {
        renderComposerState()
      })

      els.promptForm.addEventListener('submit', event => {
        event.preventDefault()
        void sendPromptToSession().catch(error => {
          setActionStatus(error instanceof Error ? error.message : String(error), 'error', 9000)
          addEvent('send_prompt_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
        })
      })

      els.promptInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          els.promptForm.requestSubmit()
          return
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          els.promptForm.requestSubmit()
        }
      })

      els.interruptSession.addEventListener('click', () => {
        interruptSelectedSession().catch(error => {
          setActionStatus(error instanceof Error ? error.message : String(error), 'error', 9000)
          addEvent('interrupt_error', state.selectedSessionId || 'none', error instanceof Error ? error.message : String(error))
        })
      })

      for (const button of document.querySelectorAll('[data-fill-prompt]')) {
        button.addEventListener('click', () => {
          const prompt = button.getAttribute('data-fill-prompt') || ''
          els.promptInput.value = prompt
          renderComposerState()
          els.promptInput.focus()
        })
      }

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
