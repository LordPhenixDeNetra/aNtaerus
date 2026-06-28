$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "engine_rust")
cargo run
