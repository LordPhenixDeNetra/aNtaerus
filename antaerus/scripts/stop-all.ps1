$ErrorActionPreference = "Stop"
$pidFile = Join-Path $env:TEMP "antaerus-dev-all-processes.json"

if (-not (Test-Path $pidFile)) {
    Write-Host "Aucun processus dev-all enregistre."
    exit 0
}

$processes = Get-Content -Path $pidFile -Raw | ConvertFrom-Json

foreach ($process in $processes) {
    try {
        $running = Get-Process -Id $process.Id -ErrorAction Stop
        Stop-Process -Id $running.Id -Force
        Write-Host "Arret de $($process.Name) (PID $($process.Id))."
    }
    catch {
        Write-Host "$($process.Name) est deja arrete ou introuvable."
    }
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
