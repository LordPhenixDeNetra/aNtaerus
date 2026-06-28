#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../brain_python"
python -m pip install -e ".[dev]"
python -m uvicorn antaerus_brain.app:app --host 0.0.0.0 --port 8000
