param(
  [ValidateSet("free-fast", "auto", "custom")]
  [string]$Preset = "free-fast",
  [string]$Model = "",
  [string]$ApiKey = "",
  [string]$BaseUrl = "https://openrouter.ai/api",
  [int]$MaxOutputTokens = 2048,
  [int]$MaxThinkingTokens = 512,
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

$freeFastCandidates = @(
  "openrouter/google/gemma-3-4b-it:free",
  "openrouter/meta-llama/llama-3.2-3b-instruct:free",
  "openrouter/mistralai/mistral-7b-instruct:free"
)

function Resolve-Model {
  param(
    [string]$SelectedPreset,
    [string]$SelectedModel,
    [string]$SelectedApiKey,
    [string]$SelectedBaseUrl
  )

  if (-not [string]::IsNullOrWhiteSpace($SelectedModel)) {
    return $SelectedModel
  }

  if ($SelectedPreset -eq "auto") {
    return "openrouter/auto"
  }

  if ($SelectedPreset -eq "custom") {
    Write-Error "Preset 'custom' requires -Model."
    exit 1
  }

  $modelsUrl = $SelectedBaseUrl.TrimEnd("/") + "/v1/models"
  try {
    $headers = @{
      "Authorization" = "Bearer $SelectedApiKey"
      "Accept" = "application/json"
    }
    $response = Invoke-RestMethod -Method Get -Uri $modelsUrl -Headers $headers -TimeoutSec 10
    $available = @{}
    foreach ($item in $response.data) {
      if ($null -ne $item.id -and -not [string]::IsNullOrWhiteSpace($item.id)) {
        $available[$item.id] = $true
      }
    }

    foreach ($candidate in $freeFastCandidates) {
      if ($available.ContainsKey($candidate)) {
        return $candidate
      }
    }
  } catch {
    Write-Host "[botvalia openrouter] Could not auto-discover free models: $($_.Exception.Message)"
  }

  return $freeFastCandidates[0]
}

$resolvedModel = Resolve-Model -SelectedPreset $Preset -SelectedModel $Model -SelectedApiKey $ApiKey -SelectedBaseUrl $BaseUrl

$env:ANTHROPIC_BASE_URL = $BaseUrl
$env:ANTHROPIC_AUTH_TOKEN = $ApiKey
$env:ANTHROPIC_API_KEY = ""
$env:ANTHROPIC_MODEL = $resolvedModel
$env:ANTHROPIC_CUSTOM_MODEL_OPTION = $resolvedModel
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_NAME = "OpenRouter: $resolvedModel"
$env:ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION = "Custom model over OpenRouter"

# OpenRouter may reject some Anthropic betas depending on model/provider.
$env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"

# Keep requests affordable on free/low-credit accounts.
$env:CLAUDE_CODE_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
$env:MAX_THINKING_TOKENS = "$MaxThinkingTokens"

Write-Host "[botvalia openrouter] ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia openrouter] ANTHROPIC_MODEL=$($env:ANTHROPIC_MODEL)"
Write-Host "[botvalia openrouter] PRESET=$Preset"
Write-Host "[botvalia openrouter] CLAUDE_CODE_MAX_OUTPUT_TOKENS=$($env:CLAUDE_CODE_MAX_OUTPUT_TOKENS)"
Write-Host "[botvalia openrouter] MAX_THINKING_TOKENS=$($env:MAX_THINKING_TOKENS)"

if ($VersionOnly) {
  & $bunPath run version
  exit $LASTEXITCODE
}

& $bunPath run dev
exit $LASTEXITCODE
