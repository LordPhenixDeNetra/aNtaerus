#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKING_DIRECTORY="${ROOT_DIR}/providers/engine_rust"

cd "${WORKING_DIRECTORY}"
cargo run >/tmp/antaerus-bench-rust.log 2>&1 &
PROCESS_ID=$!

cleanup() {
  if kill -0 "${PROCESS_ID}" >/dev/null 2>&1; then
    kill "${PROCESS_ID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

SUCCESS=0
for _ in $(seq 1 15); do
  sleep 2
  if bash -c "echo >/dev/tcp/127.0.0.1/7001" >/dev/null 2>&1; then
    SUCCESS=1
    break
  fi
done

if [[ "${SUCCESS}" -ne 1 ]]; then
  echo "Rust gRPC latency bench failed to reach port 7001." >&2
  exit 1
fi

cd "${ROOT_DIR}"
ANTAERUS_RUN_LOCAL_BENCH=1 \
ANTAERUS_ENGINE_GRPC_ADDRESS=127.0.0.1:7001 \
go test ./interfaces/gateway_go/internal/bench -run TestGRPCLatencyBudget -count=1 -v
