import type { Command } from '../../commands.js'
import { hasAnthropicApiKeyAuth } from '../../utils/auth.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: hasAnthropicApiKeyAuth()
      ? 'Switch BotValia accounts'
      : 'Sign in with your BotValia account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command
