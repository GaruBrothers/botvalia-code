import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { extname } from 'path'

type CheckLevel = 'pass' | 'warn' | 'fail'

type CliOptions = {
  outputJson: boolean
  strictMode: boolean
  noGit: boolean
  help: boolean
  maxTextBytes: number
}

type CheckResult = {
  name: string
  level: CheckLevel
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

type PreflightSummary = {
  pass: number
  warn: number
  fail: number
}

type RepositoryFileInventory = {
  files: string[]
  source: 'git' | 'filesystem-fallback'
  note?: string
}

const DEFAULT_MAX_TEXT_BYTES = 1_500_000

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.md',
  '.ps1',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
  '.xml',
])

const EXACT_TEXT_FILENAMES = new Set([
  '.gitignore',
  '.npmrc',
  'AGENTS.md',
  'BASE.md',
  'CLAUDE.md',
  'LICENSE',
  'LICENSE.md',
  'README',
  'README.md',
])

const TRACKED_BUILD_ARTIFACT_PATTERNS = [
  'BotValia-CodeUI/.next/',
  'BotValia-CodeUI/.runtime-next/',
  'BotValia-CodeUI/.swc/',
  'BotValia-CodeUI/.vercel/',
  'BotValia-CodeUI/out/',
  'dist/',
  'coverage/',
]

const TRACKED_SENSITIVE_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.[^.]+$/i,
  /^\.npmrc$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.crt$/i,
  /\.cer$/i,
  /\.der$/i,
  /\.csr$/i,
  /\.sqlite3?$/i,
  /\.db$/i,
  /\.session\.json$/i,
  /server-sessions\.json$/i,
]

const HIGH_CONFIDENCE_SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'private-key-block',
    pattern: /-----BEGIN [A-Z0-9 _-]*PRIVATE KEY-----/,
  },
  {
    name: 'aws-access-key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'github-token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/,
  },
  {
    name: 'github-pat',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'slack-bot-token',
    pattern: /\bxoxb-[A-Za-z0-9-]{20,}\b/,
  },
  {
    name: 'openai-style-key',
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/,
  },
]

const LEGACY_CLOUD_ENDPOINT_PATTERNS = [
  'api.anthropic.com',
  'platform.claude.com',
  'claude.ai',
  'mcp-proxy.anthropic.com',
]

const WALK_IGNORE_NAMES = new Set([
  '.botvalia',
  '.git',
  'node_modules',
  '.next',
  '.runtime-next',
  '.swc',
  '.vercel',
  'coverage',
  'dist',
  'out',
])

const decoder = new TextDecoder()

function createResult(
  name: string,
  level: CheckLevel,
  details: string,
): CheckResult {
  return { name, level, details }
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function safeReadUtf8(path: string): string | null {
  try {
    const content = readFileSync(path, 'utf8')
    if (content.includes('\u0000')) {
      return null
    }
    return content
  } catch {
    return null
  }
}

function safeFileSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

function summarizeList(items: string[], limit = 8): string {
  if (items.length === 0) {
    return 'none'
  }

  const visible = items.slice(0, limit)
  const remaining = items.length - visible.length
  return remaining > 0
    ? `${visible.join(', ')} (+${remaining} more)`
    : visible.join(', ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePositiveInteger(rawValue: string, flagName: string): number {
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${flagName} expects a positive integer, received "${rawValue}".`)
  }

  const parsed = Number(rawValue)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive safe integer.`)
  }

  return parsed
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputJson: false,
    strictMode: false,
    noGit: false,
    help: false,
    maxTextBytes: DEFAULT_MAX_TEXT_BYTES,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--json') {
      options.outputJson = true
      continue
    }

    if (argument === '--strict') {
      options.strictMode = true
      continue
    }

    if (argument === '--no-git') {
      options.noGit = true
      continue
    }

    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    if (argument.startsWith('--max-bytes=')) {
      options.maxTextBytes = parsePositiveInteger(
        argument.slice('--max-bytes='.length),
        '--max-bytes',
      )
      continue
    }

    if (argument === '--max-bytes') {
      const nextValue = argv[index + 1]
      if (!nextValue) {
        throw new Error('--max-bytes expects a value.')
      }
      options.maxTextBytes = parsePositiveInteger(nextValue, '--max-bytes')
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function printHelp() {
  console.log(
    [
      'Usage: bun ./scripts/security-preflight.ts [flags]',
      '',
      'Offline OSS release hygiene checks for this repository.',
      '',
      'Flags:',
      '  --json              Print machine-readable JSON output.',
      '  --strict            Treat warnings as a failing exit code.',
      '  --no-git            Skip git spawning and use filesystem fallback only.',
      `  --max-bytes <n>     Max text file size to scan (default: ${DEFAULT_MAX_TEXT_BYTES}).`,
      '  --help, -h          Show this help text.',
    ].join('\n'),
  )
}

function runGit(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  let result: ReturnType<typeof Bun.spawnSync>
  try {
    result = Bun.spawnSync({
      cmd: ['git', ...args],
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown Bun.spawnSync failure'
    return {
      ok: false,
      stdout: '',
      stderr: message,
    }
  }

  return {
    ok: result.exitCode === 0,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  }
}

function listTrackedFiles(): string[] {
  const result = runGit(['ls-files', '-z'])
  if (!result.ok) {
    throw new Error(`git ls-files failed: ${result.stderr || 'unknown error'}`)
  }

  return result.stdout.split('\0').filter(Boolean)
}

function walkRepositoryFiles(root = '.'): string[] {
  const queue = [root]
  const files: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    let entries: ReturnType<typeof readdirSync>

    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (WALK_IGNORE_NAMES.has(entry.name)) {
        continue
      }

      const fullPath = current === '.' ? entry.name : `${current}/${entry.name}`
      if (entry.isDirectory()) {
        queue.push(fullPath)
        continue
      }

      files.push(fullPath.replace(/\\/g, '/'))
    }
  }

  return files.sort()
}

function listRepositoryFiles(options: CliOptions): RepositoryFileInventory {
  if (options.noGit) {
    return {
      files: walkRepositoryFiles(),
      source: 'filesystem-fallback',
      note: 'git inventory disabled by --no-git',
    }
  }

  try {
    return {
      files: listTrackedFiles(),
      source: 'git',
    }
  } catch (error) {
    return {
      files: walkRepositoryFiles(),
      source: 'filesystem-fallback',
      note:
        error instanceof Error
          ? `git inventory unavailable: ${error.message}`
          : 'git inventory unavailable',
    }
  }
}

function readWorkingTreeStatus(): string[] {
  let result: { ok: boolean; stdout: string; stderr: string }

  try {
    result = runGit(['status', '--porcelain'])
  } catch (error) {
    return [
      `git status unavailable: ${error instanceof Error ? error.message : 'spawn failed'}`,
    ]
  }

  if (!result.ok) {
    return [`git status failed: ${result.stderr || 'unknown error'}`]
  }

  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
}

function isTextLikeTrackedFile(path: string): boolean {
  const filename = path.split('/').at(-1) ?? path
  if (EXACT_TEXT_FILENAMES.has(filename)) {
    return true
  }

  return TEXT_FILE_EXTENSIONS.has(extname(path).toLowerCase())
}

function readTrackedTextFiles(
  trackedFiles: string[],
  options: CliOptions,
): Array<{ path: string; content: string }> {
  const textFiles: Array<{ path: string; content: string }> = []

  for (const path of trackedFiles) {
    if (!isTextLikeTrackedFile(path)) {
      continue
    }

    if (safeFileSize(path) > options.maxTextBytes) {
      continue
    }

    const content = safeReadUtf8(path)
    if (content === null) {
      continue
    }

    textFiles.push({ path, content })
  }

  return textFiles
}

function checkSecurityDocs(): CheckResult {
  const requiredDocs = [
    'SECURITY.md',
    'SECURITY_ROADMAP.md',
    'NETWORK_EGRESS.md',
    'SECURITY_RELEASE_CHECKLIST.md',
  ]
  const missing = requiredDocs.filter(doc => !existsSync(doc))

  return createResult(
    'security-docs',
    missing.length === 0 ? 'pass' : 'fail',
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

  return createResult(
    'public-package-metadata',
    ok ? 'pass' : 'fail',
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
    .filter(([, version]) =>
      /^\*$|^latest$|^x$|^\^?\*$|^\^?x$/i.test(version.trim()),
    )
    .map(([name, version]) => `${name}@${version}`)

  return createResult(
    'direct-dependency-ranges',
    offenders.length === 0 ? 'pass' : 'fail',
    offenders.length === 0
      ? 'No direct dependency or devDependency uses wildcard/latest/x ranges'
      : `Unsafe direct ranges: ${offenders.join(', ')}`,
  )
}

function checkLockfileAndPrivateFlag(packageJson: PackageJsonShape): CheckResult {
  const hasLockfile = existsSync('bun.lock')
  const privateFlag = packageJson.private === true
  const ok = hasLockfile && privateFlag

  return createResult(
    'lockfile-and-private-flag',
    ok ? 'pass' : 'fail',
    JSON.stringify({
      hasLockfile,
      private: privateFlag,
    }),
  )
}

function checkGeneratedArtifactPolicy(): CheckResult {
  const gitignore = safeReadUtf8('.gitignore') ?? ''
  const missing = [
    'BotValia-CodeUI/.next/',
    'BotValia-CodeUI/.runtime-next/',
    'BotValia-CodeUI/.swc/',
    'BotValia-CodeUI/.vercel/',
    'BotValia-CodeUI/out/',
    'coverage/',
    '*.tgz',
  ].filter(pattern => !gitignore.includes(pattern))

  return createResult(
    'generated-artifact-policy',
    missing.length === 0 ? 'pass' : 'fail',
    missing.length === 0
      ? 'Generated artifacts are covered by .gitignore policy'
      : `Missing .gitignore patterns: ${missing.join(', ')}`,
  )
}

function checkTrackedBuildArtifacts(trackedFiles: string[]): CheckResult {
  const offenders = trackedFiles.filter(path => {
    if (path.endsWith('.tgz')) {
      return true
    }

    return TRACKED_BUILD_ARTIFACT_PATTERNS.some(pattern => path.startsWith(pattern))
  })

  return createResult(
    'tracked-build-artifacts',
    offenders.length === 0 ? 'pass' : 'fail',
    offenders.length === 0
      ? 'No tracked build artifacts matched denylist patterns'
      : `Tracked build artifacts found: ${summarizeList(offenders)}`,
  )
}

function checkTrackedSensitiveFilenames(trackedFiles: string[]): CheckResult {
  const offenders = trackedFiles.filter(path => {
    const filename = path.split('/').at(-1) ?? path

    if (/\.env\.example$/i.test(filename)) {
      return false
    }

    return TRACKED_SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(filename))
  })

  return createResult(
    'tracked-sensitive-filenames',
    offenders.length === 0 ? 'pass' : 'fail',
    offenders.length === 0
      ? 'No tracked filename looks like a secret, cert, key, database, or session dump'
      : `Sensitive-looking tracked files: ${summarizeList(offenders)}`,
  )
}

function checkHighConfidenceSecrets(
  trackedTextFiles: Array<{ path: string; content: string }>,
): CheckResult {
  const matches: string[] = []

  for (const file of trackedTextFiles) {
    for (const candidate of HIGH_CONFIDENCE_SECRET_PATTERNS) {
      if (candidate.pattern.test(file.content)) {
        matches.push(`${file.path} (${candidate.name})`)
      }
    }
  }

  return createResult(
    'high-confidence-secrets',
    matches.length === 0 ? 'pass' : 'fail',
    matches.length === 0
      ? 'No high-confidence secret patterns found in tracked text files'
      : `High-confidence secret patterns found: ${summarizeList(matches)}`,
  )
}

function getLocalPathPatterns(): RegExp[] {
  const cwd = process.cwd().replace(/\\/g, '/')
  const escapedSlashCwd = escapeRegExp(cwd)
  const escapedBackslashCwd = escapeRegExp(cwd.replace(/\//g, '\\'))
  const userHomeMatch = cwd.match(/^([A-Za-z]:\/Users\/[^/]+)(?:\/|$)/i)
  const patterns = [
    new RegExp(escapedSlashCwd, 'i'),
    new RegExp(escapedBackslashCwd, 'i'),
  ]

  if (userHomeMatch) {
    const homePrefix = userHomeMatch[1]
    const escapedSlashHomePrefix = escapeRegExp(homePrefix)
    const escapedBackslashHomePrefix = escapeRegExp(
      homePrefix.replace(/\//g, '\\'),
    )
    patterns.push(
      new RegExp(`${escapedSlashHomePrefix}(?:/|$)`, 'i'),
      new RegExp(`${escapedBackslashHomePrefix}(?:\\\\|$)`, 'i'),
      new RegExp(`/${escapedSlashHomePrefix}(?:/|$)`, 'i'),
    )
  }

  return patterns
}

function checkLocalPathLeaks(
  trackedTextFiles: Array<{ path: string; content: string }>,
): CheckResult {
  const localPathPatterns = getLocalPathPatterns()
  const matches = trackedTextFiles
    .filter(file =>
      localPathPatterns.some(pattern => pattern.test(file.content)),
    )
    .map(file => file.path)

  return createResult(
    'local-path-leaks',
    matches.length === 0 ? 'pass' : 'warn',
    matches.length === 0
      ? 'No obvious maintainer-local absolute paths found in tracked text files'
      : `Tracked files reference maintainer-local absolute paths: ${summarizeList(matches)}`,
  )
}

function checkOssSafeDefaultsStatic(): CheckResult {
  const egress = safeReadUtf8('src/utils/nonEssentialEgress.ts') ?? ''
  const config = safeReadUtf8('src/utils/config.ts') ?? ''
  const releaseNotes = safeReadUtf8('src/utils/releaseNotes.ts') ?? ''

  const ok =
    egress.includes("type NonEssentialSurface") &&
    egress.includes("'feedback'") &&
    egress.includes("'transcript-share'") &&
    egress.includes("'telemetry'") &&
    egress.includes("'updates'") &&
    egress.includes('BOTVALIA_ENABLE_NONESSENTIAL_EGRESS') &&
    config.includes("type: 'oss-safe'") &&
    releaseNotes.includes('isUpdateChecksEnabledByDefaultForOSS') &&
    releaseNotes.includes('hasReleaseNotes: false')

  return createResult(
    'oss-safe-defaults-static',
    ok ? 'pass' : 'fail',
    ok
      ? 'Static guards for nonessential egress and update disablement are present'
      : 'Missing one or more expected static OSS-safe guards for egress/update paths',
  )
}

function checkRuntimeLoopbackAndAuthStatic(): CheckResult {
  const runtimeWsServer = safeReadUtf8('src/runtime/runtimeWsServer.ts') ?? ''
  const protocol = safeReadUtf8('src/runtime/protocol.ts') ?? ''

  const ok =
    runtimeWsServer.includes("const host = config.host ?? '127.0.0.1'") &&
    runtimeWsServer.includes('verifyClient:') &&
    runtimeWsServer.includes('hasRuntimeWebSocketAuthToken') &&
    protocol.includes('withRuntimeWebSocketAuthToken') &&
    protocol.includes('runtimeToken')

  return createResult(
    'runtime-loopback-and-auth-static',
    ok ? 'pass' : 'fail',
    ok
      ? 'Runtime bridge stays loopback-only by default and keeps token-aware helpers'
      : 'Runtime bridge source is missing expected loopback/auth guard markers',
  )
}

function checkRuntimeOriginGuardStatic(): CheckResult {
  const runtimeWsServer = safeReadUtf8('src/runtime/runtimeWsServer.ts') ?? ''

  const hasOriginInspection =
    runtimeWsServer.includes('origin') ||
    runtimeWsServer.includes('Origin') ||
    runtimeWsServer.includes('headers.origin')
  const hasLocalhostMarker =
    runtimeWsServer.includes('localhost') ||
    runtimeWsServer.includes('127.0.0.1')

  if (hasOriginInspection && hasLocalhostMarker) {
    return createResult(
      'runtime-origin-guard-static',
      'pass',
      'Runtime WebSocket handshake appears to inspect Origin and keep it local-aware',
    )
  }

  return createResult(
    'runtime-origin-guard-static',
    'warn',
    'Runtime WebSocket source does not show an obvious Origin pinning/local-origin guard yet',
  )
}

function checkRuntimeBrowserStorageStatic(): CheckResult {
  const inspectorHook =
    safeReadUtf8('BotValia-CodeUI/hooks/useRuntimeInspector.ts') ?? ''
  const runtimeUrl = safeReadUtf8('BotValia-CodeUI/lib/runtime-url.ts') ?? ''
  const runtimeClient = safeReadUtf8('BotValia-CodeUI/lib/runtime-client.ts') ?? ''

  const ok =
    inspectorHook.includes("readBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'session')") &&
    inspectorHook.includes("removeBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'local')") &&
    inspectorHook.includes('clearRuntimeLaunchParamsFromBrowserUrl') &&
    runtimeUrl.includes('runtimeToken') &&
    runtimeUrl.includes('clearRuntimeLaunchParamsFromBrowserUrl') &&
    runtimeClient.includes('authToken')

  return createResult(
    'runtime-browser-storage-static',
    ok ? 'pass' : 'fail',
    ok
      ? 'Runtime UI persists launch data in session scope and cleans browser URL/local fallback'
      : 'Runtime UI source is missing one or more expected session-only launch storage guards',
  )
}

function checkRuntimeLaunchUrlSanitizationStatic(): CheckResult {
  const runtimeCommand = safeReadUtf8('src/commands/runtime/runtime.ts') ?? ''

  const ok =
    runtimeCommand.includes('function sanitizeInspectorLaunchUrl') &&
    runtimeCommand.includes('function sanitizeRuntimeWebSocketUrl') &&
    runtimeCommand.includes(
      'const visibleInspectorUrl = sanitizeInspectorLaunchUrl(inspectorUrl)',
    ) &&
    runtimeCommand.includes(
      '`Runtime WebSocket: ${sanitizeRuntimeWebSocketUrl(runtimeServer.url)}`',
    ) &&
    runtimeCommand.includes('sanitizeInspectorLaunchUrl(')

  return createResult(
    'runtime-launch-url-sanitization-static',
    ok ? 'pass' : 'fail',
    ok
      ? 'Runtime command source sanitizes visible launch/runtime URLs before printing them'
      : 'Runtime command source is missing one or more expected URL sanitization markers',
  )
}

function checkInsightsInternalGateStatic(): CheckResult {
  const insights = safeReadUtf8('src/commands/insights.ts') ?? ''
  const ok =
    insights.includes('BOTVALIA_ENABLE_INTERNAL_INSIGHTS') &&
    insights.includes('isInternalInsightsModeEnabled')

  return createResult(
    'insights-internal-gate-static',
    ok ? 'pass' : 'fail',
    ok
      ? 'Internal insights features are still visibly gated behind explicit opt-in markers'
      : 'Expected internal-insights gating markers are missing from /insights',
  )
}

function checkLegacyCloudEndpoints(
  trackedTextFiles: Array<{ path: string; content: string }>,
): CheckResult {
  const executableUrlPattern =
    /(?:https?|wss):\/\/(?:api\.anthropic\.com|platform\.claude\.com|claude\.ai|mcp-proxy\.anthropic\.com)\b/i

  const executableMatches = new Set<string>()
  const compatMentions = new Set<string>()

  for (const file of trackedTextFiles) {
    if (file.path === 'scripts/security-preflight.ts') {
      continue
    }

    const lines = file.content.split(/\r?\n/)
    let fileHasCompatMention = false

    for (const line of lines) {
      if (!LEGACY_CLOUD_ENDPOINT_PATTERNS.some(pattern => line.includes(pattern))) {
        continue
      }

      const trimmed = line.trim()
      const isCommentOnly =
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*/')

      if (executableUrlPattern.test(line) && !isCommentOnly) {
        executableMatches.add(file.path)
        continue
      }

      fileHasCompatMention = true
    }

    if (fileHasCompatMention) {
      compatMentions.add(file.path)
    }
  }

  return createResult(
    'legacy-cloud-endpoints',
    executableMatches.size === 0 ? 'pass' : 'warn',
    executableMatches.size === 0
      ? compatMentions.size === 0
        ? 'No legacy Anthropic/Claude cloud endpoints found in tracked text files'
        : `No executable legacy cloud endpoints found; compatibility mentions remain in comments/labels: ${summarizeList([...compatMentions])}`
      : `Executable legacy cloud endpoints remain in tracked code: ${summarizeList([...executableMatches])}${compatMentions.size > 0 ? `. Additional compatibility mentions remain in comments/labels: ${summarizeList([...compatMentions])}` : ''}`,
  )
}

function checkWorkingTreeCleanliness(
  options: CliOptions,
  inventory: RepositoryFileInventory,
): CheckResult {
  if (options.noGit) {
    return createResult(
      'working-tree-cleanliness',
      'warn',
      'Skipped because --no-git was requested.',
    )
  }

  if (inventory.source !== 'git') {
    return createResult(
      'working-tree-cleanliness',
      'warn',
      inventory.note
        ? `Skipped because git inventory was unavailable. ${inventory.note}`
        : 'Skipped because git inventory was unavailable.',
    )
  }

  const statusLines = readWorkingTreeStatus()
  const hasGitFailure = statusLines.some(line => line.startsWith('git status failed:'))

  if (hasGitFailure) {
    return createResult(
      'working-tree-cleanliness',
      'warn',
      summarizeList(statusLines),
    )
  }

  return createResult(
    'working-tree-cleanliness',
    statusLines.length === 0 ? 'pass' : 'warn',
    statusLines.length === 0
      ? 'Working tree is clean'
      : `Working tree is not clean: ${summarizeList(statusLines)}`,
  )
}

function checkRepositoryFileSource(
  inventory: RepositoryFileInventory,
): CheckResult {
  return createResult(
    'repository-file-source',
    inventory.source === 'git' ? 'pass' : 'warn',
    inventory.source === 'git'
      ? 'Checks are running against git-tracked files'
      : inventory.note
        ? `Git file inventory unavailable; using filesystem fallback. ${inventory.note}`
        : 'Git file inventory was unavailable here; checks fell back to a filesystem scan with conservative directory ignores and without git-tracking semantics',
  )
}

function summarize(results: CheckResult[]): PreflightSummary {
  return results.reduce<PreflightSummary>(
    (accumulator, result) => {
      accumulator[result.level] += 1
      return accumulator
    },
    { pass: 0, warn: 0, fail: 0 },
  )
}

function printResults(
  options: CliOptions,
  inventory: RepositoryFileInventory,
  trackedTextFileCount: number,
  results: CheckResult[],
  summary: PreflightSummary,
) {
  if (options.outputJson) {
    console.log(
      JSON.stringify(
        {
          summary,
          inventory: {
            source: inventory.source,
            note: inventory.note ?? null,
            trackedFileCount: inventory.files.length,
            scannedTextFileCount: trackedTextFileCount,
          },
          options: {
            strictMode: options.strictMode,
            noGit: options.noGit,
            maxTextBytes: options.maxTextBytes,
          },
          results,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(
    `Security preflight scanning ${inventory.files.length} repo files (${trackedTextFileCount} text-like) via ${inventory.source}${inventory.note ? `; ${inventory.note}` : ''}.`,
  )
  console.log('')

  for (const result of results) {
    const prefix =
      result.level === 'pass'
        ? '[PASS]'
        : result.level === 'warn'
          ? '[WARN]'
          : '[FAIL]'
    console.log(`${prefix} ${result.name}: ${result.details}`)
  }

  console.log(
    `\nSecurity preflight summary: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail.`,
  )
}

function getExitCode(options: CliOptions, summary: PreflightSummary): number {
  if (summary.fail > 0) {
    return 1
  }

  if (options.strictMode && summary.warn > 0) {
    return 1
  }

  return 0
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return 0
  }

  const packageJson = readJsonFile<PackageJsonShape>('package.json')
  const inventory = listRepositoryFiles(options)
  const trackedFiles = inventory.files
  const trackedTextFiles = readTrackedTextFiles(trackedFiles, options)

  const results: CheckResult[] = [
    checkRepositoryFileSource(inventory),
    checkSecurityDocs(),
    checkPublicPackageMetadata(packageJson),
    checkDirectDependencyRanges(packageJson),
    checkLockfileAndPrivateFlag(packageJson),
    checkGeneratedArtifactPolicy(),
    checkTrackedBuildArtifacts(trackedFiles),
    checkTrackedSensitiveFilenames(trackedFiles),
    checkHighConfidenceSecrets(trackedTextFiles),
    checkLocalPathLeaks(trackedTextFiles),
    checkOssSafeDefaultsStatic(),
    checkRuntimeLoopbackAndAuthStatic(),
    checkRuntimeOriginGuardStatic(),
    checkRuntimeBrowserStorageStatic(),
    checkRuntimeLaunchUrlSanitizationStatic(),
    checkInsightsInternalGateStatic(),
    checkLegacyCloudEndpoints(trackedTextFiles),
    checkWorkingTreeCleanliness(options, inventory),
  ]

  const summary = summarize(results)
  printResults(
    options,
    inventory,
    trackedTextFiles.length,
    results,
    summary,
  )

  return getExitCode(options, summary)
}

try {
  const exitCode = await main()
  process.exitCode = exitCode
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'unknown preflight failure'

  console.error(`Security preflight crashed: ${message}`)
  process.exitCode = 2
}
