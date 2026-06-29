param(
    [int]$StartupTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $env:TEMP "antaerus-dev-all-processes.json"

$services = @(
    @{
        Name = "brain"
        Script = ".\scripts\dev-brain.ps1"
        Port = 8000
    },
    @{
        Name = "engine-http"
        Script = ".\scripts\dev-engine.ps1"
        Port = 7000
    },
    @{
        Name = "engine-grpc"
        Script = ".\scripts\dev-engine.ps1"
        Port = 7001
        ReadinessOnly = $true
    },
    @{
        Name = "gateway"
        Script = ".\scripts\dev-gateway.ps1"
        Port = 8080
    },
    @{
        Name = "web"
        Script = ".\scripts\dev-web.ps1"
        Port = 5173
    }
)

if (Test-Path $pidFile) {
    Write-Warning "Un fichier PID existe deja dans $pidFile. Lance d'abord .\scripts\stop-all.ps1 si une session precedente tourne encore."
}

$startedProcesses = @()

foreach ($service in $services | Where-Object { -not $_.ReadinessOnly }) {
    $command = "Set-Location '$root'; & '$($service.Script)'"
    $process = Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command -PassThru

    $startedProcesses += [pscustomobject]@{
        Name = $service.Name
        Script = $service.Script
        Port = $service.Port
        Id = $process.Id
    }
}

$startedProcesses | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

try {
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)

    foreach ($service in $services) {
        $ready = $false

        while ((Get-Date) -lt $deadline) {
            try {
                $client = [System.Net.Sockets.TcpClient]::new()
                $async = $client.BeginConnect("127.0.0.1", $service.Port, $null, $null)

                if ($async.AsyncWaitHandle.WaitOne(1000)) {
                    $client.EndConnect($async)
                    $client.Close()
                    $ready = $true
                    break
                }

                $client.Close()
            }
            catch {
                Start-Sleep -Milliseconds 750
            }
        }

        if (-not $ready) {
            throw "Le service $($service.Name) n'a pas demarre a temps sur le port $($service.Port)."
        }
    }

    Write-Host "Tous les services natifs sont demarres."
    Write-Host "Frontend : http://localhost:5173"
    Write-Host "Gateway  : http://localhost:8080"
    Write-Host "Brain    : http://localhost:8000"
    Write-Host "Engine   : http://localhost:7000"
    Write-Host "Arret    : .\scripts\stop-all.ps1"
}
catch {
    Write-Error $_
    & (Join-Path $PSScriptRoot "stop-all.ps1") | Out-Host
    throw
}

