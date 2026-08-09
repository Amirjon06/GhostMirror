#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${GHOSTMIRROR_API_URL:-http://127.0.0.1:8000}"
WEB_HOST="${GHOSTMIRROR_WEB_HOST:-127.0.0.1}"
WEB_PORT="${GHOSTMIRROR_WEB_PORT:-5173}"
CLIPBOARD_INTERVAL="${GHOSTMIRROR_CLIPBOARD_INTERVAL:-1}"
FILESYSTEM_INTERVAL="${GHOSTMIRROR_FILESYSTEM_INTERVAL:-5}"
WATCH_PATH="${1:-${GHOSTMIRROR_WATCH_PATH:-}}"

if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
  printf "Python environment not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/apps/web/node_modules" ]; then
  printf "Frontend dependencies not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

if [ -n "$WATCH_PATH" ] && [ ! -d "$WATCH_PATH" ]; then
  printf "Watch path does not exist or is not a directory: %s\n" "$WATCH_PATH" >&2
  exit 1
fi

cleanup() {
  for pid in ${API_PID:-} ${CLIPBOARD_PID:-} ${FILESYSTEM_PID:-}; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 &
API_PID=$!

"$ROOT_DIR/.venv/bin/python" -m app.cli.clipboard --interval "$CLIPBOARD_INTERVAL" &
CLIPBOARD_PID=$!

if [ -n "$WATCH_PATH" ]; then
  "$ROOT_DIR/.venv/bin/python" -m app.cli.filesystem "$WATCH_PATH" --interval "$FILESYSTEM_INTERVAL" &
  FILESYSTEM_PID=$!
fi

printf "GhostMirror API: %s\n" "$API_URL"
printf "GhostMirror web: http://%s:%s\n" "$WEB_HOST" "$WEB_PORT"
printf "Clipboard monitoring: every %s second(s)\n" "$CLIPBOARD_INTERVAL"

if [ -n "$WATCH_PATH" ]; then
  printf "Filesystem monitoring: %s every %s second(s)\n" "$WATCH_PATH" "$FILESYSTEM_INTERVAL"
else
  printf "Filesystem monitoring: off\n"
fi

printf "\n"

cd "$ROOT_DIR/apps/web"
VITE_API_BASE_URL="$API_URL" npm run dev -- --host "$WEB_HOST" --port "$WEB_PORT"
