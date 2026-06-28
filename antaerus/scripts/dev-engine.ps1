$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "providers\\engine_rust")
cargo run

