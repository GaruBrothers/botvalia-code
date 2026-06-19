import type { OpenAIChatRequest } from '../Contracts/OpenAIChatRequest.js'
import type { CodexCompatibilityService } from '../Services/CodexCompatibilityService.js'

export class ChatCompletionsController {
  constructor(private readonly service: CodexCompatibilityService) {}

  async create(request: Request): Promise<Response> {
    let body: OpenAIChatRequest
    try {
      body = await request.json() as OpenAIChatRequest
    } catch {
      return Response.json(
        { error: { message: 'Invalid JSON body', type: 'invalid_request_error' } },
        { status: 400 },
      )
    }

    if (!body.model || !Array.isArray(body.messages)) {
      return Response.json(
        {
          error: {
            message: 'Request must include model and messages[]',
            type: 'invalid_request_error',
          },
        },
        { status: 400 },
      )
    }

    return this.service.chatCompletion(body, request.signal)
  }
}
