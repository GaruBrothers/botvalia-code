param(
  [string]$BaseUrl = "http://localhost:4000",
  [string]$Model = "ollama/llama3.2:3b",
  [string]$ApiKey = "sk-local",
  [switch]$VersionOnly
)

$ErrorActionPreference = "Stop"

function Initialize-Utf8Console {
  try {
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8NoBom
    [Console]::OutputEncoding = $utf8NoBom
    $OutputEncoding = $utf8NoBom
  } catch {
  }

  try {
    & cmd /c "chcp 65001 >nul" | Out-Null
  } catch {
  }
}

Initialize-Utf8Console

$bunPath = "bun"
$wingetBunPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"
if (Test-Path $wingetBunPath) {
  $bunPath = $wingetBunPath
}

$env:ANTHROPIC_BASE_URL = $BaseUrl
$env:ANTHROPIC_API_KEY = $ApiKey
$env:ANTHROPIC_MODEL = $Model
$env:ANTHROPIC_CUSTOM_MODEL_OPTION = $Model
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = "Free: $Model"
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Custom model over ANTHROPIC_BASE_URL"

# Reduce incompatibilities with non-Anthropic backends.
$env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"

# Privacy defaults for local/free mode.
$env:DISABLE_TELEMETRY = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

Write-Host "[botvalia free] ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia free] ANTHROPIC_MODEL=$($env:ANTHROPIC_MODEL)"

if ($VersionOnly) {
  & $bunPath run version
  exit $LASTEXITCODE
}

& $bunPath run dev
exit $LASTEXITCODE
