import type { Command } from '../../commands.js'

const runtime = {
  type: 'local',
  name: 'runtime',
  aliases: ['desktop-runtime'],
  description: 'Start, inspect, or stop the local BotValia Desktop runtime bridge',
  immediate: true,
  supportsNonInteractive: true,
  load: () => import('./runtime.js'),
} satisfies Command

export default runtime
