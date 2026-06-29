#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
go run ./scripts/validation/smoke_text_chat.go
