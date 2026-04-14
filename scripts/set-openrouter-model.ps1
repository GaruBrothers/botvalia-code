param(
  [Parameter(Mandatory = $true)]
  [string]$Model,
  [string]$PinnedModelFile = ""
)

$ErrorActionPreference = "Stop"

if ($Model.StartsWith("openrouter/")) {
  $Model = $Model.Substring("openrouter/".Length)
}

if ([string]::IsNullOrWhiteSpace($PinnedModelFile)) {
  $PinnedModelFile = Join-Path $PSScriptRoot "..\.botvalia\openrouter-model.txt"
}

$pinDir = Split-Path -Parent $PinnedModelFile
if (-not (Test-Path $pinDir)) {
  New-Item -Path $pinDir -ItemType Directory -Force | Out-Null
}

Set-Content -Path $PinnedModelFile -Value $Model -NoNewline
Write-Host "[botvalia openrouter] Pinned model saved: $Model"
Write-Host "[botvalia openrouter] File: $PinnedModelFile"
