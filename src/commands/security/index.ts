import type { Command } from '../../commands.js'

const security = {
  type: 'local',
  name: 'security',
  description: 'Run local OSS security audits and explain the current posture',
  immediate: true,
  supportsNonInteractive: true,
  load: () => import('./security.js'),
} satisfies Command

export default security
