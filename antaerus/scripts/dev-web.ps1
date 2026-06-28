$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "interfaces\\web")
npm install
npm run dev

