function readAssistantModeFlag(): boolean {
  return (
    process.env.CLAUDE_CODE_ASSISTANT_MODE === '1' ||
    process.env.CLAUDE_CODE_ASSISTANT_MODE === 'true'
  )
}

let assistantForced = false

export function isAssistantMode(): boolean {
  return readAssistantModeFlag()
}

export function isAssistantModeEnabled(): boolean {
  return readAssistantModeFlag()
}

export async function initializeAssistantTeam(): Promise<undefined> {
  return undefined
}

export function markAssistantForced(): void {
  assistantForced = true
}

export function isAssistantForced(): boolean {
  return assistantForced
}

export function getAssistantSystemPromptAddendum(): string {
  return ''
}

export function getAssistantActivationPath(): string {
  return assistantForced ? 'forced' : 'disabled'
}
