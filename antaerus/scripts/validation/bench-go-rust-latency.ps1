$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workingDirectory = Join-Path $root "providers\engine_rust"
$process = Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$workingDirectory'; cargo run" -PassThru -WindowStyle Hidden

try {
    $success = $false

    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Seconds 2

        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $client.Connect("127.0.0.1", 7001)
            $client.Close()
            $success = $true
            break
        }
        catch {
            # Retry until the gRPC listener is ready.
        }
    }

    if (-not $success) {
        throw "Rust gRPC latency bench failed to reach port 7001."
    }

    $env:ANTAERUS_RUN_LOCAL_BENCH = "1"
    $env:ANTAERUS_ENGINE_GRPC_ADDRESS = "127.0.0.1:7001"
    go test ./interfaces/gateway_go/internal/bench -run TestGRPCLatencyBudget -count=1 -v
    if ($LASTEXITCODE -ne 0) {
        throw "Go<->Rust latency budget test failed."
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
