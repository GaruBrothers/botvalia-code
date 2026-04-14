param(
  [string]$ApiKey = "",
  [string]$BaseUrl = "https://openrouter.ai/api"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = $env:OPENROUTER_API_KEY
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Error "Missing API key. Set OPENROUTER_API_KEY or pass -ApiKey."
  exit 1
}

$modelsUrl = $BaseUrl.TrimEnd("/") + "/v1/models"
$headers = @{
  "Authorization" = "Bearer $ApiKey"
  "Accept" = "application/json"
}

$response = Invoke-RestMethod -Method Get -Uri $modelsUrl -Headers $headers -TimeoutSec 20

$freeModels = @()
foreach ($item in $response.data) {
  if ($null -eq $item.id) { continue }
  $id = [string]$item.id
  if ($id.ToLowerInvariant().Contains(":free")) {
    $contextLength = ""
    if ($null -ne $item.context_length) {
      $contextLength = [string]$item.context_length
    }
    $freeModels += [PSCustomObject]@{
      id = $id
      context = $contextLength
    }
  }
}

$freeModels `
  | Sort-Object id `
  | Format-Table -AutoSize
