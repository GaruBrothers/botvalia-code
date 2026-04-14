param(
  [string]$Model = "openrouter/auto",
  [string]$ApiKey = "",
  [string]$BaseUrl = "https://openrouter.ai/api/v1/anthropic",
  [switch]$VersionOnly
)

$ErrorActionPreference = "Stop"

$bunPath = "bun"
$wingetBunPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"
if (Test-Path $wingetBunPath) {
  $bunPath = $wingetBunPath
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = $env:OPENROUTER_API_KEY
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Error "Missing API key. Set OPENROUTER_API_KEY or pass -ApiKey."
  exit 1
}

$env:ANTHROPIC_BASE_URL = $BaseUrl
$env:ANTHROPIC_API_KEY = $ApiKey
$env:ANTHROPIC_MODEL = $Model
$env:ANTHROPIC_CUSTOM_MODEL_OPTION = $Model
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = "OpenRouter: $Model"
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Custom model over OpenRouter"

# OpenRouter may reject some Anthropic betas depending on model/provider.
$env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"

Write-Host "[botvalia openrouter] ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia openrouter] ANTHROPIC_MODEL=$($env:ANTHROPIC_MODEL)"

if ($VersionOnly) {
  & $bunPath run version
  exit $LASTEXITCODE
}

& $bunPath run dev
exit $LASTEXITCODE
