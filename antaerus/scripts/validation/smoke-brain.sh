#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../providers/brain_python"
python bootstrap.py &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

sleep 5
curl --fail --silent http://127.0.0.1:8000/health >/dev/null
