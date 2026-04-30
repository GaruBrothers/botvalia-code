export const AGENT_PATHS = {
  FOLDER_NAME: '.claude',
  AGENTS_DIR: 'agents',
  project: '.claude/agents',
  user: '~/.claude/agents',
} as const

export type ModeState = string
