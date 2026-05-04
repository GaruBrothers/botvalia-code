import { existsSync, readFileSync } from 'fs'
import { RuntimeWebSocketClient } from '../src/runtime/runtimeWsClient.ts'
import { startRuntimeWebSocketServer } from '../src/runtime/runtimeWsServer.ts'
import {
  getAutoUpdaterDisabledReason,
  isAutoUpdaterDisabled,
} from '../src/utils/config.js'
import {
  isFeedbackSubmissionEnabledByDefaultForOSS,
  isNonEssentialTelemetryEnabledByDefaultForOSS,
  isTranscriptSharingEnabledByDefaultForOSS,
  isUpdateChecksEnabledByDefaultForOSS,
} from '../src/utils/nonEssentialEgress.js'
import { checkForReleaseNotesSync } from '../src/utils/releaseNotes.js'
import { readRuntimeLaunchConfigFromLocation } from '../BotValia-CodeUI/lib/runtime-url.ts'

type CheckResult = {
  name: string
  ok: boolean
  details: string
}

type PackageJsonShape = {
  private?: boolean
  repository?: { url?: string }
  homepage?: string
  bugs?: { url?: string }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function runCheck(name: string, ok: boolean, details: string): CheckResult {
  return { name, ok, details }
}

async function readPackageJson(): Promise<PackageJsonShape> {
  return Bun.file(new URL('../package.json', import.meta.url)).json()
}

function checkSecurityDocs(): CheckResult {
  const requiredDocs = [
    'SECURITY.md',
    'SECURITY_ROADMAP.md',
    'NETWORK_EGRESS.md',
    'SECURITY_RELEASE_CHECKLIST.md',
  ]
  const missing = requiredDocs.filter(doc => !existsSync(doc))
  return runCheck(
    'security-docs',
    missing.length === 0,
    missing.length === 0
      ? `Found ${requiredDocs.length} required security docs`
      : `Missing: ${missing.join(', ')}`,
  )
}

function checkPublicPackageMetadata(packageJson: PackageJsonShape): CheckResult {
  const repoUrl = packageJson.repository?.url ?? ''
  const homepage = packageJson.homepage ?? ''
  const bugsUrl = packageJson.bugs?.url ?? ''
  const ok =
    repoUrl.includes('github.com/GaruBrothers/botvalia-code') &&
    homepage.includes('github.com/GaruBrothers/botvalia-code') &&
    bugsUrl.includes('github.com/GaruBrothers/botvalia-code/issues')

  return runCheck(
    'public-package-metadata',
    ok,
    ok
      ? 'Repository, homepage, and bugs metadata point to BotValia'
      : `Unexpected metadata: repo=${repoUrl} homepage=${homepage} bugs=${bugsUrl}`,
  )
}

function checkDirectDependencyRanges(packageJson: PackageJsonShape): CheckResult {
  const offenders = [
    ...Object.entries(packageJson.dependencies ?? {}),
    ...Object.entries(packageJson.devDependencies ?? {}),
  ]
    .filter(([, version]) => version.includes('*'))
    .map(([name, version]) => `${name}@${version}`)

  return runCheck(
    'direct-dependency-ranges',
    offenders.length === 0,
    offenders.length === 0
      ? 'No direct dependency or devDependency uses wildcard ranges'
      : `Wildcard ranges still present: ${offenders.join(', ')}`,
  )
}

function checkLockfileAndPrivateFlag(packageJson: PackageJsonShape): CheckResult {
  const hasLockfile = existsSync('bun.lock')
  const privateFlag = packageJson.private === true
  const ok = hasLockfile && privateFlag

  return runCheck(
    'lockfile-and-private-flag',
    ok,
    JSON.stringify({
      hasLockfile,
      private: packageJson.private === true,
    }),
  )
}

function checkGeneratedArtifactPolicy(): CheckResult {
  const gitignore = readFileSync('.gitignore', 'utf8')
  const requiredPatterns = [
    'BotValia-CodeUI/.next/',
    'BotValia-CodeUI/.runtime-next/',
  ]
  const missing = requiredPatterns.filter(pattern => !gitignore.includes(pattern))

  return runCheck(
    'generated-artifact-policy',
    missing.length === 0,
    missing.length === 0
      ? 'Generated Next/runtime artifacts are covered by .gitignore policy'
      : `Missing .gitignore patterns: ${missing.join(', ')}`,
  )
}

function checkOssSafeDefaults(): CheckResult {
  const feedbackEnabled = isFeedbackSubmissionEnabledByDefaultForOSS()
  const transcriptEnabled = isTranscriptSharingEnabledByDefaultForOSS()
  const telemetryEnabled = isNonEssentialTelemetryEnabledByDefaultForOSS()
  const updatesEnabled = isUpdateChecksEnabledByDefaultForOSS()
  const autoUpdaterDisabled = isAutoUpdaterDisabled()
  const autoUpdaterReason = getAutoUpdaterDisabledReason()
  const releaseNotesSync = checkForReleaseNotesSync(null, '0.0.0-test')

  const ok =
    !feedbackEnabled &&
    !transcriptEnabled &&
    !telemetryEnabled &&
    !updatesEnabled &&
    autoUpdaterDisabled &&
    autoUpdaterReason?.type === 'oss-safe' &&
    releaseNotesSync.hasReleaseNotes === false

  return runCheck(
    'oss-safe-defaults',
    ok,
    JSON.stringify({
      feedbackEnabled,
      transcriptEnabled,
      telemetryEnabled,
      updatesEnabled,
      autoUpdaterDisabled,
      autoUpdaterReason,
      releaseNotesSync,
    }),
  )
}

async function checkRuntimeAuth(): Promise<CheckResult> {
  const server = await startRuntimeWebSocketServer()
  let runtimeAuthWorks = false

  try {
    const authenticatedClient = new RuntimeWebSocketClient(server.url)
    await authenticatedClient.connect()
    await authenticatedClient.close()

    const unauthenticatedUrl = new URL(server.url)
    unauthenticatedUrl.searchParams.delete('runtimeToken')

    try {
      const unauthenticatedClient = new RuntimeWebSocketClient(
        unauthenticatedUrl.toString(),
      )
      await unauthenticatedClient.connect()
      await unauthenticatedClient.close()
      runtimeAuthWorks = false
    } catch {
      runtimeAuthWorks = true
    }
  } finally {
    await server.stop()
  }

  return runCheck(
    'runtime-websocket-auth',
    runtimeAuthWorks,
    JSON.stringify({ runtimeAuthWorks }),
  )
}

function checkRuntimeLaunchParsing(): CheckResult {
  const config = readRuntimeLaunchConfigFromLocation({
    search: `?runtime=${encodeURIComponent('ws://127.0.0.1:9000/botvalia-runtime')}`,
    hash: '#runtimeToken=secret-token',
  })

  const ok =
    config.runtimeUrl === 'ws://127.0.0.1:9000/botvalia-runtime' &&
    config.runtimeAuthToken === 'secret-token'

  return runCheck(
    'runtime-launch-parsing',
    ok,
    JSON.stringify(config),
  )
}

async function main() {
  const packageJson = await readPackageJson()
  const results: CheckResult[] = [
    checkSecurityDocs(),
    checkPublicPackageMetadata(packageJson),
    checkDirectDependencyRanges(packageJson),
    checkLockfileAndPrivateFlag(packageJson),
    checkGeneratedArtifactPolicy(),
    checkOssSafeDefaults(),
    await checkRuntimeAuth(),
    checkRuntimeLaunchParsing(),
  ]

  for (const result of results) {
    const prefix = result.ok ? '[PASS]' : '[FAIL]'
    console.log(`${prefix} ${result.name}: ${result.details}`)
  }

  const failed = results.filter(result => !result.ok)
  if (failed.length > 0) {
    console.error(
      `\nSecurity preflight failed: ${failed.length} check(s) did not pass.`,
    )
    process.exit(1)
  }

  console.log(`\nSecurity preflight passed: ${results.length} checks OK.`)
}

await main()
