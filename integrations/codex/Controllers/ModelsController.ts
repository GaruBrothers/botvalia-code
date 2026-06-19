import type { CodexCompatibilityService } from '../Services/CodexCompatibilityService.js'

export class ModelsController {
  constructor(private readonly service: CodexCompatibilityService) {}

  list(): Response {
    return this.service.listModels()
  }
}
