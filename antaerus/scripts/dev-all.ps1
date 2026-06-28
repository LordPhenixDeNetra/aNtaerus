$root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; ./scripts/dev-brain.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; ./scripts/dev-engine.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; ./scripts/dev-gateway.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; ./scripts/dev-web.ps1"

