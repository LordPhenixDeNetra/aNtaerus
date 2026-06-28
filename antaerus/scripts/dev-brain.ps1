$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "providers\\brain_python")
python -m pip install -e ".[dev]"
python bootstrap.py

