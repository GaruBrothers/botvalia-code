import type { Command } from '../../types/command.js'

const buddy: Command = {
  type: 'local',
  name: 'buddy',
  description: 'Buddy commands are unavailable in this reconstructed build',
  isEnabled: () => false,
  supportsNonInteractive: true,
  async load() {
    return {
      async call() {
        return {
          type: 'text' as const,
          value: 'Buddy commands are unavailable in this reconstructed build.',
        }
      },
    }
  },
}

export default buddy
