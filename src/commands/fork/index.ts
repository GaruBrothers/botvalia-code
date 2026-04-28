import type { Command } from '../../types/command.js'

const fork: Command = {
  type: 'local',
  name: 'fork',
  description: 'Fork sub-agent commands are unavailable in this reconstructed build',
  isEnabled: () => false,
  supportsNonInteractive: true,
  async load() {
    return {
      async call() {
        return {
          type: 'text' as const,
          value:
            'Fork sub-agent commands are unavailable in this reconstructed build.',
        }
      },
    }
  },
}

export default fork
