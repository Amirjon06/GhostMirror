#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST="${GHOSTMIRROR_API_HOST:-127.0.0.1}"
API_PORT="${GHOSTMIRROR_API_PORT:-8000}"

if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
  printf "Python environment not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host "$API_HOST" --port "$API_PORT"
