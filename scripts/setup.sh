#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements-dev.txt

cd "$ROOT_DIR/apps/web"
npm ci

printf "\nGhostMirror dependencies are installed.\n"
printf "Run ./scripts/dev.sh to start the API and dashboard.\n"
