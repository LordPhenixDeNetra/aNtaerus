$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workingDirectory = Join-Path $root "interfaces\web"
$process = Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$workingDirectory'; npm run preview -- --host 127.0.0.1 --port 4173" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4173" -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "Web smoke test failed with status $($response.StatusCode)."
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
