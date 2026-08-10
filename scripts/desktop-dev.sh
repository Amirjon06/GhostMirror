#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${GHOSTMIRROR_API_URL:-http://127.0.0.1:8000}"
WEB_HOST="${GHOSTMIRROR_WEB_HOST:-127.0.0.1}"
WEB_PORT="${GHOSTMIRROR_WEB_PORT:-5173}"

if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
  printf "Python environment not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/apps/web/node_modules" ]; then
  printf "Frontend dependencies not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

cleanup() {
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
API_PID=$!

printf "GhostMirror API: %s\n" "$API_URL"
printf "GhostMirror desktop web: http://%s:%s\n\n" "$WEB_HOST" "$WEB_PORT"

cd "$ROOT_DIR/apps/web"
VITE_API_BASE_URL="$API_URL" npm run dev -- --host "$WEB_HOST" --port "$WEB_PORT"
