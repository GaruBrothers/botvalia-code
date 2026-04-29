param(
  [ValidateSet("auto", "anthropic-first", "openrouter-first", "ollama-first")]
  [string]$Preset = "auto",
  [string]$AnthropicFastModel = "anthropic::haiku",
  [string]$AnthropicComplexModel = "anthropic::sonnet",
  [string]$AnthropicCodeModel = "anthropic::sonnet",
  [string]$OpenRouterFastModel = "openrouter::openrouter/free",
  [string]$OpenRouterComplexModel = "openrouter::qwen/qwen3.6-plus:free",
  [string]$OpenRouterCodeModel = "openrouter::qwen/qwen3-coder:free",
  [string]$OllamaFastModel = "ollama::llama3.2:3b",
  [string]$OllamaComplexModel = "ollama::qwen2.5-coder:7b",
  [string]$OllamaCodeModel = "ollama::qwen2.5-coder:7b",
  [string]$OllamaBaseUrl = "",
  [string]$OllamaApiKey = "",
  [int]$MaxOutputTokens = 384,
  [int]$MaxThinkingTokens = 128,
  [bool]$BareMode = $true,
  [switch]$VersionOnly,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ExtraArgs
)

$ErrorActionPreference = "Stop"

function Get-BunPath {
  $wingetBunPath = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"
  if (Test-Path $wingetBunPath) {
    return $wingetBunPath
  }
  return "bun"
}

function First-NonEmpty {
  param([string[]]$Values)
  foreach ($value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
  }
  return ""
}

function Split-RouteValues {
  param([string]$Raw)

  if ([string]::IsNullOrWhiteSpace($Raw)) {
    return @()
  }

  return @(
    $Raw -split ",|;|`n|`r`n" |
      ForEach-Object { $_.Trim() } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
}

function Test-TcpEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutMs = 1200
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return $false
  }

  try {
    $uri = [System.Uri]$Url
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $async = $client.BeginConnect($uri.Host, $uri.Port, $null, $null)
      if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
        return $false
      }
      $client.EndConnect($async) | Out-Null
      return $true
    } finally {
      $client.Dispose()
    }
  } catch {
    return $false
  }
}

function Get-UniqueRoutes {
  param([string[]]$Routes)
  $list = New-Object System.Collections.Generic.List[string]
  foreach ($route in $Routes) {
    if ([string]::IsNullOrWhiteSpace($route)) {
      continue
    }
    if (-not $list.Contains($route.Trim())) {
      $list.Add($route.Trim())
    }
  }
  return @($list.ToArray())
}

function Normalize-OpenRouterRoute {
  param([string]$Route)

  if ([string]::IsNullOrWhiteSpace($Route)) {
    return ""
  }

  $trimmed = $Route.Trim()
  if ($trimmed.Contains("::")) {
    return $trimmed
  }

  return "openrouter::$trimmed"
}

function Get-OpenRouterTierRoutes {
  param(
    [ValidateSet("fast", "complex", "code")]
    [string]$Tier
  )

  $commonRoutes = @(Split-RouteValues -Raw $env:BOTVALIA_AUTO_OPENROUTER_COMMON_CHAIN)
  if ($commonRoutes.Count -eq 0) {
    $commonRoutes = @(
      "openrouter/free"
    )
  }

  $primaryRoute = switch ($Tier) {
    "fast" { $OpenRouterFastModel }
    "complex" { $OpenRouterComplexModel }
    default { $OpenRouterCodeModel }
  }

  $tierOverrideRaw = switch ($Tier) {
    "fast" { $env:BOTVALIA_AUTO_OPENROUTER_FAST_CHAIN }
    "complex" { $env:BOTVALIA_AUTO_OPENROUTER_COMPLEX_CHAIN }
    default { $env:BOTVALIA_AUTO_OPENROUTER_CODE_CHAIN }
  }
  $tierOverrideRoutes = @(Split-RouteValues -Raw $tierOverrideRaw)

  $tierDefaults = switch ($Tier) {
    "fast" {
      @(
        "google/gemma-4-26b-a4b-it:free"
        "meta-llama/llama-3.2-3b-instruct:free"
        "openai/gpt-oss-20b:free"
        "meta-llama/llama-3.3-70b-instruct:free"
      )
    }
    "complex" {
      @(
        "openai/gpt-oss-120b:free"
        "openai/gpt-oss-20b:free"
        "qwen/qwen3.6-plus:free"
        "deepseek/deepseek-r1-0528:free"
        "meta-llama/llama-3.3-70b-instruct:free"
        "google/gemma-4-26b-a4b-it:free"
      )
    }
    default {
      @(
        "qwen/qwen3.6-plus:free"
        "openai/gpt-oss-120b:free"
        "openai/gpt-oss-20b:free"
        "meta-llama/llama-3.3-70b-instruct:free"
        "google/gemma-4-26b-a4b-it:free"
      )
    }
  }

  if ($tierOverrideRoutes.Count -eq 0) {
    $tierOverrideRoutes = $tierDefaults
  }

  $routes = @($primaryRoute)
  foreach ($route in @($commonRoutes + $tierOverrideRoutes)) {
    $routes += Normalize-OpenRouterRoute -Route $route
  }

  return @(Get-UniqueRoutes -Routes $routes)
}

function Apply-BootstrapRoute {
  param([string]$Route)

  if ([string]::IsNullOrWhiteSpace($Route)) {
    return
  }

  if ($Route.StartsWith("anthropic::")) {
    $model = $Route.Substring("anthropic::".Length)
    $env:ANTHROPIC_BASE_URL = First-NonEmpty @($env:BOTVALIA_ANTHROPIC_BASE_URL)
    $env:ANTHROPIC_API_KEY = First-NonEmpty @($env:BOTVALIA_ANTHROPIC_API_KEY, $env:ANTHROPIC_API_KEY)
    $env:ANTHROPIC_AUTH_TOKEN = First-NonEmpty @($env:BOTVALIA_ANTHROPIC_AUTH_TOKEN, $env:ANTHROPIC_AUTH_TOKEN)
    $env:ANTHROPIC_MODEL = $model
    return
  }

  if ($Route.StartsWith("openrouter::")) {
    $model = $Route.Substring("openrouter::".Length)
    $openRouterBaseUrl = First-NonEmpty @($env:BOTVALIA_OPENROUTER_BASE_URL, $env:OPENROUTER_BASE_URL, "https://openrouter.ai/api")
    $openRouterKeys = First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEYS)
    $openRouterKey = ""
    if (-not [string]::IsNullOrWhiteSpace($openRouterKeys)) {
      $openRouterKey = ($openRouterKeys -split ",|;|`n|`r`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    }
    if ([string]::IsNullOrWhiteSpace($openRouterKey)) {
      $openRouterKey = First-NonEmpty @($env:OPENROUTER_API_KEY, $env:BOTVALIA_OPENROUTER_API_KEY, $env:ANTHROPIC_AUTH_TOKEN)
    }
    $env:ANTHROPIC_BASE_URL = $openRouterBaseUrl
    $env:ANTHROPIC_API_KEY = ""
    $env:ANTHROPIC_AUTH_TOKEN = $openRouterKey
    $env:ANTHROPIC_MODEL = $model
    $env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"
    return
  }

  $model = $Route.Substring("ollama::".Length)
  if (-not $model.StartsWith("ollama/")) {
    $model = "ollama/$model"
  }
  $resolvedOllamaBaseUrl = First-NonEmpty @($OllamaBaseUrl, $env:BOTVALIA_OLLAMA_BASE_URL, $env:OLLAMA_BASE_URL, $env:BOTVALIA_LITELLM_BASE_URL, $env:LITELLM_BASE_URL, "http://localhost:4000")
  $resolvedOllamaApiKey = First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
  $env:BOTVALIA_OLLAMA_BASE_URL = $resolvedOllamaBaseUrl
  $env:BOTVALIA_OLLAMA_API_KEY = $resolvedOllamaApiKey
  $env:ANTHROPIC_BASE_URL = $resolvedOllamaBaseUrl
  $env:ANTHROPIC_API_KEY = $resolvedOllamaApiKey
  $env:ANTHROPIC_AUTH_TOKEN = ""
  $env:ANTHROPIC_MODEL = $model
  $env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"
  $env:DISABLE_TELEMETRY = "1"
  $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
}

$bunPath = Get-BunPath

if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_API_KEY) -and [string]::IsNullOrWhiteSpace($env:BOTVALIA_ANTHROPIC_API_KEY)) {
  $env:BOTVALIA_ANTHROPIC_API_KEY = $env:ANTHROPIC_API_KEY
}
if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_AUTH_TOKEN) -and [string]::IsNullOrWhiteSpace($env:BOTVALIA_ANTHROPIC_AUTH_TOKEN)) {
  $env:BOTVALIA_ANTHROPIC_AUTH_TOKEN = $env:ANTHROPIC_AUTH_TOKEN
}
if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_BASE_URL) -and [string]::IsNullOrWhiteSpace($env:BOTVALIA_ANTHROPIC_BASE_URL)) {
  $env:BOTVALIA_ANTHROPIC_BASE_URL = $env:ANTHROPIC_BASE_URL
}
if (-not [string]::IsNullOrWhiteSpace($env:OPENROUTER_API_KEYS) -and [string]::IsNullOrWhiteSpace($env:BOTVALIA_OPENROUTER_API_KEYS)) {
  $env:BOTVALIA_OPENROUTER_API_KEYS = $env:OPENROUTER_API_KEYS
}
if (-not [string]::IsNullOrWhiteSpace($env:OPENROUTER_API_KEY) -and [string]::IsNullOrWhiteSpace($env:BOTVALIA_OPENROUTER_API_KEY)) {
  $env:BOTVALIA_OPENROUTER_API_KEY = $env:OPENROUTER_API_KEY
}

$resolvedOllamaBaseUrl = First-NonEmpty @($OllamaBaseUrl, $env:BOTVALIA_OLLAMA_BASE_URL, $env:OLLAMA_BASE_URL, $env:BOTVALIA_LITELLM_BASE_URL, $env:LITELLM_BASE_URL, "http://localhost:4000")
$resolvedOllamaApiKey = First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
$env:BOTVALIA_OLLAMA_BASE_URL = $resolvedOllamaBaseUrl
$env:BOTVALIA_OLLAMA_API_KEY = $resolvedOllamaApiKey

$hasAnthropic = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_ANTHROPIC_API_KEY, $env:BOTVALIA_ANTHROPIC_AUTH_TOKEN)))
$hasOpenRouter = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEY)))
$hasOllama = Test-TcpEndpoint -Url $resolvedOllamaBaseUrl

$fastRoutes = @()
$complexRoutes = @()
$codeRoutes = @()

switch ($Preset) {
  "anthropic-first" {
    if ($hasAnthropic) {
      $fastRoutes += $AnthropicFastModel
      $complexRoutes += $AnthropicComplexModel
      $codeRoutes += $AnthropicCodeModel
    }
    if ($hasOpenRouter) {
      $fastRoutes += $OpenRouterFastModel
      $complexRoutes += $OpenRouterComplexModel
      $codeRoutes += $OpenRouterCodeModel
    }
    if ($hasOllama) {
      $fastRoutes += $OllamaFastModel
      $complexRoutes += $OllamaComplexModel
      $codeRoutes += $OllamaCodeModel
    }
  }
  "openrouter-first" {
    if ($hasOpenRouter) {
      $fastRoutes += $OpenRouterFastModel
      $complexRoutes += $OpenRouterComplexModel
      $codeRoutes += $OpenRouterCodeModel
    }
    if ($hasOllama) {
      $fastRoutes += $OllamaFastModel
      $complexRoutes += $OllamaComplexModel
      $codeRoutes += $OllamaCodeModel
    }
    if ($hasAnthropic) {
      $fastRoutes += $AnthropicFastModel
      $complexRoutes += $AnthropicComplexModel
      $codeRoutes += $AnthropicCodeModel
    }
  }
  "ollama-first" {
    if ($hasOllama) {
      $fastRoutes += $OllamaFastModel
      $complexRoutes += $OllamaComplexModel
      $codeRoutes += $OllamaCodeModel
    }
    if ($hasOpenRouter) {
      $fastRoutes += $OpenRouterFastModel
      $complexRoutes += $OpenRouterComplexModel
      $codeRoutes += $OpenRouterCodeModel
    }
    if ($hasAnthropic) {
      $fastRoutes += $AnthropicFastModel
      $complexRoutes += $AnthropicComplexModel
      $codeRoutes += $AnthropicCodeModel
    }
  }
  default {
    if ($hasOpenRouter) {
      $fastRoutes += $OpenRouterFastModel
    }
    if ($hasOllama) {
      $fastRoutes += $OllamaFastModel
    }
    if ($hasAnthropic) {
      $fastRoutes += $AnthropicFastModel
    }

    if ($hasAnthropic) {
      $complexRoutes += $AnthropicComplexModel
      $codeRoutes += $AnthropicCodeModel
    }
    if ($hasOpenRouter) {
      $complexRoutes += $OpenRouterComplexModel
      $codeRoutes += $OpenRouterCodeModel
    }
    if ($hasOllama) {
      $complexRoutes += $OllamaComplexModel
      $codeRoutes += $OllamaCodeModel
    }
  }
}

$fastRoutes = @($fastRoutes)
$complexRoutes = @($complexRoutes)
$codeRoutes = @($codeRoutes)

$isOpenRouterOnlyAutoPreset = $Preset -eq "auto" -and $hasOpenRouter -and -not $hasAnthropic -and -not $hasOllama
if ($isOpenRouterOnlyAutoPreset) {
  $fastRoutes += Get-OpenRouterTierRoutes -Tier "fast"
  $complexRoutes += Get-OpenRouterTierRoutes -Tier "complex"
  $codeRoutes += Get-OpenRouterTierRoutes -Tier "code"
}

$fastRoutes = @(Get-UniqueRoutes -Routes $fastRoutes)
$complexRoutes = @(Get-UniqueRoutes -Routes $complexRoutes)
$codeRoutes = @(Get-UniqueRoutes -Routes $codeRoutes)

if ($fastRoutes.Count -eq 0 -and $complexRoutes.Count -eq 0 -and $codeRoutes.Count -eq 0) {
  Write-Error "No providers available. Configure Anthropic/OpenRouter credentials or start an Ollama-compatible proxy on $resolvedOllamaBaseUrl."
  exit 1
}

if ($fastRoutes.Count -eq 0) {
  $fastRoutes = @(Get-UniqueRoutes -Routes @($complexRoutes + $codeRoutes))
}
if ($complexRoutes.Count -eq 0) {
  $complexRoutes = @(Get-UniqueRoutes -Routes @($codeRoutes + $fastRoutes))
}
if ($codeRoutes.Count -eq 0) {
  $codeRoutes = @(Get-UniqueRoutes -Routes @($complexRoutes + $fastRoutes))
}

$bootstrapRoute = [string]($fastRoutes | Select-Object -First 1)
Apply-BootstrapRoute -Route $bootstrapRoute

$env:BOTVALIA_MODEL_ROUTER_ENABLED = "1"
$env:BOTVALIA_MODEL_ROUTER_FAST_MODEL = $fastRoutes[0]
$env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS = (($fastRoutes | Select-Object -Skip 1) -join ",")
$env:BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL = $complexRoutes[0]
$env:BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS = (($complexRoutes | Select-Object -Skip 1) -join ",")
$env:BOTVALIA_MODEL_ROUTER_CODE_MODEL = $codeRoutes[0]
$env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS = (($codeRoutes | Select-Object -Skip 1) -join ",")
$env:BOTVALIA_SHOW_FOOTER_MODEL = "1"
$env:FALLBACK_FOR_ALL_PRIMARY_MODELS = "1"
$env:CLAUDE_CODE_MAX_OUTPUT_TOKENS = "$MaxOutputTokens"
$env:MAX_THINKING_TOKENS = "$MaxThinkingTokens"

Write-Host "[botvalia auto] PRESET=$Preset"
Write-Host "[botvalia auto] FAST=$($env:BOTVALIA_MODEL_ROUTER_FAST_MODEL)"
Write-Host "[botvalia auto] FAST_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS)"
Write-Host "[botvalia auto] COMPLEX=$($env:BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL)"
Write-Host "[botvalia auto] COMPLEX_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS)"
Write-Host "[botvalia auto] CODE=$($env:BOTVALIA_MODEL_ROUTER_CODE_MODEL)"
Write-Host "[botvalia auto] CODE_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS)"
Write-Host "[botvalia auto] BOOTSTRAP=$bootstrapRoute"
Write-Host "[botvalia auto] ANTHROPIC_AVAILABLE=$hasAnthropic OPENROUTER_AVAILABLE=$hasOpenRouter OLLAMA_AVAILABLE=$hasOllama"
Write-Host "[botvalia auto] OPENROUTER_ONLY_AUTO_ENRICHED=$isOpenRouterOnlyAutoPreset"
Write-Host "[botvalia auto] ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia auto] ANTHROPIC_MODEL=$($env:ANTHROPIC_MODEL)"
Write-Host "[botvalia auto] CLAUDE_CODE_MAX_OUTPUT_TOKENS=$($env:CLAUDE_CODE_MAX_OUTPUT_TOKENS)"
Write-Host "[botvalia auto] MAX_THINKING_TOKENS=$($env:MAX_THINKING_TOKENS)"
Write-Host "[botvalia auto] BARE_MODE=$BareMode"

if ($VersionOnly) {
  & $bunPath run version
  exit $LASTEXITCODE
}

if ($BareMode) {
  $ExtraArgs = @("--bare") + @($ExtraArgs)
}

if ($ExtraArgs -and $ExtraArgs.Count -gt 0) {
  & $bunPath run dev -- $ExtraArgs
} else {
  & $bunPath run dev
}
exit $LASTEXITCODE
