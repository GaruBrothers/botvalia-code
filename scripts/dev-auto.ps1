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
  [string]$OllamaComplexModel = "ollama::devstral",
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

function ConvertTo-LookupTable {
  param([string[]]$Values)

  $table = @{}
  foreach ($value in $Values) {
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }

    $trimmed = $value.Trim()
    $table[$trimmed.ToLowerInvariant()] = $trimmed
  }

  return $table
}

function Get-RouteModelValue {
  param([string]$Route)

  if ([string]::IsNullOrWhiteSpace($Route)) {
    return ""
  }

  $trimmed = $Route.Trim()
  if ($trimmed.StartsWith("openrouter::")) {
    return $trimmed.Substring("openrouter::".Length)
  }
  if ($trimmed.StartsWith("ollama::")) {
    return $trimmed.Substring("ollama::".Length)
  }
  if ($trimmed.StartsWith("anthropic::")) {
    return $trimmed.Substring("anthropic::".Length)
  }

  return $trimmed
}

function Normalize-OllamaModelValue {
  param([string]$Model)

  if ([string]::IsNullOrWhiteSpace($Model)) {
    return ""
  }

  $trimmed = $Model.Trim()
  if ($trimmed.StartsWith("ollama::")) {
    $trimmed = $trimmed.Substring("ollama::".Length)
  }
  if ($trimmed.StartsWith("ollama/")) {
    $trimmed = $trimmed.Substring("ollama/".Length)
  }

  return $trimmed
}

function Get-OpenRouterRequestHeaders {
  $headers = @{
    "Accept" = "application/json"
  }

  $openRouterKeys = First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEYS)
  $openRouterKey = Get-FirstSplitValue -Raw $openRouterKeys
  if ([string]::IsNullOrWhiteSpace($openRouterKey)) {
    $openRouterKey = First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEY)
  }

  if (-not [string]::IsNullOrWhiteSpace($openRouterKey)) {
    $headers["Authorization"] = "Bearer $openRouterKey"
  }

  return $headers
}

function Get-OpenRouterFreeCatalog {
  $baseUrl = First-NonEmpty @($env:BOTVALIA_OPENROUTER_BASE_URL, $env:OPENROUTER_BASE_URL, "https://openrouter.ai/api")
  $modelsUrl = $baseUrl.TrimEnd("/") + "/v1/models"
  $headers = Get-OpenRouterRequestHeaders

  try {
    $response = Invoke-RestMethod -Method Get -Uri $modelsUrl -Headers $headers -TimeoutSec 8
    $freeModelIds = New-Object System.Collections.Generic.List[string]

    foreach ($item in @($response.data)) {
      if ($null -eq $item.id) {
        continue
      }

      $id = [string]$item.id
      $isFreeVariant = $id.ToLowerInvariant().EndsWith(":free")
      $isFreeRouter = $id -eq "openrouter/free"
      $isZeroPrice = $false
      if ($null -ne $item.pricing) {
        $isZeroPrice = $item.pricing.prompt -eq "0" -and $item.pricing.completion -eq "0"
      }

      if ($isFreeVariant -or $isFreeRouter -or $isZeroPrice) {
        if (-not $freeModelIds.Contains($id)) {
          $freeModelIds.Add($id)
        }
      }
    }

    return [pscustomobject]@{
      Source = "live"
      BaseUrl = $baseUrl.TrimEnd("/")
      ModelIds = @($freeModelIds.ToArray())
    }
  } catch {
    return [pscustomobject]@{
      Source = "unavailable"
      BaseUrl = $baseUrl.TrimEnd("/")
      ModelIds = @()
    }
  }
}

function Get-OllamaRequestHeaders {
  param([string]$ApiKey)

  $headers = @{
    "Accept" = "application/json"
  }

  if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
    $headers["Authorization"] = "Bearer $ApiKey"
  }

  return $headers
}

function Get-OllamaEndpointInventory {
  param(
    [string]$BaseUrl,
    [string]$ApiKey
  )

  $trimmedBaseUrl = $BaseUrl.TrimEnd("/")
  $headers = Get-OllamaRequestHeaders -ApiKey $ApiKey

  $attempts = @(
    [pscustomobject]@{
      Source = "api-tags"
      Url = "$trimmedBaseUrl/api/tags"
    },
    [pscustomobject]@{
      Source = "v1-models"
      Url = "$trimmedBaseUrl/v1/models"
    }
  )

  foreach ($attempt in $attempts) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri $attempt.Url -Headers $headers -TimeoutSec 5
      $models = New-Object System.Collections.Generic.List[string]

      if ($attempt.Source -eq "api-tags") {
        foreach ($model in @($response.models)) {
          if ($null -eq $model.name) {
            continue
          }
          $name = Normalize-OllamaModelValue -Model ([string]$model.name)
          if (-not [string]::IsNullOrWhiteSpace($name) -and -not $models.Contains($name)) {
            $models.Add($name)
          }
        }
      } else {
        foreach ($model in @($response.data)) {
          if ($null -eq $model.id) {
            continue
          }
          $name = Normalize-OllamaModelValue -Model ([string]$model.id)
          if (-not [string]::IsNullOrWhiteSpace($name) -and -not $models.Contains($name)) {
            $models.Add($name)
          }
        }
      }

      return [pscustomobject]@{
        Known = $true
        Source = $attempt.Source
        Models = @($models.ToArray())
      }
    } catch {
      continue
    }
  }

  return [pscustomobject]@{
    Known = $false
    Source = "unavailable"
    Models = @()
  }
}

function Resolve-OllamaInstalledModelName {
  param(
    [string]$Candidate,
    [string[]]$InstalledModels,
    [hashtable]$InstalledLookup
  )

  $normalizedCandidate = Normalize-OllamaModelValue -Model $Candidate
  if ([string]::IsNullOrWhiteSpace($normalizedCandidate)) {
    return ""
  }

  $candidateKey = $normalizedCandidate.ToLowerInvariant()
  if ($InstalledLookup.ContainsKey($candidateKey)) {
    return $InstalledLookup[$candidateKey]
  }

  $family = ($normalizedCandidate -split ':', 2)[0]
  $wantsTaggedVariant = $normalizedCandidate.Contains(":")

  foreach ($installedModel in $InstalledModels) {
    if ([string]::IsNullOrWhiteSpace($installedModel)) {
      continue
    }

    $installedNormalized = Normalize-OllamaModelValue -Model $installedModel
    $installedFamily = ($installedNormalized -split ':', 2)[0]
    if ($installedFamily -ne $family) {
      continue
    }

    if (-not $wantsTaggedVariant) {
      return $installedNormalized
    }

    if ($installedNormalized.EndsWith(":latest")) {
      return $installedNormalized
    }
  }

  return ""
}

function Filter-OpenRouterCandidateRoutes {
  param(
    [string[]]$Routes,
    [hashtable]$AvailableFreeModels,
    [bool]$HasLiveCatalog
  )

  if (-not $HasLiveCatalog) {
    return @(Get-UniqueRoutes -Routes $Routes)
  }

  $filteredRoutes = New-Object System.Collections.Generic.List[string]
  foreach ($route in $Routes) {
    if ([string]::IsNullOrWhiteSpace($route)) {
      continue
    }

    if (-not $route.StartsWith("openrouter::")) {
      $filteredRoutes.Add($route) | Out-Null
      continue
    }

    $model = Get-RouteModelValue -Route $route
    if ($model -eq "openrouter/free" -or $AvailableFreeModels.ContainsKey($model.ToLowerInvariant())) {
      $filteredRoutes.Add($route) | Out-Null
    }
  }

  return @(Get-UniqueRoutes -Routes @($filteredRoutes.ToArray()))
}

function Filter-OllamaCandidateRoutes {
  param(
    [string[]]$Routes,
    [string[]]$InstalledModels,
    [hashtable]$InstalledLookup,
    [bool]$InventoryKnown
  )

  if (-not $InventoryKnown) {
    return @(Get-UniqueRoutes -Routes $Routes)
  }

  $filteredRoutes = New-Object System.Collections.Generic.List[string]
  foreach ($route in $Routes) {
    if ([string]::IsNullOrWhiteSpace($route)) {
      continue
    }

    if (-not $route.StartsWith("ollama::")) {
      $filteredRoutes.Add($route) | Out-Null
      continue
    }

    $resolvedModel = Resolve-OllamaInstalledModelName -Candidate (Get-RouteModelValue -Route $route) -InstalledModels $InstalledModels -InstalledLookup $InstalledLookup
    if (-not [string]::IsNullOrWhiteSpace($resolvedModel)) {
      $filteredRoutes.Add("ollama::$resolvedModel") | Out-Null
    }
  }

  return @(Get-UniqueRoutes -Routes @($filteredRoutes.ToArray()))
}

function Get-OllamaOverflowRoutes {
  param(
    [string[]]$PreferredRoutes,
    [string[]]$InstalledModels,
    [hashtable]$InstalledLookup,
    [bool]$InventoryKnown
  )

  if (-not $InventoryKnown) {
    return @()
  }

  $preferredLookup = @{}
  foreach ($route in $PreferredRoutes) {
    $model = Normalize-OllamaModelValue -Model (Get-RouteModelValue -Route $route)
    if (-not [string]::IsNullOrWhiteSpace($model)) {
      $preferredLookup[$model.ToLowerInvariant()] = $true
    }
  }

  $overflowRoutes = New-Object System.Collections.Generic.List[string]
  foreach ($installedModel in $InstalledModels) {
    $normalized = Normalize-OllamaModelValue -Model $installedModel
    if ([string]::IsNullOrWhiteSpace($normalized)) {
      continue
    }

    if (-not $preferredLookup.ContainsKey($normalized.ToLowerInvariant())) {
      $overflowRoutes.Add("ollama::$normalized") | Out-Null
    }
  }

  return @($overflowRoutes.ToArray())
}

function Get-OllamaEndpointSpecs {
  $specs = New-Object System.Collections.Generic.List[object]

  $rawEndpointPools = @(
    $env:BOTVALIA_OLLAMA_ENDPOINTS,
    $env:OLLAMA_ENDPOINTS,
    $env:BOTVALIA_LITELLM_ENDPOINTS,
    $env:LITELLM_ENDPOINTS
  )

  foreach ($rawPool in $rawEndpointPools) {
    foreach ($entry in @(Split-RouteValues -Raw $rawPool)) {
      $parts = $entry -split '\|', 2
      $baseUrl = $parts[0].Trim()
      if ([string]::IsNullOrWhiteSpace($baseUrl)) {
        continue
      }
      $apiKey = if ($parts.Length -gt 1 -and -not [string]::IsNullOrWhiteSpace($parts[1])) {
        $parts[1].Trim()
      } else {
        First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
      }
      $specs.Add([pscustomobject]@{
        BaseUrl = $baseUrl.TrimEnd('/')
        ApiKey = $apiKey
      })
    }
  }

  $baseUrls = @(
    @(Split-RouteValues -Raw $env:BOTVALIA_OLLAMA_BASE_URLS) +
    @(Split-RouteValues -Raw $env:OLLAMA_BASE_URLS) +
    @(Split-RouteValues -Raw $env:BOTVALIA_LITELLM_BASE_URLS) +
    @(Split-RouteValues -Raw $env:LITELLM_BASE_URLS)
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  $apiKeys = @(
    @(Split-RouteValues -Raw $env:BOTVALIA_OLLAMA_API_KEYS) +
    @(Split-RouteValues -Raw $env:OLLAMA_API_KEYS) +
    @(Split-RouteValues -Raw $env:BOTVALIA_LITELLM_API_KEYS) +
    @(Split-RouteValues -Raw $env:LITELLM_API_KEYS)
  )

  for ($i = 0; $i -lt $baseUrls.Count; $i++) {
    $specs.Add([pscustomobject]@{
      BaseUrl = $baseUrls[$i].TrimEnd('/')
      ApiKey = if ($i -lt $apiKeys.Count -and -not [string]::IsNullOrWhiteSpace($apiKeys[$i])) {
        $apiKeys[$i].Trim()
      } else {
        First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
      }
    })
  }

  $fallbackBaseUrl = First-NonEmpty @($OllamaBaseUrl, $env:BOTVALIA_OLLAMA_BASE_URL, $env:OLLAMA_BASE_URL, $env:BOTVALIA_LITELLM_BASE_URL, $env:LITELLM_BASE_URL, "http://localhost:11434")
  $fallbackApiKey = First-NonEmpty @($OllamaApiKey, $env:BOTVALIA_OLLAMA_API_KEY, $env:OLLAMA_API_KEY, $env:BOTVALIA_LITELLM_API_KEY, $env:LITELLM_API_KEY, "sk-local")
  $specs.Add([pscustomobject]@{
    BaseUrl = $fallbackBaseUrl.TrimEnd('/')
    ApiKey = $fallbackApiKey
  })

  $seen = @{}
  $deduped = New-Object System.Collections.Generic.List[object]
  foreach ($spec in $specs) {
    $key = "$($spec.BaseUrl)|$($spec.ApiKey)"
    if (-not $seen.ContainsKey($key)) {
      $seen[$key] = $true
      $deduped.Add($spec)
    }
  }

  return @($deduped.ToArray())
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
        "z-ai/glm-4.5-air:free"
        "openai/gpt-oss-20b:free"
        "nvidia/nemotron-nano-9b-v2:free"
        "nvidia/nemotron-3-nano-30b-a3b:free"
        "poolside/laguna-xs.2:free"
        "google/gemma-3-12b-it:free"
        "google/gemma-3-4b-it:free"
        "meta-llama/llama-3.2-3b-instruct:free"
        "openrouter/free"
      )
    }
    "complex" {
      @(
        "tencent/hy3-preview:free"
        "openai/gpt-oss-120b:free"
        "minimax/minimax-m2.5:free"
        "qwen/qwen3-next-80b-a3b-instruct:free"
        "nvidia/nemotron-3-super-120b-a12b:free"
        "google/gemma-4-31b-it:free"
        "inclusionai/ling-2.6-1t:free"
        "z-ai/glm-4.5-air:free"
        "openrouter/free"
      )
    }
    default {
      @(
        "poolside/laguna-m.1:free"
        "qwen/qwen3-coder:free"
        "tencent/hy3-preview:free"
        "openai/gpt-oss-120b:free"
        "minimax/minimax-m2.5:free"
        "qwen/qwen3-next-80b-a3b-instruct:free"
        "google/gemma-4-31b-it:free"
        "nvidia/nemotron-3-super-120b-a12b:free"
        "z-ai/glm-4.5-air:free"
        "openrouter/free"
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

  return @(
    Filter-OpenRouterCandidateRoutes `
      -Routes (Get-UniqueRoutes -Routes $routes) `
      -AvailableFreeModels $script:OpenRouterFreeModelLookup `
      -HasLiveCatalog $script:HasLiveOpenRouterCatalog
  )
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
        "ollama::gemma3:4b"
        "ollama::qwen3:4b"
        "ollama::llama3.2:3b"
        "ollama::deepseek-r1:1.5b"
        "ollama::qwen2.5:3b"
        "ollama::qwen2.5-coder:3b"
        "ollama::gemma3:1b"
      )
    }
    "complex" {
      @(
        "ollama::gpt-oss:20b"
        "ollama::qwen3:30b"
        "ollama::qwen3:14b"
        "ollama::deepseek-r1:32b"
        "ollama::deepseek-r1:14b"
        "ollama::gemma3:27b"
        "ollama::gemma3:12b"
        "ollama::qwen2.5-coder:14b"
        "ollama::qwen2.5-coder:7b"
      )
    }
    default {
      @(
        "ollama::qwen3-coder:30b"
        "ollama::qwen3-coder"
        "ollama::gpt-oss:20b"
        "ollama::deepseek-r1:14b"
        "ollama::qwen3:30b"
        "ollama::gemma3:12b"
        "ollama::qwen2.5-coder:14b"
        "ollama::qwen2.5-coder:7b"
        "ollama::deepseek-coder-v2:16b"
      )
    }
  }

  if ($tierOverrideRoutes.Count -eq 0) {
    $tierOverrideRoutes = $tierDefaults
  }

  $preferredRoutes = @(
    Filter-OllamaCandidateRoutes `
      -Routes (Get-UniqueRoutes -Routes @($primaryRoute + $tierOverrideRoutes)) `
      -InstalledModels $script:OllamaAvailableModels `
      -InstalledLookup $script:OllamaAvailableModelLookup `
      -InventoryKnown $script:UseKnownOllamaInventory
  )

  return @(
    Get-UniqueRoutes -Routes @(
      $preferredRoutes +
      (Get-OllamaOverflowRoutes `
        -PreferredRoutes $preferredRoutes `
        -InstalledModels $script:OllamaAvailableModels `
        -InstalledLookup $script:OllamaAvailableModelLookup `
        -InventoryKnown $script:UseKnownOllamaInventory)
    )
  )
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
          "openrouter::z-ai/glm-4.5-air:free"
          "openrouter::nvidia/nemotron-nano-9b-v2:free"
          "openrouter::nvidia/nemotron-3-nano-30b-a3b:free"
          "openrouter::poolside/laguna-xs.2:free"
          "openrouter::google/gemma-3-12b-it:free"
          "openrouter::google/gemma-3-4b-it:free"
          "openrouter::meta-llama/llama-3.2-3b-instruct:free"
          "openrouter::openrouter/free"
          $OllamaFastModel
          "ollama::qwen3:4b"
          "ollama::llama3.2:3b"
        )
      }
      "complex" {
        @(
          $OpenRouterComplexModel
          "openrouter::openai/gpt-oss-120b:free"
          "openrouter::minimax/minimax-m2.5:free"
          "openrouter::qwen/qwen3-next-80b-a3b-instruct:free"
          "openrouter::nvidia/nemotron-3-super-120b-a12b:free"
          "openrouter::google/gemma-4-31b-it:free"
          "openrouter::inclusionai/ling-2.6-1t:free"
          "openrouter::z-ai/glm-4.5-air:free"
          "openrouter::openrouter/free"
          $OllamaComplexModel
          "ollama::qwen3:30b"
          "ollama::deepseek-r1:14b"
        )
      }
      default {
        @(
          $OpenRouterCodeModel
          "openrouter::qwen/qwen3-coder:free"
          "openrouter::tencent/hy3-preview:free"
          "openrouter::openai/gpt-oss-120b:free"
          "openrouter::minimax/minimax-m2.5:free"
          "openrouter::qwen/qwen3-next-80b-a3b-instruct:free"
          "openrouter::google/gemma-4-31b-it:free"
          "openrouter::nvidia/nemotron-3-super-120b-a12b:free"
          "openrouter::z-ai/glm-4.5-air:free"
          "openrouter::openrouter/free"
          $OllamaCodeModel
          "ollama::gpt-oss:20b"
          "ollama::deepseek-r1:14b"
        )
      }
    }

    $liveRoutes = Filter-OpenRouterCandidateRoutes -Routes $hybridDefaults -AvailableFreeModels $script:OpenRouterFreeModelLookup -HasLiveCatalog $script:HasLiveOpenRouterCatalog
    $liveRoutes = Filter-OllamaCandidateRoutes -Routes $liveRoutes -InstalledModels $script:OllamaAvailableModels -InstalledLookup $script:OllamaAvailableModelLookup -InventoryKnown $script:UseKnownOllamaInventory

    return @(
      Get-UniqueRoutes -Routes @(
        $liveRoutes +
        (Get-OllamaOverflowRoutes `
          -PreferredRoutes $liveRoutes `
          -InstalledModels $script:OllamaAvailableModels `
          -InstalledLookup $script:OllamaAvailableModelLookup `
          -InventoryKnown $script:UseKnownOllamaInventory)
      )
    )
  }

  if ($HasOpenRouter) {
    return @(Get-OpenRouterTierRoutes -Tier $Tier)
  }

  if ($HasOllama) {
    return @(Get-OllamaTierRoutes -Tier $Tier)
  }

  $fallbackDefaults = switch ($Tier) {
    "fast" { @($OllamaFastModel, "ollama::qwen3:4b", "ollama::llama3.2:3b", "ollama::deepseek-r1:1.5b", "ollama::qwen2.5:3b") }
    "complex" { @($OllamaComplexModel, "ollama::qwen3:30b", "ollama::deepseek-r1:14b", "ollama::gemma3:12b", "ollama::qwen2.5-coder:14b") }
    default { @($OllamaCodeModel, "ollama::gpt-oss:20b", "ollama::deepseek-r1:14b", "ollama::qwen3:30b", "ollama::qwen2.5-coder:14b") }
  }

  return @(
    Filter-OllamaCandidateRoutes `
      -Routes (Get-UniqueRoutes -Routes $fallbackDefaults) `
      -InstalledModels $script:OllamaAvailableModels `
      -InstalledLookup $script:OllamaAvailableModelLookup `
      -InventoryKnown $script:UseKnownOllamaInventory
  )
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
$ollamaEndpointSpecs = @(Get-OllamaEndpointSpecs)
$primaryOllamaEndpoint = if ($ollamaEndpointSpecs.Count -gt 0) { $ollamaEndpointSpecs[0] } else { $null }

$resolvedOllamaBaseUrl = if ($primaryOllamaEndpoint) { $primaryOllamaEndpoint.BaseUrl } else { "http://localhost:11434" }
$resolvedOllamaApiKey = if ($primaryOllamaEndpoint) { $primaryOllamaEndpoint.ApiKey } else { "sk-local" }
$env:BOTVALIA_OLLAMA_BASE_URL = $resolvedOllamaBaseUrl
$env:BOTVALIA_OLLAMA_API_KEY = $resolvedOllamaApiKey

$openRouterCatalog = Get-OpenRouterFreeCatalog
$script:HasLiveOpenRouterCatalog = $openRouterCatalog.Source -eq "live"
$script:OpenRouterFreeModelIds = @($openRouterCatalog.ModelIds)
$script:OpenRouterFreeModelLookup = ConvertTo-LookupTable -Values $script:OpenRouterFreeModelIds

$script:HasKnownOllamaInventory = $false
$script:UseKnownOllamaInventory = $false
$script:OllamaAvailableModels = @()
$script:OllamaAvailableModelLookup = @{}
$selectedOllamaInventorySource = "unavailable"
$selectedOllamaEndpointHadModels = $false
$reachableOllamaEndpoint = $null
$catalogAwareOllamaEndpoint = $null

$hasAnthropic = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_ANTHROPIC_API_KEY, $env:BOTVALIA_ANTHROPIC_AUTH_TOKEN)))
$hasOpenRouter = -not [string]::IsNullOrWhiteSpace((First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEY)))
$hasOllama = $false
foreach ($endpointSpec in $ollamaEndpointSpecs) {
  if (Test-TcpEndpoint -Url $endpointSpec.BaseUrl) {
    $hasOllama = $true
    if (-not $reachableOllamaEndpoint) {
      $reachableOllamaEndpoint = $endpointSpec
    }

    $inventory = Get-OllamaEndpointInventory -BaseUrl $endpointSpec.BaseUrl -ApiKey $endpointSpec.ApiKey
    if ($inventory.Known -and (-not $catalogAwareOllamaEndpoint -or @($inventory.Models).Count -gt 0)) {
      $catalogAwareOllamaEndpoint = [pscustomobject]@{
        Spec = $endpointSpec
        Inventory = $inventory
      }
      if (@($inventory.Models).Count -gt 0) {
        break
      }
    }
  }
}

if ($catalogAwareOllamaEndpoint) {
  $resolvedOllamaBaseUrl = $catalogAwareOllamaEndpoint.Spec.BaseUrl
  $resolvedOllamaApiKey = $catalogAwareOllamaEndpoint.Spec.ApiKey
  $script:HasKnownOllamaInventory = $catalogAwareOllamaEndpoint.Inventory.Known
  $script:OllamaAvailableModels = @($catalogAwareOllamaEndpoint.Inventory.Models)
  $script:OllamaAvailableModelLookup = ConvertTo-LookupTable -Values $script:OllamaAvailableModels
  $selectedOllamaInventorySource = $catalogAwareOllamaEndpoint.Inventory.Source
  $selectedOllamaEndpointHadModels = @($script:OllamaAvailableModels).Count -gt 0
} elseif ($reachableOllamaEndpoint) {
  $resolvedOllamaBaseUrl = $reachableOllamaEndpoint.BaseUrl
  $resolvedOllamaApiKey = $reachableOllamaEndpoint.ApiKey
}

$env:BOTVALIA_OLLAMA_BASE_URL = $resolvedOllamaBaseUrl
$env:BOTVALIA_OLLAMA_API_KEY = $resolvedOllamaApiKey
$env:BOTVALIA_OPENROUTER_FREE_MODELS = ($script:OpenRouterFreeModelIds -join ",")
$env:BOTVALIA_OPENROUTER_FREE_MODELS_SOURCE = $openRouterCatalog.Source
$env:BOTVALIA_OPENROUTER_FREE_MODEL_COUNT = "$(@($script:OpenRouterFreeModelIds).Count)"
$env:BOTVALIA_OLLAMA_AVAILABLE_MODELS = ($script:OllamaAvailableModels -join ",")
$env:BOTVALIA_OLLAMA_AVAILABLE_MODELS_SOURCE = $selectedOllamaInventorySource
$env:BOTVALIA_OLLAMA_AVAILABLE_MODEL_COUNT = "$(@($script:OllamaAvailableModels).Count)"
$env:BOTVALIA_OLLAMA_INVENTORY_KNOWN = if ($script:HasKnownOllamaInventory) { "1" } else { "0" }
$script:UseKnownOllamaInventory = -not $VersionOnly -and $script:HasKnownOllamaInventory

$hasUsableOpenRouter = $hasOpenRouter
$hasUsableOllama = $hasOllama -and ((-not $script:HasKnownOllamaInventory) -or @($script:OllamaAvailableModels).Count -gt 0)
$openRouterKeyPoolCount = @(
  @(Split-RouteValues -Raw (First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEYS, $env:OPENROUTER_API_KEYS))) +
  @((First-NonEmpty @($env:BOTVALIA_OPENROUTER_API_KEY, $env:OPENROUTER_API_KEY)) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
) | Select-Object -Unique | Measure-Object | Select-Object -ExpandProperty Count
$ollamaEndpointCount = $ollamaEndpointSpecs.Count

$fastRoutes = @()
$complexRoutes = @()
$codeRoutes = @()
$effectiveMode = if ($Preset -eq "auto") { "auto-all" } else { $Preset }
$modeLabel = $effectiveMode
$costPolicy = "free-only"
$routePolicy = ""
$anthropicExcludedFromAuto = $hasAnthropic
$routeHasOpenRouter = if ($VersionOnly) { $hasOpenRouter } else { $hasUsableOpenRouter }
$routeHasOllama = if ($VersionOnly) { $hasOllama } else { $hasUsableOllama }
$ollamaAvailabilityNote = if ($script:HasKnownOllamaInventory -and @($script:OllamaAvailableModels).Count -eq 0) {
  "Ollama endpoint is reachable but no installed models were found."
} elseif ($script:HasKnownOllamaInventory) {
  "Ollama inventory loaded from $selectedOllamaInventorySource."
} else {
  "Ollama inventory unavailable, using curated fallbacks."
}

switch ($effectiveMode) {
  "auto-all" {
    $modeLabel = "Auto All"
    if (-not $routeHasOpenRouter -and -not $routeHasOllama) {
      Write-Error "Auto (All) requiere OpenRouter configurado o un endpoint Ollama activo en $resolvedOllamaBaseUrl."
      exit 1
    }
    if ($routeHasOpenRouter -and $routeHasOllama) {
      $routePolicy = "Hybrid free routing: OpenRouter and Ollama. Each tier uses one curated primary route plus multiple fallbacks. $ollamaAvailabilityNote"
    } elseif ($routeHasOpenRouter) {
      $routePolicy = "OpenRouter available only: Auto (All) collapses to same-provider OpenRouter routing."
    } else {
      $routePolicy = "Ollama available only: Auto (All) collapses to same-provider Ollama routing. $ollamaAvailabilityNote"
    }
    $fastRoutes = @(Get-AllTierRoutes -Tier "fast" -HasOpenRouter $routeHasOpenRouter -HasOllama $routeHasOllama)
    $complexRoutes = @(Get-AllTierRoutes -Tier "complex" -HasOpenRouter $routeHasOpenRouter -HasOllama $routeHasOllama)
    $codeRoutes = @(Get-AllTierRoutes -Tier "code" -HasOpenRouter $routeHasOpenRouter -HasOllama $routeHasOllama)
  }
  "auto-openrouter" {
    $modeLabel = "Auto OpenRouter"
    $routePolicy = "OpenRouter only: each tier uses one curated primary route plus multiple live free-model fallbacks"
    if (-not $routeHasOpenRouter) {
      Write-Error "Auto (OpenRouter) requiere OPENROUTER_API_KEY o BOTVALIA_OPENROUTER_API_KEY."
      exit 1
    }
    $fastRoutes = @(Get-OpenRouterTierRoutes -Tier "fast")
    $complexRoutes = @(Get-OpenRouterTierRoutes -Tier "complex")
    $codeRoutes = @(Get-OpenRouterTierRoutes -Tier "code")
  }
  "auto-ollama" {
    $modeLabel = "Auto Ollama"
    $routePolicy = "Ollama only: each tier uses one curated primary route plus multiple installed-model fallbacks. $ollamaAvailabilityNote"
    if (-not $routeHasOllama) {
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
$env:BOTVALIA_OPENROUTER_AVAILABLE = if ($hasUsableOpenRouter) { "1" } else { "0" }
$env:BOTVALIA_OLLAMA_AVAILABLE = if ($hasUsableOllama) { "1" } else { "0" }
$env:BOTVALIA_OLLAMA_ENDPOINT_REACHABLE = if ($hasOllama) { "1" } else { "0" }
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
Write-Host "[botvalia auto] PROVIDERS_USABLE=openrouter:$hasUsableOpenRouter ollama:$hasUsableOllama"
Write-Host "[botvalia auto] OPENROUTER_KEY_POOL_COUNT=$openRouterKeyPoolCount"
Write-Host "[botvalia auto] OPENROUTER_FREE_MODELS_SOURCE=$($env:BOTVALIA_OPENROUTER_FREE_MODELS_SOURCE)"
Write-Host "[botvalia auto] OPENROUTER_FREE_MODEL_COUNT=$($env:BOTVALIA_OPENROUTER_FREE_MODEL_COUNT)"
Write-Host "[botvalia auto] OLLAMA_ENDPOINT_COUNT=$ollamaEndpointCount"
Write-Host "[botvalia auto] OLLAMA_INVENTORY_KNOWN=$($env:BOTVALIA_OLLAMA_INVENTORY_KNOWN)"
Write-Host "[botvalia auto] OLLAMA_AVAILABLE_MODELS_SOURCE=$($env:BOTVALIA_OLLAMA_AVAILABLE_MODELS_SOURCE)"
Write-Host "[botvalia auto] OLLAMA_AVAILABLE_MODEL_COUNT=$($env:BOTVALIA_OLLAMA_AVAILABLE_MODEL_COUNT)"
Write-Host "[botvalia auto] OLLAMA_ENDPOINT_HAS_MODELS=$selectedOllamaEndpointHadModels"
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
