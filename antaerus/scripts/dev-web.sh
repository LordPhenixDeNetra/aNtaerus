#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../interfaces/web"
npm install
npm run dev

