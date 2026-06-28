$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workingDirectory = Join-Path $root "providers\brain_python"
$process = Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$workingDirectory'; python bootstrap.py" -PassThru -WindowStyle Hidden

try {
    $success = $false

    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Seconds 2

        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $success = $true
                break
            }
        }
        catch {
            # Retry until the brain service is ready.
        }
    }

    if (-not $success) {
        throw "Python latency bench failed to reach /health."
    }

    $env:ANTAERUS_RUN_LOCAL_BENCH = "1"
    $env:ANTAERUS_BRAIN_URL = "http://127.0.0.1:8000"
    go test ./interfaces/gateway_go/internal/bench -run TestHTTPLatencyBudget -count=1 -v
    if ($LASTEXITCODE -ne 0) {
        throw "Go<->Python latency budget test failed."
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
