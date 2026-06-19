import { loadCodexOptions, type CodexBridgeCliOptions, type CodexOptions } from '../Configuration/CodexOptions.js'
import { ChatCompletionsController } from '../Controllers/ChatCompletionsController.js'
import { ModelsController } from '../Controllers/ModelsController.js'
import { ResponsesController } from '../Controllers/ResponsesController.js'
import { CodexCompatibilityService, type BotValiaRunner } from '../Services/CodexCompatibilityService.js'

export type CodexBridgeServer = {
  url: string
  stop: () => Promise<void>
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-allow-headers', 'authorization, content-type')
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function isAuthorized(request: Request, options: CodexOptions): boolean {
  if (!options.authToken) return true
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${options.authToken}`
}

export async function startCodexBridge(
  cliOptions: CodexBridgeCliOptions = {},
  runner?: BotValiaRunner,
): Promise<CodexBridgeServer> {
  const options = loadCodexOptions(cliOptions)
  if (!options.enabled) {
    throw new Error('Codex bridge is disabled by settings')
  }

  const service = new CodexCompatibilityService(options, runner)
  const models = new ModelsController(service)
  const chat = new ChatCompletionsController(service)
  const responses = new ResponsesController(service)

  const server = Bun.serve({
    hostname: options.host,
    port: options.port,
    async fetch(request) {
      const url = new URL(request.url)
      const timestamp = new Date().toISOString()

      if (request.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }))
      }

      // biome-ignore lint/suspicious/noConsole:: CLI command status output
      console.log(`[${timestamp}] [Codex Bridge] Incoming request: ${request.method} ${url.pathname}`)

      if (!isAuthorized(request, options)) {
        // biome-ignore lint/suspicious/noConsole:: CLI command status output
        console.warn(`[${timestamp}] [Codex Bridge] Unauthorized request to ${url.pathname}`)
        return withCors(service.responseMapper.errorResponse('Unauthorized', 401))
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        // biome-ignore lint/suspicious/noConsole:: CLI command status output
        console.log(`[${timestamp}] [Codex Bridge] Health check: OK`)
        return withCors(Response.json({
          status: 'ok',
          service: 'botvalia-codex-bridge',
          model: options.virtualModel,
        }))
      }

      if (request.method === 'GET' && url.pathname === '/v1/models') {
        // biome-ignore lint/suspicious/noConsole:: CLI command status output
        console.log(`[${timestamp}] [Codex Bridge] Listing models`)
        return withCors(models.list())
      }

      if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
        return withCors(await chat.create(request))
      }

      // OpenAI Responses API — used by Codex CLI v0.120+
      if (request.method === 'POST' && url.pathname === '/v1/responses') {
        return withCors(await responses.create(request))
      }

      // biome-ignore lint/suspicious/noConsole:: CLI command status output
      console.warn(`[${timestamp}] [Codex Bridge] Route not found: ${request.method} ${url.pathname}`)
      return withCors(Response.json(
        { error: { message: `Route not found: ${request.method} ${url.pathname}`, type: 'not_found' } },
        { status: 404 },
      ))
    },
  })

  const url = `http://${options.host}:${server.port}`
  return {
    url,
    stop: async () => {
      server.stop(true)
    },
  }
}

export async function runCodexBridgeCommand(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCodexBridgeArgs(args)
  const server = await startCodexBridge(options)
  // biome-ignore lint/suspicious/noConsole:: CLI command status output
  console.log(`BotValia Codex Compatibility Bridge listening on ${server.url}`)
  // biome-ignore lint/suspicious/noConsole:: CLI command status output
  console.log(`OpenAI-compatible base URL: ${server.url}/v1`)
  await new Promise<void>(resolve => {
    const stop = async () => {
      await server.stop()
      resolve()
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}

function parseCodexBridgeArgs(args: string[]): CodexBridgeCliOptions {
  const bridgeIndex = args.indexOf('codex-bridge')
  const relevant = bridgeIndex >= 0 ? args.slice(bridgeIndex + 1) : args
  const options: CodexBridgeCliOptions = {}
  for (let index = 0; index < relevant.length; index++) {
    const arg = relevant[index]
    const next = relevant[index + 1]
    if (arg === '--host' && next) {
      options.host = next
      index++
    } else if (arg === '--port' && next) {
      options.port = Number.parseInt(next, 10)
      index++
    } else if (arg === '--auth-token' && next) {
      options.authToken = next
      index++
    } else if (arg === '--model' && next) {
      options.model = next
      index++
    } else if (arg === '--strategy' && next) {
      options.strategy = next
      index++
    } else if (arg === '--allow-tools') {
      options.allowTools = true
    }
  }
  return options
}
