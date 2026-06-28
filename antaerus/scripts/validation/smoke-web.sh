#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../interfaces/web"
npm run preview -- --host 127.0.0.1 --port 4173 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

sleep 5
curl --fail --silent http://127.0.0.1:4173 >/dev/null
