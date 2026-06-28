$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workingDirectory = Join-Path $root "providers\brain_python"

Push-Location $workingDirectory

try {
    python -m pytest tests/test_secrets.py tests/test_secrets_no_leak.py -q

    if ($LASTEXITCODE -ne 0) {
        throw "Secret validation tests failed."
    }
}
finally {
    Pop-Location
}
