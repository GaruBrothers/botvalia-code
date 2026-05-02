#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const entrypoint = resolve(here, '../src/dev-entry.ts')
const args = [entrypoint, ...process.argv.slice(2)]

const child = spawn('bun', args, {
  stdio: 'inherit',
})

child.on('exit', code => {
  process.exit(code ?? 0)
})

child.on('error', error => {
  console.error(
    `Failed to launch BotValia via Bun: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exit(1)
})
