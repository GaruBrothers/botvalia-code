import type { Command } from '../../types/command.js'

const workflows: Command = {
  type: 'local',
  name: 'workflows',
  description: 'Workflow commands are unavailable in this reconstructed build',
  isEnabled: () => false,
  supportsNonInteractive: true,
  async load() {
    return {
      async call() {
        return {
          type: 'text' as const,
          value:
            'Workflow commands are unavailable in this reconstructed build.',
        }
      },
    }
  },
}

export default workflows
