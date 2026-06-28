$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "brain_python")
python -m pip install -e ".[dev]"
python -m uvicorn antaerus_brain.app:app --host 0.0.0.0 --port 8000
