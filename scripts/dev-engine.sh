#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../engine_rust"
cargo run
