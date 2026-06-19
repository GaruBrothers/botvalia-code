import { getInitialSettings } from 'src/utils/settings/settings.js'
import type { SettingsJson } from 'src/utils/settings/types.js'

export type CodexBridgeModelConfig = {
  id: string
  route?: string
  strategy?: string
  description?: string
}

export type CodexBridgeCliOptions = {
  host?: string
  port?: number
  authToken?: string
  model?: string
  strategy?: string
  enabled?: boolean
  allowTools?: boolean
  runnerCommand?: string
  runnerArgs?: string[]
  cwd?: string
}

export type CodexOptions = {
  enabled: boolean
  host: string
  port: number
  authToken?: string
  virtualModel: string
  defaultStrategy: string
  allowTools: boolean
  requestTimeoutMs: number
  runnerCommand: string
  runnerArgs: string[]
  cwd: string
  models: CodexBridgeModelConfig[]
}

type SettingsWithCodexBridge = SettingsJson & {
  codexBridge?: Partial<CodexOptions> & {
    models?: CodexBridgeModelConfig[]
  }
}

function envTruthy(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  return value !== '' && value !== '0' && value.toLowerCase() !== 'false'
}

function envInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseRunnerArgs(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      return parsed
    }
  } catch {
    // Fall through to whitespace splitting for simple local use.
  }
  return raw.split(/\s+/).filter(Boolean)
}

export function loadCodexOptions(cli: CodexBridgeCliOptions = {}): CodexOptions {
  const settings = getInitialSettings() as SettingsWithCodexBridge
  const configured = settings.codexBridge ?? {}
  const virtualModel =
    cli.model ||
    process.env.BOTVALIA_CODEX_BRIDGE_MODEL ||
    configured.virtualModel ||
    'botvalia-smart'
  const defaultStrategy =
    cli.strategy ||
    process.env.BOTVALIA_CODEX_BRIDGE_STRATEGY ||
    configured.defaultStrategy ||
    'coding'

  const models = configured.models?.length
    ? configured.models
    : [
        {
          id: virtualModel,
          strategy: defaultStrategy,
          route: 'auto-openrouter',
          description: 'BotValia smart virtual model',
        },
        { id: 'botvalia-coding', strategy: 'coding', route: 'auto-openrouter' },
        { id: 'botvalia-architecture', strategy: 'architecture', route: 'auto-openrouter' },
        { id: 'botvalia-cheap', strategy: 'cheap', route: 'openrouter::google/gemma-3-4b-it:free' },
        { id: 'botvalia-free', strategy: 'free', route: 'openrouter::openrouter/free' },
        { id: 'botvalia-local', strategy: 'local', route: 'auto-ollama' },
        { id: 'botvalia-reasoning', strategy: 'reasoning', route: 'openrouter::deepseek/deepseek-r1:free' },
        { id: 'botvalia-dotnet', strategy: 'coding', route: 'auto-openrouter' },
        { id: 'botvalia-fullstack', strategy: 'coding', route: 'auto-openrouter' },
        { id: 'botvalia-python', strategy: 'coding', route: 'auto-openrouter' },
      ]

  return {
    enabled:
      cli.enabled ??
      envTruthy(process.env.BOTVALIA_CODEX_BRIDGE_ENABLED) ??
      configured.enabled ??
      true,
    host:
      cli.host ||
      process.env.BOTVALIA_CODEX_BRIDGE_HOST ||
      configured.host ||
      '127.0.0.1',
    port:
      cli.port ||
      envInt(process.env.BOTVALIA_CODEX_BRIDGE_PORT) ||
      configured.port ||
      5008,
    authToken:
      cli.authToken ||
      process.env.BOTVALIA_CODEX_BRIDGE_AUTH_TOKEN ||
      configured.authToken,
    virtualModel,
    defaultStrategy,
    allowTools:
      cli.allowTools ??
      envTruthy(process.env.BOTVALIA_CODEX_BRIDGE_ALLOW_TOOLS) ??
      configured.allowTools ??
      false,
    requestTimeoutMs:
      envInt(process.env.BOTVALIA_CODEX_BRIDGE_TIMEOUT_MS) ||
      configured.requestTimeoutMs ||
      600_000,
    runnerCommand:
      cli.runnerCommand ||
      process.env.BOTVALIA_CODEX_BRIDGE_RUNNER_COMMAND ||
      configured.runnerCommand ||
      process.execPath,
    runnerArgs:
      cli.runnerArgs ||
      parseRunnerArgs(process.env.BOTVALIA_CODEX_BRIDGE_RUNNER_ARGS) ||
      configured.runnerArgs || ['run', './src/dev-entry.ts'],
    cwd: cli.cwd || configured.cwd || process.cwd(),
    models,
  }
}
