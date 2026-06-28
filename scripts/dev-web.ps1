$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "web")
npm install
npm run dev
