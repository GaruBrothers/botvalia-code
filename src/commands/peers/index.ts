import type { Command } from '../../types/command.js'

const peers: Command = {
  type: 'local',
  name: 'peers',
  description: 'Peer inbox commands are unavailable in this reconstructed build',
  isEnabled: () => false,
  supportsNonInteractive: true,
  async load() {
    return {
      async call() {
        return {
          type: 'text' as const,
          value:
            'Peer inbox commands are unavailable in this reconstructed build.',
        }
      },
    }
  },
}

export default peers
