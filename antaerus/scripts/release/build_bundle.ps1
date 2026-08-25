<#
.SYNOPSIS
  Construit le bundle de distribution aNtaerus pour Windows.
.DESCRIPTION
  Build frontend Vite, binaire Go gateway (statique), Rust engine release,
  telecharge Python 3.11 relocalisable, cree un venv, prepare les telechargements
  des modeles (Whisper/Piper/YOLOv8) avec checksums SHA256, ecrit manifest.json.
.NOTES
  Script stdlib uniquement (Powershell + bitsadmin/certutil).
#>

[CmdletBinding()]
param(
  [string]$Version = "0.6.0-dev",
  [string]$OutputRoot = "$PSScriptRoot\..\..\..\bundle",
  [switch]$SkipDownloads,
  [switch]$SkipRust,
  [switch]$SkipGo,
  [switch]$SkipWeb,
  [switch]$SkipPython
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$RepoRoot = Resolve-Path "$PSScriptRoot\..\..\.."
$BundleRoot = (New-Item -ItemType Directory -Force -Path $OutputRoot).FullName
$WebRoot = Join-Path $RepoRoot "antaerus\interfaces\web"
$GatewayRoot = Join-Path $RepoRoot "antaerus\interfaces\gateway_go"
$BrainRoot = Join-Path $RepoRoot "antaerus\providers\brain_python"
$RustRoot = Join-Path $RepoRoot "antaerus\providers\engine_rust"
$BundleBin = Join-Path $BundleRoot "bin"
$BundleWeb = Join-Path $BundleRoot "web"
$BundleBrain = Join-Path $BundleRoot "brain"
$BundleModels = Join-Path $BundleRoot "models"
$BundlePython = Join-Path $BundleRoot "python"
$BundleVenv = Join-Path $BundleRoot ".venv"

function step($title) { Write-Host ""; Write-Host "==> $title" -ForegroundColor Cyan }

function New-Dir($p) { [void](New-Item -ItemType Directory -Force -Path $p) }

function Get-Relative([string]$base, [string]$file) {
  $baseFull = [System.IO.Path]::GetFullPath($base)
  if (-not $baseFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) { $baseFull += [System.IO.Path]::DirectorySeparatorChar }
  $baseUri = [System.Uri]$baseFull
  $fileUri = [System.Uri][System.IO.Path]::GetFullPath($file)
  $rel = [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString())
  return $rel -replace "\\", "/"
}

function Write-Checksum($file, [ref]$table) {
  if (-not (Test-Path $file)) { return }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLower()
  $rel = Get-Relative $BundleRoot $file
  $table.Value[$rel] = $hash
}

function Get-OrDownload($url, $dest, $expectedSha = "") {
  if (Test-Path $dest) {
    if ($expectedSha) {
      $actual = (Get-FileHash -Algorithm SHA256 -Path $dest).Hash.ToLower()
      if ($actual -eq $expectedSha) { Write-Host "    [skip] $dest exist & ok" ; return $true }
      Write-Host "    [update] checksum mismatch, re-downloading..."
      Remove-Item $dest -Force
    } else { Write-Host "    [skip] $dest exist"; return $true }
  }
  Write-Host "    [dl] $url"
  try {
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
  } catch {
    Write-Warning "Echec telechargement $url : $_"
    return $false
  }
  if ($expectedSha) {
    $actual = (Get-FileHash -Algorithm SHA256 -Path $dest).Hash.ToLower()
    if ($actual -ne $expectedSha) {
      Write-Error "Checksum invalide pour $dest (attendu $expectedSha, recu $actual)"
      return $false
    }
  }
  return $true
}

New-Dir $BundleBin; New-Dir $BundleWeb; New-Dir $BundleBrain; New-Dir $BundleModels; New-Dir $BundlePython; New-Dir $BundleVenv
$checksums = [ordered]@{}

# --- web ---
if (-not $SkipWeb) {
  step "Build frontend Vite (npm install + check + build)"
  Push-Location $WebRoot
  if (-not (Test-Path (Join-Path $WebRoot "node_modules"))) { npm ci }
  npm run check
  if ($LASTEXITCODE -ne 0) { throw "npm run check a echoue" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build a echoue" }
  Pop-Location
  Copy-Item -Recurse -Force "$WebRoot\dist\*" $BundleWeb
  Get-ChildItem -Recurse -File $BundleWeb | ForEach-Object { Write-Checksum $_.FullName ([ref]$checksums) }
}

# --- Go gateway ---
if (-not $SkipGo) {
  step "Build gateway_go statique (-ldflags=-s -w)"
  Push-Location $GatewayRoot
  $env:CGO_ENABLED = "0"
  go build -trimpath -ldflags="-s -w -X main.version=$Version" `
    -o (Join-Path $BundleBin "antaerus-gateway.exe") `
    ./cmd/gateway
  if ($LASTEXITCODE -ne 0) { throw "go build gateway a echoue" }
  go test ./...
  if ($LASTEXITCODE -ne 0) { throw "go test gateway a echoue" }
  Pop-Location
  Write-Checksum (Join-Path $BundleBin "antaerus-gateway.exe") ([ref]$checksums)
}

# --- Rust engine ---
if (-not $SkipRust) {
  step "Build engine_rust release"
  if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Push-Location $RustRoot
    cargo build --release
    if ($LASTEXITCODE -ne 0) { throw "cargo build a echoue" }
    $rustOut = Join-Path $RustRoot "target\release\antaerus-engine.exe"
    if (Test-Path $rustOut) {
      Copy-Item -Force $rustOut (Join-Path $BundleBin "antaerus-engine.exe")
      Write-Checksum (Join-Path $BundleBin "antaerus-engine.exe") ([ref]$checksums)
    }
    Pop-Location
  } else { Write-Warning "cargo non trouve, skip build Rust" }
}

# --- Python bundle ---
if (-not $SkipPython) {
  step "Python relocalisable Windows embeddable + venv"
  $pyZip = Join-Path $BundlePython "python-3.11.9-embed-amd64.zip"
  $pyDir = Join-Path $BundlePython "3.11"
  if (-not $SkipDownloads) {
    $ok = Get-OrDownload `
      "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip" `
      $pyZip
    if ($ok -and -not (Test-Path (Join-Path $pyDir "python.exe"))) {
      Expand-Archive -Path $pyZip -DestinationPath $pyDir -Force
    }
  }
  $systemPython = (Get-Command python -ErrorAction SilentlyContinue)
  if ($systemPython) {
    step "Creation venv relocalisable via python system + brain requirements"
    if (-not (Test-Path (Join-Path $BundleVenv "Scripts\python.exe"))) {
      & $systemPython.Source -m venv $BundleVenv
    }
    & (Join-Path $BundleVenv "Scripts\python.exe") -m pip install --upgrade pip setuptools wheel
    $brainReq = Join-Path $BrainRoot "requirements.txt"
    if (Test-Path $brainReq) {
      & (Join-Path $BundleVenv "Scripts\python.exe") -m pip install -r $brainReq
    } else {
      Write-Warning "requirements.txt brain_python absent, skip pip install"
    }
  } else { Write-Warning "python system absent : venv non construit (Python embed seulement)" }
  Copy-Item -Recurse -Force "$BrainRoot\src\antaerus_brain" $BundleBrain
  Copy-Item -Force "$BrainRoot\bootstrap.py" (Join-Path $BundleBrain "bootstrap.py") -ErrorAction SilentlyContinue
}

# --- modeles (placeholders + liens telechargement) ---
if (-not $SkipDownloads) {
  step "Preparation telechargements modeles (checksums a verifier apres DL)"
  # Whisper tiny / base (openai-community / huggingface)
  $whisperBase = Join-Path $BundleModels "whisper-base.pt"
  $null = Get-OrDownload "https://openaipublic.azureedge.net/main/whisper/models/37/f5a50d2e77f5f2ef9a3f9a1cb66ef42f1f6f683e1a7e08c935a68ecabbd9d0f8/base.pt" $whisperBase
  # Piper example voix : en_US-lessac-medium
  $piperVoice = Join-Path $BundleModels "en_US-lessac-medium.onnx"
  $null = Get-OrDownload "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true" $piperVoice
  $piperJson = Join-Path $BundleModels "en_US-lessac-medium.onnx.json"
  $null = Get-OrDownload "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true" $piperJson
  # YOLOv8n ultralytics github release
  $yolo = Join-Path $BundleModels "yolov8n.pt"
  $null = Get-OrDownload "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt" $yolo
  Get-ChildItem -File $BundleModels | ForEach-Object { Write-Checksum $_.FullName ([ref]$checksums) }
}

# --- env example + docs ---
Copy-Item -Force (Join-Path $RepoRoot "antaerus\.env.example") (Join-Path $BundleRoot ".env.example")
Write-Checksum (Join-Path $BundleRoot ".env.example") ([ref]$checksums)

# --- manifest.json ---
$takenAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$manifest = [ordered]@{
  name = "aNtaerus"
  version = $Version
  architecture = "windows-x86_64"
  takenAt = $takenAt
  layers = [ordered]@{
    web = "vite dist"
    gateway = "go $(& go version 2>$null)"
    brain = "python 3.11 embeddable + venv"
    engine = "rust cargo --release"
  }
  modelsPlaceholders = @(
    "whisper-base.pt",
    "en_US-lessac-medium.onnx",
    "en_US-lessac-medium.onnx.json",
    "yolov8n.pt"
  )
  entryPoints = [ordered]@{
    web = "./web/index.html"
    gateway = "./bin/antaerus-gateway.exe"
    engine = "./bin/antaerus-engine.exe"
    brain = "./.venv/Scripts/python.exe ./brain/bootstrap.py"
  }
  checksums = $checksums
  constraints = [ordered]@{
    newDependencies = "0"
    architecture = "4 couches React -> Go -> Python -> Rust"
  }
}
$manifestPath = Join-Path $BundleRoot "manifest.json"
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host ""
Write-Host "[DONE] Bundle ecrit : $BundleRoot" -ForegroundColor Green
Write-Host "  manifest : $manifestPath"
Write-Host "  fichiers signes : $($checksums.Count)"
