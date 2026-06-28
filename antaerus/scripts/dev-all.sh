#!/usr/bin/env bash
set -euo pipefail

./scripts/dev-brain.sh &
./scripts/dev-engine.sh &
./scripts/dev-gateway.sh &
./scripts/dev-web.sh &

wait

