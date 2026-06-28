$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workingDirectory = Join-Path $root "providers\brain_python"
$process = Start-Process powershell -ArgumentList "-NoProfile", "-Command", "Set-Location '$workingDirectory'; python bootstrap.py" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "Brain smoke test failed with status $($response.StatusCode)."
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
