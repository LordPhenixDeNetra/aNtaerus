$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$process = Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$root'; go run ./interfaces/gateway_go/cmd/gateway" -PassThru -WindowStyle Hidden

try {
    $success = $false

    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Seconds 2

        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $success = $true
                break
            }
        }
        catch {
            # Retry until the gateway finishes compiling and binding the port.
        }
    }

    if (-not $success) {
        throw "Gateway smoke test failed to reach /health."
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
