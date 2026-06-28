$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "")
go run ./interfaces/gateway_go/cmd/gateway

