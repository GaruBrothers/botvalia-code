/**
 * Copy command - minimal metadata only.
 * Implementation is lazy-loaded from copy.tsx to reduce startup time.
 */
import type { Command } from '../../commands.js'

const copy = {
  type: 'local-jsx',
  name: 'copy',
  description:
    'Copy the latest visible BotValia chat/command block to clipboard (or /copy N for older blocks)',
  load: () => import('./copy.js'),
} satisfies Command

export default copy
