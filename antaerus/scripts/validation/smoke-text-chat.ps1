$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

go run ./scripts/validation/smoke_text_chat.go
