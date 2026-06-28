#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKING_DIRECTORY="${ROOT_DIR}/providers/brain_python"

cd "${WORKING_DIRECTORY}"
python -m pytest tests/test_secrets.py tests/test_secrets_no_leak.py -q
