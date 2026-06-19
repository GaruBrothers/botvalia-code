@echo off
:: BotValia Bridge - Auto-start silencioso al iniciar Windows
:: Siempre mata el proceso anterior para garantizar código actualizado

set BRIDGE_DIR=C:\Users\jhcamachov\Documents\GitHub\PERSONAL\botvalia-code
set LOG=%TEMP%\botvalia-bridge.log
set ERR=%TEMP%\botvalia-bridge-err.log
set PID_FILE=%TEMP%\botvalia-bridge.pid

:: Matar bridge anterior si existe (garantiza código fresco en cada inicio)
powershell -WindowStyle Hidden -Command ^
  "if (Test-Path '%PID_FILE%') { try { Stop-Process -Id (Get-Content '%PID_FILE%') -Force -EA SilentlyContinue } catch {} }"

:: Matar cualquier proceso en puerto 5008
powershell -WindowStyle Hidden -Command ^
  "netstat -ano | Select-String ':5008 ' | ForEach-Object { $id = ($_ -split '\s+')[-1]; if ($id -match '^\d+$') { Stop-Process -Id ([int]$id) -Force -EA SilentlyContinue } }"

:: Arrancar bridge con código actualizado
powershell -WindowStyle Hidden -Command ^
  "& { $p = Start-Process -FilePath 'bun' -ArgumentList 'run','./src/dev-entry.ts','codex-bridge' -WorkingDirectory '%BRIDGE_DIR%' -RedirectStandardOutput '%LOG%' -RedirectStandardError '%ERR%' -WindowStyle Hidden -PassThru; $p.Id | Set-Content '%PID_FILE%' }"

exit
