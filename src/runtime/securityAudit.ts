import { TextDecoder } from 'util'
import { fileURLToPath } from 'url'

export type SecurityPreflightSummary = {
  pass: number
  warn: number
  fail: number
}

export type SecurityPreflightCheckResult = {
  name: string
  level: 'pass' | 'warn' | 'fail'
  details: string
}

export type SecurityPreflightAudit = {
  exitCode: number
  summary: SecurityPreflightSummary
  results: SecurityPreflightCheckResult[]
  inventory: {
    source: 'git' | 'filesystem-fallback'
    note: string | null
    trackedFileCount: number
    scannedTextFileCount: number
  }
  stderr: string
}

const decoder = new TextDecoder()
const SECURITY_PREFLIGHT_PATH = fileURLToPath(
  new URL('../../scripts/security-preflight.ts', import.meta.url),
)
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))

function summarizeChecks(
  results: SecurityPreflightCheckResult[],
  level: SecurityPreflightCheckResult['level'],
): string {
  const selected = results.filter(result => result.level === level)
  if (selected.length === 0) {
    return 'none'
  }

  return selected
    .slice(0, 6)
    .map(result => result.name)
    .join(', ')
}

export function runSecurityPreflightAudit(): SecurityPreflightAudit {
  const result = Bun.spawnSync({
    cmd: [process.execPath, 'run', SECURITY_PREFLIGHT_PATH, '--json'],
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = decoder.decode(result.stdout).trim()
  const stderr = decoder.decode(result.stderr).trim()

  if (result.exitCode === null) {
    throw new Error('security:preflight terminó sin exit code.')
  }

  if (!stdout) {
    throw new Error(
      stderr || 'security:preflight no produjo salida JSON legible.',
    )
  }

  let parsed: Omit<SecurityPreflightAudit, 'exitCode' | 'stderr'>

  try {
    parsed = JSON.parse(stdout) as Omit<SecurityPreflightAudit, 'exitCode' | 'stderr'>
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `No pude parsear la salida JSON de security:preflight: ${error.message}`
        : 'No pude parsear la salida JSON de security:preflight.',
    )
  }

  return {
    exitCode: result.exitCode,
    summary: parsed.summary,
    results: parsed.results,
    inventory: parsed.inventory,
    stderr,
  }
}

export function formatSecurityPreflightAudit(
  audit: SecurityPreflightAudit,
): string {
  const status =
    audit.exitCode === 0
      ? 'Security preflight en estado PASS.'
      : 'Security preflight detectó riesgos bloqueantes.'

  const warnChecks = summarizeChecks(audit.results, 'warn')
  const failChecks = summarizeChecks(audit.results, 'fail')
  const detailLines = [
    status,
    `Resumen: ${audit.summary.pass} pass, ${audit.summary.warn} warn, ${audit.summary.fail} fail.`,
    `Inventario: ${audit.inventory.trackedFileCount} archivos rastreados, ${audit.inventory.scannedTextFileCount} archivos tipo texto, source=${audit.inventory.source}.`,
  ]

  if (audit.inventory.note) {
    detailLines.push(`Inventario note: ${audit.inventory.note}`)
  }

  detailLines.push(`Warnings: ${warnChecks}`)
  detailLines.push(`Fails: ${failChecks}`)

  if (audit.stderr) {
    detailLines.push(`stderr: ${audit.stderr}`)
  }

  return detailLines.join('\n')
}
