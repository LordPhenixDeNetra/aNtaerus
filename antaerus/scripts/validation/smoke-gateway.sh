#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
go run ./interfaces/gateway_go/cmd/gateway &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT

for _ in $(seq 1 10); do
  if curl --fail --silent http://127.0.0.1:8080/health >/dev/null; then
    exit 0
  fi

  sleep 2
done

echo "Gateway smoke test failed to reach /health." >&2
exit 1
