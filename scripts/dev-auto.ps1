param(
  [ValidateSet("auto", "auto-all", "auto-openrouter", "auto-ollama")]
  [string]$Preset = "auto-all",
  [string]$AnthropicFastModel = "anthropic::haiku",
  [string]$AnthropicComplexModel = "anthropic::sonnet",
  [string]$AnthropicCodeModel = "anthropic::sonnet",
  [string]$OpenRouterFastModel = "openrouter::openrouter/free",
  [string]$OpenRouterComplexModel = "openrouter::qwen/qwen3.6-plus:free",
  [string]$OpenRouterCodeModel = "openrouter::qwen/qwen3-coder:free",
  [string]$OllamaFastModel = "ollama::llama3.2:3b",
  [string]$OllamaComplexModel = "ollama::deepseek-r1",
  [string]$OllamaCodeModel = "ollama::qwen3-coder",
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

function Normalize-ProviderRoute {
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

function Get-FirstSplitValue {
  param([string]$Raw)

  $values = @(Split-RouteValues -Raw $Raw)
  if ($values.Count -gt 0) {
    return $values[0]
  }

  return ""
}

function Get-RouteProvider {
  param([string]$Route)

  if ([string]::IsNullOrWhiteSpace($Route)) {
    return ""
  }
  if ($Route.StartsWith("anthropic::")) {
    return "anthropic"
  }
  if ($Route.StartsWith("openrouter::")) {
    return "openrouter"
  }
  if ($Route.StartsWith("ollama::")) {
    return "ollama"
  }

  return "unknown"
}

function Format-RouteChain {
  param([string[]]$Routes)

  $normalizedRoutes = @(
    $Routes |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )

  if ($normalizedRoutes.Count -eq 0) {
    return "(none)"
  }

  return ($normalizedRoutes -join " -> ")
}

function Get-OpenRouterTierRoutes {
  param(
    [ValidateSet("fast", "complex", "code")]
    [string]$Tier
  )

  $commonRoutes = @(Split-RouteValues -Raw $env:BOTVALIA_AUTO_OPENROUTER_COMMON_CHAIN)
  if ($commonRoutes.Count -eq 0) {
    $commonRoutes = @()
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
        "openai/gpt-oss-20b:free"
      )
    }
    "complex" {
      @(
        "openai/gpt-oss-120b:free"
        "deepseek/deepseek-r1-0528:free"
      )
    }
    default {
      @(
        "qwen/qwen3.6-plus:free"
        "openai/gpt-oss-120b:free"
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

function Get-OllamaTierRoutes {
  param(
    [ValidateSet("fast", "complex", "code")]
    [string]$Tier
  )

  $primaryRoute = switch ($Tier) {
    "fast" { $OllamaFastModel }
    "complex" { $OllamaComplexModel }
    default { $OllamaCodeModel }
  }

  $tierOverrideRaw = switch ($Tier) {
    "fast" { $env:BOTVALIA_AUTO_OLLAMA_FAST_CHAIN }
    "complex" { $env:BOTVALIA_AUTO_OLLAMA_COMPLEX_CHAIN }
    default { $env:BOTVALIA_AUTO_OLLAMA_CODE_CHAIN }
  }
  $tierOverrideRoutes = @(Split-RouteValues -Raw $tierOverrideRaw)

  $tierDefaults = switch ($Tier) {
    "fast" {
      @(
        "ollama::qwen2.5:3b"
        "ollama::qwen2.5-coder:7b"
      )
    }
    "complex" {
      @(
        "ollama::qwen3-coder"
        "ollama::qwen2.5-coder:7b"
      )
    }
    default {
      @(
        "ollama::qwen2.5-coder:7b"
        "ollama::deepseek-coder-v2:16b"
      )
    }
  }

  if ($tierOverrideRoutes.Count -eq 0) {
    $tierOverrideRoutes = $tierDefaults
  }

  return @(Get-UniqueRoutes -Routes @($primaryRoute + $tierOverrideRoutes))
}

function Get-AllTierRoutes {
  param(
    [ValidateSet("fast", "complex", "code")]
    [string]$Tier,
    [bool]$HasOpenRouter,
    [bool]$HasOllama
  )

  $tierOverrideRaw = switch ($Tier) {
    "fast" { $env:BOTVALIA_AUTO_ALL_FAST_CHAIN }
    "complex" { $env:BOTVALIA_AUTO_ALL_COMPLEX_CHAIN }
    default { $env:BOTVALIA_AUTO_ALL_CODE_CHAIN }
  }
  $tierOverrideRoutes = @(Split-RouteValues -Raw $tierOverrideRaw)
  if ($tierOverrideRoutes.Count -gt 0) {
    return @(
      Get-UniqueRoutes -Routes @(
        $tierOverrideRoutes |
          ForEach-Object { Normalize-ProviderRoute -Route $_ }
      )
    )
  }

  if ($HasOpenRouter -and $HasOllama) {
    $hybridDefaults = switch ($Tier) {
      "fast" {
        @(
          $OpenRouterFastModel
          "openrouter::openai/gpt-oss-20b:free"
          $OllamaFastModel
        )
      }
      "complex" {
        @(
          $OpenRouterComplexModel
          "openrouter::openai/gpt-oss-120b:free"
          $OllamaComplexModel
        )
      }
      default {
        @(
          $OpenRouterCodeModel
          $OllamaCodeModel
          "openrouter::openai/gpt-oss-120b:free"
        )
      }
    }

    return @(Get-UniqueRoutes -Routes $hybridDefaults)
  }

  if ($HasOpenRouter) {
    return @(Get-OpenRouterTierRoutes -Tier $Tier)
  }

  if ($HasOllama) {
    return @(Get-OllamaTierRoutes -Tier $Tier)
  }

  $fallbackDefaults = switch ($Tier) {
    "fast" { @($OllamaFastModel, "ollama::qwen2.5:3b", "ollama::qwen2.5-coder:7b") }
    "complex" { @($OllamaComplexModel, "ollama::qwen3-coder", "ollama::qwen2.5-coder:7b") }
    default { @($OllamaCodeModel, "ollama::qwen2.5-coder:7b", "ollama::deepseek-coder-v2:16b") }
  }

  return @(Get-UniqueRoutes -Routes $fallbackDefaults)
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
    $openRouterKey = Get-FirstSplitValue -Raw $openRouterKeys
    if ([string]::IsNullOrWhiteSpace($openRouterKey)) {
      $openRouterKey = First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEY)
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
  $resolvedOllamaBaseUrl = First-NonEmpty @($OllamaBaseUrl, $env:BOTVALIA_OLLAMA_BASE_URL, $env:OLLAMA_BASE_URL, $env:BOTVALIA_LITELLM_BASE_URL, $env:LITELLM_BASE_URL, "http://localhost:11434")
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

$resolvedOllamaBaseUrl = First-NonEmpty @($OllamaBaseUrl, $env:BOTVALIA_OLLAMA_BASE_URL, $env:OLLAMA_BASE_URL, $env:BOTVALIA_LITELLM_BASE_URL, $env:LITELLM_BASE_URL, "http://localhost:11434")
$resolvedOllamaApiKey = First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
$env:BOTVALIA_OLLAMA_BASE_URL = $resolvedOllamaBaseUrl
$env:BOTVALIA_OLLAMA_API_KEY = $resolvedOllamaApiKey

$hasAnthropic = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_ANTHROPIC_API_KEY, $env:BOTVALIA_ANTHROPIC_AUTH_TOKEN)))
$hasOpenRouter = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEY)))
$hasOllama = Test-TcpEndpoint -Url $resolvedOllamaBaseUrl

$fastRoutes = @()
$complexRoutes = @()
$codeRoutes = @()
$effectiveMode = if ($Preset -eq "auto") { "auto-all" } else { $Preset }
$modeLabel = $effectiveMode
$costPolicy = "free-only"
$routePolicy = ""
$anthropicExcludedFromAuto = $hasAnthropic

switch ($effectiveMode) {
  "auto-all" {
    $modeLabel = "Auto All"
    if (-not $hasOpenRouter -and -not $hasOllama) {
      Write-Error "Auto (All) requiere OpenRouter configurado o un endpoint Ollama activo en $resolvedOllamaBaseUrl."
      exit 1
    }
    if ($hasOpenRouter -and $hasOllama) {
      $routePolicy = "Hybrid free routing: OpenRouter and Ollama. Each tier uses one primary route plus two fallbacks."
    } elseif ($hasOpenRouter) {
      $routePolicy = "OpenRouter available only: Auto (All) collapses to same-provider OpenRouter routing."
    } else {
      $routePolicy = "Ollama available only: Auto (All) collapses to same-provider Ollama routing."
    }
    $fastRoutes = @(Get-AllTierRoutes -Tier "fast" -HasOpenRouter $hasOpenRouter -HasOllama $hasOllama)
    $complexRoutes = @(Get-AllTierRoutes -Tier "complex" -HasOpenRouter $hasOpenRouter -HasOllama $hasOllama)
    $codeRoutes = @(Get-AllTierRoutes -Tier "code" -HasOpenRouter $hasOpenRouter -HasOllama $hasOllama)
  }
  "auto-openrouter" {
    $modeLabel = "Auto OpenRouter"
    $routePolicy = "OpenRouter only: each tier uses one primary route plus two OpenRouter fallbacks"
    if (-not $hasOpenRouter) {
      Write-Error "Auto (OpenRouter) requiere OPENROUTER_API_KEY o BOTVALIA_OPENROUTER_API_KEY."
      exit 1
    }
    $fastRoutes = @(Get-OpenRouterTierRoutes -Tier "fast")
    $complexRoutes = @(Get-OpenRouterTierRoutes -Tier "complex")
    $codeRoutes = @(Get-OpenRouterTierRoutes -Tier "code")
  }
  "auto-ollama" {
    $modeLabel = "Auto Ollama"
    $routePolicy = "Ollama only: each tier uses one primary route plus two Ollama fallbacks"
    if (-not $hasOllama) {
      Write-Error "Auto (Ollama) requiere un endpoint Ollama activo en $resolvedOllamaBaseUrl."
      exit 1
    }
    $fastRoutes = @(Get-OllamaTierRoutes -Tier "fast")
    $complexRoutes = @(Get-OllamaTierRoutes -Tier "complex")
    $codeRoutes = @(Get-OllamaTierRoutes -Tier "code")
  }
}

$fastRoutes = @($fastRoutes)
$complexRoutes = @($complexRoutes)
$codeRoutes = @($codeRoutes)

$isAutoAllPreset = $effectiveMode -eq "auto-all"
$isOpenRouterAutoPreset = $effectiveMode -eq "auto-openrouter"

$fastRoutes = @(Get-UniqueRoutes -Routes $fastRoutes)
$complexRoutes = @(Get-UniqueRoutes -Routes $complexRoutes)
$codeRoutes = @(Get-UniqueRoutes -Routes $codeRoutes)

if ($fastRoutes.Count -eq 0 -and $complexRoutes.Count -eq 0 -and $codeRoutes.Count -eq 0) {
  Write-Error "No hay rutas disponibles para '$effectiveMode'. Configura OpenRouter o inicia Ollama en $resolvedOllamaBaseUrl."
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
$bootstrapProvider = Get-RouteProvider -Route $bootstrapRoute
$transportMode = if ($bootstrapProvider -eq "anthropic") { "anthropic-native" } else { "anthropic-compat-env" }

$env:BOTVALIA_FREE_ONLY_MODE = "1"
$env:BOTVALIA_OPENROUTER_AVAILABLE = if ($hasOpenRouter) { "1" } else { "0" }
$env:BOTVALIA_OLLAMA_AVAILABLE = if ($hasOllama) { "1" } else { "0" }
$env:BOTVALIA_MODEL_SELECTION = $effectiveMode
$env:BOTVALIA_DEFAULT_MODEL_SELECTION = $effectiveMode
$env:BOTVALIA_DEFAULT_FALLBACK_MODELS = "0"
$env:BOTVALIA_FALLBACK_FOR_ALL_PRIMARY_MODELS = "1"
$env:FALLBACK_FOR_ALL_PRIMARY_MODELS = "1"
$env:BOTVALIA_FALLBACK_MODELS = ""
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
Write-Host "[botvalia auto] MODE=$effectiveMode"
Write-Host "[botvalia auto] MODE_LABEL=$modeLabel"
Write-Host "[botvalia auto] COST_POLICY=$costPolicy"
Write-Host "[botvalia auto] ROUTE_POLICY=$routePolicy"
Write-Host "[botvalia auto] FAST=$($env:BOTVALIA_MODEL_ROUTER_FAST_MODEL)"
Write-Host "[botvalia auto] FAST_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_FAST_FALLBACKS)"
Write-Host "[botvalia auto] COMPLEX=$($env:BOTVALIA_MODEL_ROUTER_COMPLEX_MODEL)"
Write-Host "[botvalia auto] COMPLEX_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_COMPLEX_FALLBACKS)"
Write-Host "[botvalia auto] CODE=$($env:BOTVALIA_MODEL_ROUTER_CODE_MODEL)"
Write-Host "[botvalia auto] CODE_FALLBACKS=$($env:BOTVALIA_MODEL_ROUTER_CODE_FALLBACKS)"
Write-Host "[botvalia auto] FAST_CHAIN=$(Format-RouteChain -Routes $fastRoutes)"
Write-Host "[botvalia auto] COMPLEX_CHAIN=$(Format-RouteChain -Routes $complexRoutes)"
Write-Host "[botvalia auto] CODE_CHAIN=$(Format-RouteChain -Routes $codeRoutes)"
Write-Host "[botvalia auto] BOOTSTRAP=$bootstrapRoute"
Write-Host "[botvalia auto] BOOTSTRAP_PROVIDER=$bootstrapProvider"
Write-Host "[botvalia auto] PROVIDERS_AVAILABLE=anthropic:$hasAnthropic openrouter:$hasOpenRouter ollama:$hasOllama"
Write-Host "[botvalia auto] ANTHROPIC_EXCLUDED_FROM_AUTO=$anthropicExcludedFromAuto"
Write-Host "[botvalia auto] AUTO_ALL_CHAIN_ENRICHED=$isAutoAllPreset"
Write-Host "[botvalia auto] AUTO_OPENROUTER_CHAIN_ENRICHED=$isOpenRouterAutoPreset"
Write-Host "[botvalia auto] TRANSPORT=$transportMode"
Write-Host "[botvalia auto] ACTIVE_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "[botvalia auto] ACTIVE_MODEL=$($env:ANTHROPIC_MODEL)"
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
