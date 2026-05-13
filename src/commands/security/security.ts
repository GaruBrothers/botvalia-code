import type { LocalCommandCall } from '../../types/command.js'
import {
  formatSecurityPreflightAudit,
  runSecurityPreflightAudit,
} from '../../runtime/securityAudit.js'

const HELP_TEXT = [
  '/security audit ejecuta el gate OSS local (`security:preflight`).',
  '/security help muestra esta ayuda.',
].join('\n')

export const call: LocalCommandCall = async args => {
  try {
    const [subcommand = 'audit'] = args.trim().split(/\s+/).filter(Boolean)
    const normalizedSubcommand = subcommand.toLowerCase()

    if (normalizedSubcommand === 'audit' || normalizedSubcommand === '') {
      const audit = runSecurityPreflightAudit()
      return {
        type: 'text',
        value: formatSecurityPreflightAudit(audit),
      }
    }

    if (normalizedSubcommand === 'help' || normalizedSubcommand === '?') {
      return {
        type: 'text',
        value: HELP_TEXT,
      }
    }

    return {
      type: 'text',
      value: `Subcomando desconocido: ${subcommand}\n\n${HELP_TEXT}`,
    }
  } catch (error) {
    return {
      type: 'text',
      value:
        error instanceof Error
          ? `No pude ejecutar /security: ${error.message}`
          : 'No pude ejecutar /security por un error desconocido.',
    }
  }
}
