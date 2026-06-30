$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Set-Location $root
$env:ANTAERUS_RUN_LOCAL_BENCH = "1"

go test ./interfaces/gateway_go/internal/http -run TestVoiceEndToEndLatencyBudget -count=1 -v
if ($LASTEXITCODE -ne 0) {
    throw "Voice end-to-end latency budget test failed."
}
