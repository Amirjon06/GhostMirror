#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST="${GHOSTMIRROR_API_HOST:-127.0.0.1}"
API_PORT="${GHOSTMIRROR_API_PORT:-8000}"
API_URL="http://$API_HOST:$API_PORT"

if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
  printf "Python environment not found. Run ./scripts/setup.sh first.\n" >&2
  exit 1
fi

if "$ROOT_DIR/.venv/bin/python" - "$API_URL" <<'PY'
import sys
from urllib.request import urlopen

try:
    with urlopen(f"{sys.argv[1]}/health", timeout=1) as response:
        if response.status == 200:
            sys.exit(0)
except Exception:
    sys.exit(1)

sys.exit(1)
PY
then
  printf "GhostMirror API is already running at %s\n" "$API_URL"
  exit 0
fi

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf "Port %s is already in use, but GhostMirror did not respond at %s/health.\n" "$API_PORT" "$API_URL" >&2
  printf "Stop the process using that port, then run ./scripts/api.sh again.\n" >&2
  printf "Command: kill \$(lsof -ti tcp:%s)\n" "$API_PORT" >&2
  exit 1
fi

cd "$ROOT_DIR/backend"
"$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host "$API_HOST" --port "$API_PORT"
