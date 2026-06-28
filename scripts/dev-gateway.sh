#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../gateway_go"
go run ./cmd/gateway
