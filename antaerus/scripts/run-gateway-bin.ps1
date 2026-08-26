$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

function Get-DotEnvValues {
    param([string]$FilePath)
    $values = @{}
    if (-not (Test-Path $FilePath)) { return $values }
    foreach ($line in Get-Content -Path $FilePath) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) { continue }
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $values[$key] = $value
    }
    return $values
}

$dotEnv = Get-DotEnvValues -FilePath $envFile
foreach ($entry in $dotEnv.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, [EnvironmentVariableTarget]::Process)
}

Set-Location $root
$exe = Join-Path $root "bin\gateway.exe"

# ===== CRITICAL: REBUILD Gateway Go AVANT lancement (applique les derniers correctifs voice_session.go AlreadyExists retry) =====
# Si on skip rebuild -> ancien binaire code sans retry AlreadyExists -> user a toujours l'erreur UI.
$gwDir = Join-Path $root "interfaces\gateway_go"
if (Test-Path (Join-Path $gwDir "go.mod")) {
    Write-Host "[aNtaerus] Rebuild Gateway Go (applique voice_session.go retry AlreadyExists cleanup) -> $exe ..." -ForegroundColor Gray
    Set-Location $gwDir
    & go build -o $exe ./cmd/gateway
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[aNtaerus] ECHEC go build gateway.exe. Corrigez erreurs Go ci-dessus."
        exit 1
    }
    Set-Location $root
    Write-Host "[aNtaerus] Gateway Go rebuild OK (nouveau voice_session.go + WS fixes)." -ForegroundColor Green
}

Write-Host "Starting NEW gateway.exe: $exe (cwd=$(Get-Location))" -ForegroundColor Cyan
& $exe
