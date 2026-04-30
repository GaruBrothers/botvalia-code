param(
  [switch]$Json
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$args = @(".\scripts\smoke-free-router-fallback.ts")

if ($Json) {
  $args += "--json"
}

Push-Location $repoRoot
try {
  & bun @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
