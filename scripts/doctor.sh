#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0

pass() {
  printf "OK    %s\n" "$1"
}

warn() {
  printf "WARN  %s\n" "$1"
}

error() {
  printf "ERROR %s\n" "$1"
  ERRORS=1
}

if command -v git >/dev/null 2>&1; then
  pass "Git is installed: $(git --version)"
else
  error "Git is not installed"
fi

if command -v python3 >/dev/null 2>&1; then
  if python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)'; then
    pass "Python is installed: $(python3 --version)"
  else
    error "Python 3.11 or newer is required"
  fi
else
  error "Python 3 is not installed"
fi

if command -v node >/dev/null 2>&1; then
  pass "Node.js is installed: $(node --version)"
else
  error "Node.js is not installed"
fi

if command -v npm >/dev/null 2>&1; then
  pass "npm is installed: $(npm --version)"
else
  error "npm is not installed"
fi

if command -v docker >/dev/null 2>&1; then
  pass "Docker CLI is installed"
else
  warn "Docker CLI is not installed"
fi

if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  pass "Backend virtual environment exists"
else
  warn "Backend virtual environment is missing; run ./scripts/setup.sh"
fi

if [ -d "$ROOT_DIR/apps/web/node_modules" ]; then
  pass "Frontend dependencies are installed"
else
  warn "Frontend dependencies are missing; run ./scripts/setup.sh"
fi

if [ -d "$ROOT_DIR/data" ]; then
  pass "Local data directory exists"
else
  warn "Local data directory is missing; it will be created when the API starts"
fi

if [ "$ERRORS" -ne 0 ]; then
  printf "\nGhostMirror environment check failed.\n"
  exit 1
fi

printf "\nGhostMirror environment check passed.\n"
