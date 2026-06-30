#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"
ANTAERUS_RUN_LOCAL_BENCH=1 \
go test ./interfaces/gateway_go/internal/http -run TestVoiceEndToEndLatencyBudget -count=1 -v
