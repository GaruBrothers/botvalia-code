import type { Command } from '../../commands.js'

const swarm = {
  type: 'local-jsx',
  name: 'swarm',
  description: 'Inspect and steer live swarm teammates',
  immediate: true,
  load: () => import('./swarm.js'),
} satisfies Command

export default swarm
