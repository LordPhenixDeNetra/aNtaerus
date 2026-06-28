#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
go run ./interfaces/gateway_go/cmd/gateway

