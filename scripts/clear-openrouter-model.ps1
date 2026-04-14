param(
  [string]$PinnedModelFile = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($PinnedModelFile)) {
  $PinnedModelFile = Join-Path $PSScriptRoot "..\.botvalia\openrouter-model.txt"
}

if (Test-Path $PinnedModelFile) {
  Remove-Item -Path $PinnedModelFile -Force
  Write-Host "[botvalia openrouter] Pinned model cleared."
} else {
  Write-Host "[botvalia openrouter] No pinned model file found."
}
Write-Host "[botvalia openrouter] File: $PinnedModelFile"
