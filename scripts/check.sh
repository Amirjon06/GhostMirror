#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -x "$ROOT_DIR/.venv/bin/pytest" ]; then
  printf "Python test environment not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

"$ROOT_DIR/.venv/bin/pytest"

cd "$ROOT_DIR/apps/web"
npm run test
npm run lint
npm run build

if [ "${RUN_E2E:-0}" = "1" ]; then
  npm run test:e2e
fi
