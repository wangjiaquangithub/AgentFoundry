#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTSCOPE_PYTHON="$ROOT_DIR/../agentscope/.venv/bin/python"
PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$AGENTSCOPE_PYTHON" ]]; then
    PYTHON_BIN="$AGENTSCOPE_PYTHON"
  else
    PYTHON_BIN="python3"
  fi
fi

export PYTHONPATH="$ROOT_DIR/backend:$ROOT_DIR${PYTHONPATH:+:$PYTHONPATH}"
export AGENTFOUNDRY_UVICORN_PYTHON="${AGENTFOUNDRY_UVICORN_PYTHON:-$PYTHON_BIN}"

cd "$ROOT_DIR"
exec "$PYTHON_BIN" "$ROOT_DIR/scripts/enterprise_e2e.py"
