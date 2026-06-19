#!/usr/bin/env pwsh
# bv.ps1 — Un solo comando: levanta BotValia Bridge + lanza Codex
# Uso: bv                   (sesión interactiva)
#      bv "haz algo"        (prompt directo)

# Pool de claves OpenRouter — configurar en variable de entorno del sistema o en .env
# Ejemplo: $env:BOTVALIA_OPENROUTER_API_KEYS = "sk-or-v1-clave1,sk-or-v1-clave2,sk-or-v1-clave3"
if (-not $env:BOTVALIA_OPENROUTER_API_KEYS) {
    Write-Host "[ERROR] Variable BOTVALIA_OPENROUTER_API_KEYS no configurada." -ForegroundColor Red
    Write-Host "        Configurala en tus variables de entorno del sistema o en un archivo .env" -ForegroundColor Yellow
    exit 1
}

# Pool de endpoints de Ollama/Cloud — configurar en variable de entorno del sistema o en .env
# Ejemplo: $env:BOTVALIA_OLLAMA_ENDPOINTS = "https://...cuenta.../ai/v1|TOKEN;http://localhost:11434|sk-local"
if (-not $env:BOTVALIA_OLLAMA_ENDPOINTS) {
    # Fallback solo a local si no se configura el pool de nube
    $env:BOTVALIA_OLLAMA_ENDPOINTS = "http://localhost:11434|sk-local"
}


$BridgePort = 5008
$BridgeUrl  = "http://localhost:$BridgePort/health"
$BridgeDir  = $PSScriptRoot   # directorio de botvalia-code

# ── 1. Verificar si el bridge ya está corriendo ──────────────────────────────
$bridgeRunning = $false
try {
    $resp = Invoke-WebRequest -Uri $BridgeUrl -TimeoutSec 1 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) { $bridgeRunning = $true }
} catch { $bridgeRunning = $false }

# ── 2. Levantar bridge en background si no está corriendo ────────────────────
if (-not $bridgeRunning) {
    Write-Host "⚡ Iniciando BotValia Bridge..." -ForegroundColor Cyan
    $logFile = "$env:TEMP\botvalia-bridge.log"

    # Arrancar bun en background, desacoplado de esta terminal
    $proc = Start-Process -FilePath "bun" `
        -ArgumentList "run", "./src/dev-entry.ts", "codex-bridge" `
        -WorkingDirectory $BridgeDir `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError  "$env:TEMP\botvalia-bridge-err.log" `
        -WindowStyle Hidden `
        -PassThru

    # Guardar PID para poder matar el bridge luego
    $proc.Id | Set-Content "$env:TEMP\botvalia-bridge.pid"

    # Esperar hasta que el bridge responda (máx 25 s, bun necesita compilar)
    $maxWait = 25
    $waited  = 0
    Write-Host "   Esperando bridge" -ForegroundColor DarkCyan -NoNewline
    while ($waited -lt $maxWait) {
        Start-Sleep -Milliseconds 500
        $waited += 0.5
        Write-Host "." -ForegroundColor DarkCyan -NoNewline
        try {
            $r = Invoke-WebRequest -Uri $BridgeUrl -TimeoutSec 1 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $bridgeRunning = $true; Write-Host ""; break }
        } catch {}
    }
    if (-not $bridgeRunning) { Write-Host "" }

    if ($bridgeRunning) {
        Write-Host "✅ Bridge listo en http://localhost:$BridgePort/v1" -ForegroundColor Green
    } else {
        Write-Warning "⚠️  Bridge tardó demasiado. Codex intentará conectarse igual."
    }
} else {
    Write-Host "✅ Bridge activo en http://localhost:$BridgePort/v1" -ForegroundColor DarkGreen
}

# ── 3. Lanzar Codex (botvalia-smart es ahora el default global) ─────────────
codex @args
