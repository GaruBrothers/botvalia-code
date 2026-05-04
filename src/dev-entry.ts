import pkg from '../package.json'
import { spawnSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs'
import { createHash } from 'crypto'
import { dirname, extname, join, resolve } from 'path'

type MacroConfig = {
  VERSION: string
  BUILD_TIME: string
  PACKAGE_URL: string
  NATIVE_PACKAGE_URL: string
  VERSION_CHANGELOG: string
  ISSUES_EXPLAINER: string
  FEEDBACK_CHANNEL: string
}

const defaultMacro: MacroConfig = {
  VERSION: pkg.version,
  BUILD_TIME: '',
  PACKAGE_URL: pkg.name,
  NATIVE_PACKAGE_URL: pkg.name,
  VERSION_CHANGELOG: '',
  ISSUES_EXPLAINER:
    'file an issue at https://github.com/GaruBrothers/botvalia-code/issues',
  FEEDBACK_CHANNEL: 'github',
}

if (!('MACRO' in globalThis)) {
  ;(globalThis as typeof globalThis & { MACRO: MacroConfig }).MACRO =
    defaultMacro
}

type MissingImport = {
  importer: string
  specifier: string
}

type ScannedFile = {
  path: string
  mtimeMs: number
  size: number
}

type MissingImportScanCache = {
  version: number
  fingerprint: string
  missing: MissingImport[]
}

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
])
const MISSING_IMPORT_SCAN_CACHE_VERSION = 1
const MISSING_IMPORT_SCAN_CACHE_PATH = resolve(
  '.botvalia',
  'missing-import-scan-cache.json',
)
const RELATIVE_IMPORT_PATTERN =
  /(?:import|export)\s+[\s\S]*?from\s+['"](\.\.?\/[^'"]+)['"]|require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g

function ensureProviderSdkRuntimeFiles(): void {
  const sdkPackagePath = resolve(
    'node_modules',
    '@anthropic-ai',
    'sdk',
    'package.json',
  )
  const sdkInternalMarkerPath = resolve(
    'node_modules',
    '@anthropic-ai',
    'sdk',
    'internal',
    'tslib.mjs',
  )

  if (existsSync(sdkInternalMarkerPath) || !existsSync(sdkPackagePath)) {
    return
  }

  let sdkVersion = 'latest'
  try {
    const sdkPackage = JSON.parse(
      readFileSync(sdkPackagePath, 'utf8'),
    ) as { version?: string }
    if (sdkPackage.version?.trim()) {
      sdkVersion = sdkPackage.version.trim()
    }
  } catch {
    // Best effort only; fall back to latest if package metadata is unreadable.
  }

  console.log(
    `[botvalia repair] Missing required provider SDK runtime files. Repairing local SDK package @${sdkVersion} with npm...`,
  )

  const repair = spawnSync(
    'npm',
    ['install', `@anthropic-ai/sdk@${sdkVersion}`, '--no-save'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  if (repair.status !== 0 || !existsSync(sdkInternalMarkerPath)) {
    console.error(
      '[botvalia repair] Failed to restore required provider SDK runtime files.',
    )
    process.exit(repair.status ?? 1)
  }
}

function scanFiles(dir: string, out: ScannedFile[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      scanFiles(fullPath, out)
      continue
    }
    if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      const stat = statSync(fullPath)
      out.push({
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      })
    }
  }
}

function buildWorkspaceFingerprint(files: readonly ScannedFile[]): string {
  const hash = createHash('sha1')
  hash.update(`${MISSING_IMPORT_SCAN_CACHE_VERSION}\n`)
  for (const file of files) {
    hash.update(file.path)
    hash.update('\n')
    hash.update(String(file.mtimeMs))
    hash.update('\n')
    hash.update(String(file.size))
    hash.update('\n')
  }
  return hash.digest('hex')
}

function buildResolvableTargetSet(files: readonly ScannedFile[]): Set<string> {
  const targets = new Set<string>()
  for (const file of files) {
    const filePath = file.path
    targets.add(filePath)

    const extension = extname(filePath)
    if (extension) {
      targets.add(filePath.slice(0, -extension.length))
    }

    const fileName = filePath.slice(
      Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1,
    )
    if (
      fileName === 'index.ts' ||
      fileName === 'index.tsx' ||
      fileName === 'index.js' ||
      fileName === 'index.jsx' ||
      fileName === 'index.mjs' ||
      fileName === 'index.cjs'
    ) {
      targets.add(dirname(filePath))
    }
  }
  return targets
}

function readMissingImportScanCache(
  fingerprint: string,
): MissingImport[] | undefined {
  try {
    const cache = JSON.parse(
      readFileSync(MISSING_IMPORT_SCAN_CACHE_PATH, 'utf8'),
    ) as MissingImportScanCache
    if (
      cache.version !== MISSING_IMPORT_SCAN_CACHE_VERSION ||
      cache.fingerprint !== fingerprint ||
      !Array.isArray(cache.missing)
    ) {
      return undefined
    }
    return cache.missing
  } catch {
    return undefined
  }
}

function writeMissingImportScanCache(
  fingerprint: string,
  missing: MissingImport[],
): void {
  try {
    mkdirSync(dirname(MISSING_IMPORT_SCAN_CACHE_PATH), { recursive: true })
    writeFileSync(
      MISSING_IMPORT_SCAN_CACHE_PATH,
      JSON.stringify({
        version: MISSING_IMPORT_SCAN_CACHE_VERSION,
        fingerprint,
        missing,
      } satisfies MissingImportScanCache),
      'utf8',
    )
  } catch {
    // Cache writes are opportunistic only.
  }
}

function hasResolvableTarget(
  basePath: string,
  resolvableTargets: ReadonlySet<string>,
): boolean {
  const withoutJs = basePath.replace(/\.js$/u, '')
  const candidates = [
    withoutJs,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    `${withoutJs}.js`,
    `${withoutJs}.jsx`,
    `${withoutJs}.mjs`,
    `${withoutJs}.cjs`,
    join(withoutJs, 'index.ts'),
    join(withoutJs, 'index.tsx'),
    join(withoutJs, 'index.js'),
  ]
  return candidates.some(
    candidate => resolvableTargets.has(candidate) || existsSync(candidate),
  )
}

function collectMissingRelativeImports(): MissingImport[] {
  const files: ScannedFile[] = []
  scanFiles(resolve('src'), files)
  scanFiles(resolve('vendor'), files)
  files.sort((a, b) => a.path.localeCompare(b.path))

  const fingerprint = buildWorkspaceFingerprint(files)
  const cached = readMissingImportScanCache(fingerprint)
  if (cached !== undefined) {
    return cached
  }

  const resolvableTargets = buildResolvableTargetSet(files)
  const missing: MissingImport[] = []
  const seen = new Set<string>()

  for (const file of files) {
    const text = readFileSync(file.path, 'utf8')
    for (const match of text.matchAll(RELATIVE_IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      const target = resolve(dirname(file.path), specifier)
      if (hasResolvableTarget(target, resolvableTargets)) continue
      const key = `${file.path} -> ${specifier}`
      if (seen.has(key)) continue
      seen.add(key)
      missing.push({
        importer: file.path,
        specifier,
      })
    }
  }

  const sortedMissing = missing.sort((a, b) =>
    `${a.importer}:${a.specifier}`.localeCompare(`${b.importer}:${b.specifier}`),
  )
  writeMissingImportScanCache(fingerprint, sortedMissing)
  return sortedMissing
}

const args = process.argv.slice(2)
const missingImports = collectMissingRelativeImports()

if (args.includes('--version')) {
  if (missingImports.length > 0) {
    console.log(`${pkg.version} (restored dev workspace)`)
    console.log(`missing_relative_imports=${missingImports.length}`)
    process.exit(0)
  }
  console.log(pkg.version)
  process.exit(0)
}

if (args.includes('--help')) {
  if (missingImports.length > 0) {
    console.log('BotValia Code restored development workspace')
    console.log(`version: ${pkg.version}`)
    console.log(`missing relative imports: ${missingImports.length}`)
    process.exit(0)
  }
  console.log('Usage: botvalia [options] [prompt]')
  console.log('')
  console.log('Basic restored commands:')
  console.log('  --help       Show this help')
  console.log('  --version    Show version')
  console.log('')
  console.log('Interactive REPL startup is routed to src/main.tsx when run without these flags.')
  process.exit(0)
}

if (missingImports.length > 0) {
  console.log('BotValia Code restored development workspace')
  console.log(`version: ${pkg.version}`)
  console.log(`missing relative imports: ${missingImports.length}`)
  console.log('')
  console.log('Top missing modules:')
  for (const item of missingImports.slice(0, 20)) {
    console.log(`- ${item.importer.replace(`${process.cwd()}/`, '')} -> ${item.specifier}`)
  }
  console.log('')
  console.log('The original app entry is still blocked by missing restored sources.')
  console.log('Use this workspace to continue restoration; once missing imports reach 0, this launcher will forward to src/main.tsx automatically.')
  process.exit(0)
}

ensureProviderSdkRuntimeFiles()

// Route through the original CLI bootstrap so the exported `main()` is
// actually invoked. Importing `main.tsx` directly only evaluates the module.
await import('./entrypoints/cli.tsx')
