$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "gateway_go")
go run ./cmd/gateway
