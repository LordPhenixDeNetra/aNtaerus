#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../providers/brain_python"
python -m pip install -e ".[dev]"
python bootstrap.py

