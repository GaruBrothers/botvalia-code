param(
  [ValidateSet("free-fast", "auto", "custom")]
  [string]$Preset = "free-fast",
  [string]$Model = "",
  [string]$ApiKey = "",
  [string]$ApiKeys = "",
  [string]$BaseUrl = "https://openrouter.ai/api",
  [bool]$UsePinnedModel = $true,
  [string]$PinnedModelFile = "",
  [string[]]$PreferredFreeModels = @(
    "liquidai/lfm2.5-1.2b-instruct:free",
    "liquid/lfm2.5-1.2b-instruct:free",
    "liquidai/lfm2.5-1.2b-thinking:free",
    "liquid/lfm2.5-1.2b-thinking:free",
    "google/gemma-3n-2b:free",
    "google/gemma-3n-4b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-26b-a4b:free",
    "openai/gpt-oss-120b:free"
  ),
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
  if (-not [string]::IsNullOrWhiteSpace($ApiKeys)) {
    $ApiKey = ($ApiKeys -split ",|;|`n|`r`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    $env:BOTVALIA_OPENROUTER_API_KEYS = $ApiKeys
  } elseif (-not [string]::IsNullOrWhiteSpace($env:OPENROUTER_API_KEYS)) {
    $ApiKey = ($env:OPENROUTER_API_KEYS -split ",|;|`n|`r`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    $env:BOTVALIA_OPENROUTER_API_KEYS = $env:OPENROUTER_API_KEYS
  } else {
    $ApiKey = $env:OPENROUTER_API_KEY
    if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
      $env:BOTVALIA_OPENROUTER_API_KEYS = $ApiKey
    }
  }
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Error "Missing API key. Set OPENROUTER_API_KEY or pass -ApiKey."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($PinnedModelFile)) {
  $PinnedModelFile = Join-Path $PSScriptRoot "..\.botvalia\openrouter-model.txt"
}

$freeFastFallbackCandidates = @(
  "liquidai/lfm2.5-1.2b-instruct:free",
  "liquid/lfm2.5-1.2b-instruct:free",
  "google/gemma-3n-2b:free",
  "google/gemma-3n-4b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-3-4b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
)

function Normalize-ModelId {
  param([string]$ModelId)
  if ([string]::IsNullOrWhiteSpace($ModelId)) {
    return $ModelId
  }

  if ($ModelId.StartsWith("openrouter/")) {
    return $ModelId.Substring("openrouter/".Length)
  }

  return $ModelId
}

function Get-ModelRank {
  param(
    [string]$ModelId,
    [string[]]$PreferredModels
  )

  $normalized = (Normalize-ModelId -ModelId $ModelId).ToLowerInvariant()

  for ($i = 0; $i -lt $PreferredModels.Length; $i++) {
    $preferred = (Normalize-ModelId -ModelId $PreferredModels[$i]).ToLowerInvariant()
    if ($normalized -eq $preferred) {
      return $i
    }
  }

  # Heuristics: smaller free models first for speed.
  if ($normalized -match "lfm2\.5-1\.2b") { return 100 }
  if ($normalized -match "gemma-3n-2b") { return 110 }
  if ($normalized -match "gemma-3n-4b") { return 120 }
  if ($normalized -match "gpt-oss-20b") { return 200 }
  if ($normalized -match "gpt-oss-120b") { return 300 }

  return 1000
}

function Get-PinnedModel {
  param(
    [bool]$Enabled,
    [string]$PinFile
  )

  if (-not $Enabled) {
    return ""
  }

  if (-not (Test-Path $PinFile)) {
    return ""
  }

  try {
    $raw = Get-Content -Path $PinFile -ErrorAction Stop | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return ""
    }
    return (Normalize-ModelId -ModelId $raw.Trim())
  } catch {
    Write-Host "[botvalia openrouter] Could not read pinned model file: $($_.Exception.Message)"
    return ""
  }
}

function Resolve-Model {
  param(
    [string]$SelectedPreset,
    [string]$SelectedModel,
    [string]$SelectedPinnedModel,
    [string]$SelectedApiKey,
    [string]$SelectedBaseUrl,
    [string[]]$SelectedPreferredFreeModels
  )

  if (-not [string]::IsNullOrWhiteSpace($SelectedModel)) {
    return (Normalize-ModelId -ModelId $SelectedModel)
  }

  if (-not [string]::IsNullOrWhiteSpace($SelectedPinnedModel)) {
    return (Normalize-ModelId -ModelId $SelectedPinnedModel)
  }

  if ($SelectedPreset -eq "auto") {
    return "auto"
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

    $freeModels = New-Object System.Collections.Generic.List[string]
    foreach ($modelId in $available.Keys) {
      if ($modelId.ToLowerInvariant().Contains(":free")) {
        $freeModels.Add($modelId)
      }
    }

    if ($freeModels.Count -gt 0) {
      $best = $freeModels `
        | Sort-Object `
          @{ Expression = { Get-ModelRank -ModelId $_ -PreferredModels $SelectedPreferredFreeModels } }, `
          @{ Expression = { $_.Length } }, `
          @{ Expression = { $_ } } `
        | Select-Object -First 1

      if (-not [string]::IsNullOrWhiteSpace($best)) {
        return (Normalize-ModelId -ModelId $best)
      }
    }
  } catch {
    Write-Host "[botvalia openrouter] Could not auto-discover free models: $($_.Exception.Message)"
  }

  return (Normalize-ModelId -ModelId $freeFastFallbackCandidates[0])
}

$pinnedModel = Get-PinnedModel -Enabled $UsePinnedModel -PinFile $PinnedModelFile

$resolvedModel = Resolve-Model `
  -SelectedPreset $Preset `
  -SelectedModel $Model `
  -SelectedPinnedModel $pinnedModel `
  -SelectedApiKey $ApiKey `
  -SelectedBaseUrl $BaseUrl `
  -SelectedPreferredFreeModels $PreferredFreeModels

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
$env:BOTVALIA_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
$env:CLAUDE_CODE_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
$env:MAX_THINKING_TOKENS = "$MaxThinkingTokens"

# Enable fallback for all models (triggers on 529 errors)
$env:FALLBACK_FOR_ALL_PRIMARY_MODELS = "1"

# BotValia model router: code tasks use stronger model; general chat uses faster model.
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_MODEL_ROUTER_ENABLED)) {
  $env:BOTVALIA_MODEL_ROUTER_ENABLED = "1"
}
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_MODEL_ROUTER_CODE_MODEL)) {
  $env:BOTVALIA_MODEL_ROUTER_CODE_MODEL = "openai/gpt-oss-120b:free"
}
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_MODEL_ROUTER_FAST_MODEL)) {
  $env:BOTVALIA_MODEL_ROUTER_FAST_MODEL = "minimax/minimax-m2.7:cloud"
}
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS)) {
  $env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS = "minimax/minimax-m2.7:cloud,kimi/kimi-k2:free,openai/gpt-oss-20b:free"
}
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS)) {
  $env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS = "kimi/kimi-k2:free,openai/gpt-oss-20b:free"
}
if ([string]::IsNullOrWhiteSpace($env:BOTVALIA_SHOW_FOOTER_MODEL)) {
  $env:BOTVALIA_SHOW_FOOTER_MODEL = "1"
}

Write-Host "[botvalia openrouter] ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia openrouter] ANTHROPIC_MODEL=$($env:ANTHROPIC_MODEL)"
Write-Host "[botvalia openrouter] PRESET=$Preset"
if (-not [string]::IsNullOrWhiteSpace($pinnedModel)) {
  Write-Host "[botvalia openrouter] PINNED_MODEL=$pinnedModel"
}
Write-Host "[botvalia openrouter] BOTVALIA_MODEL_ROUTER_ENABLED=$($env:BOTVALIA_MODEL_ROUTER_ENABLED)"
Write-Host "[botvalia openrouter] BOTVALIA_MODEL_ROUTER_CODE_MODEL=$($env:BOTVALIA_MODEL_ROUTER_CODE_MODEL)"
Write-Host "[botvalia openrouter] BOTVALIA_MODEL_ROUTER_FAST_MODEL=$($env:BOTVALIA_MODEL_ROUTER_FAST_MODEL)"
Write-Host "[botvalia openrouter] BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS)"
Write-Host "[botvalia openrouter] BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS)"
Write-Host "[botvalia openrouter] BOTVALIA_SHOW_FOOTER_MODEL=$($env:BOTVALIA_SHOW_FOOTER_MODEL)"
Write-Host "[botvalia openrouter] BOTVALIA_MAX_OUTPUT_TOKENS=$($env:BOTVALIA_MAX_OUTPUT_TOKENS)"
Write-Host "[botvalia openrouter] MAX_THINKING_TOKENS=$($env:MAX_THINKING_TOKENS)"

# Build fallback model list - use fallbackCandidates excluding the resolved model
$extraArgs = @()
$fallbackCandidates = @()
try {
  $modelsUrl = $BaseUrl.TrimEnd("/") + "/v1/models"
  $headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Accept" = "application/json"
  }
  $response = Invoke-RestMethod -Method Get -Uri $modelsUrl -Headers $headers -TimeoutSec 10
  $available = New-Object System.Collections.Generic.List[string]
  foreach ($item in $response.data) {
    if ($null -ne $item.id -and -not [string]::IsNullOrWhiteSpace($item.id)) {
      $available.Add($item.id)
    }
  }
  $fallbackCandidates = $available `
    | Where-Object { $_.ToLowerInvariant().Contains(":free") } `
    | Where-Object { $_ -ne $resolvedModel } `
    | Sort-Object `
      @{ Expression = { Get-ModelRank -ModelId $_ -PreferredModels $PreferredFreeModels } }, `
      @{ Expression = { $_.Length } }, `
      @{ Expression = { $_ } } `
    | Select-Object -First 10
} catch {
  Write-Host "[botvalia openrouter] Could not fetch models for fallback list: $($_.Exception.Message)"
  $fallbackCandidates = @(
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
    "google/gemma-3n-2b:free",
    "google/gemma-3n-4b:free"
  ) | Where-Object { $_ -ne $resolvedModel } | Select-Object -Unique
}
if ($fallbackCandidates.Count -gt 0) {
  $extraArgs = @("--fallback-model", ($fallbackCandidates -join ","))
  Write-Host "[botvalia openrouter] FALLBACK_MODELS=$($fallbackCandidates -join ", ")"
}

if ($VersionOnly) {
  & $bunPath run version
  exit $LASTEXITCODE
}

& $bunPath run dev -- $extraArgs
exit $LASTEXITCODE
