import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'
import { getMainLoopModel, renderModelName } from '../../utils/model/model.js'

export default {
  type: 'local-jsx',
  name: 'model',
  get description() {
    return `Set the AI model for BotValia Code (currently ${renderModelName(getMainLoopModel())})`
  },
  argumentHint:
    '[audit|update|auto-all|auto-openrouter|auto-ollama|manual|RUTA]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./model.js'),
} satisfies Command
