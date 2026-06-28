#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../providers/engine_rust"
cargo run

