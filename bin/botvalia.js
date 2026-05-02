#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const autoLauncher = resolve(here, '../scripts/dev-auto.ps1')
const userArgs = process.argv.slice(2)
const isVersionOnly =
  userArgs.length === 1 &&
  (userArgs[0] === '--version' || userArgs[0] === '-v' || userArgs[0] === '-V')

const args = [
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  autoLauncher,
  '-Preset',
  'auto-all',
  '-ExtraArgsJson',
  JSON.stringify(userArgs),
]

if (isVersionOnly) {
  args.splice(args.length - 2, 2)
  args.push('-VersionOnly')
}

const child = spawn('powershell', args, {
  env: {
    ...process.env,
    BOTVALIA_AUTO_QUIET: '1',
    BOTVALIA_FORCE_CONDENSED_LOGO: '1',
  },
  stdio: 'inherit',
})

child.on('exit', code => {
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error(
    `Failed to launch BotValia auto preset: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
