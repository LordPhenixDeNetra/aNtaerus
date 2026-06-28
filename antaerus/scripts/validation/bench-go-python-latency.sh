#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKING_DIRECTORY="${ROOT_DIR}/providers/brain_python"

cd "${WORKING_DIRECTORY}"
python bootstrap.py >/tmp/antaerus-bench-python.log 2>&1 &
PROCESS_ID=$!

cleanup() {
  if kill -0 "${PROCESS_ID}" >/dev/null 2>&1; then
    kill "${PROCESS_ID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

SUCCESS=0
for _ in $(seq 1 10); do
  sleep 2
  if curl --fail --silent http://127.0.0.1:8000/health >/dev/null; then
    SUCCESS=1
    break
  fi
done

if [[ "${SUCCESS}" -ne 1 ]]; then
  echo "Python latency bench failed to reach /health." >&2
  exit 1
fi

cd "${ROOT_DIR}"
ANTAERUS_RUN_LOCAL_BENCH=1 \
ANTAERUS_BRAIN_URL=http://127.0.0.1:8000 \
go test ./interfaces/gateway_go/internal/bench -run TestHTTPLatencyBudget -count=1 -v
