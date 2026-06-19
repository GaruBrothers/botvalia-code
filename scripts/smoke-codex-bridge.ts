import { startCodexBridge } from '../integrations/codex/Extensions/CodexIntegrationExtensions.js'
import type { BotValiaRunner } from '../integrations/codex/Services/CodexCompatibilityService.js'

const mockRunner: BotValiaRunner = async function* () {
  yield {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'pong' },
    },
  }
  yield {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: 'pong' }],
      stop_reason: 'end_turn',
    },
  }
  yield {
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'pong',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 3,
      output_tokens: 1,
    },
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main(): Promise<void> {
  const server = await startCodexBridge({
    port: 0,
    authToken: 'test-token',
    model: 'botvalia-smart',
    runnerCommand: 'mock',
    runnerArgs: [],
  }, mockRunner)

  try {
    const health = await fetch(`${server.url}/health`, {
      headers: { authorization: 'Bearer test-token' },
    })
    assert(health.status === 200, `health status ${health.status}`)

    const unauthorized = await fetch(`${server.url}/v1/models`)
    assert(unauthorized.status === 401, `auth status ${unauthorized.status}`)

    const models = await fetch(`${server.url}/v1/models`, {
      headers: { authorization: 'Bearer test-token' },
    }).then(response => response.json() as Promise<{ data: Array<{ id: string }> }>)
    assert(models.data.some(model => model.id === 'botvalia-smart'), 'missing botvalia-smart model')

    const chat = await fetch(`${server.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'botvalia-smart',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }).then(response => response.json() as Promise<{ choices: Array<{ message: { content: string } }> }>)
    assert(chat.choices[0]?.message.content === 'pong', 'non-streaming response mismatch')

    const streamResponse = await fetch(`${server.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'botvalia-smart',
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    const streamText = await streamResponse.text()
    assert(streamText.includes('chat.completion.chunk'), 'stream chunk missing')
    assert(streamText.includes('[DONE]'), 'stream done marker missing')

    // biome-ignore lint/suspicious/noConsole:: smoke output
    console.log('codex bridge smoke ok')
  } finally {
    await server.stop()
  }
}

await main()
