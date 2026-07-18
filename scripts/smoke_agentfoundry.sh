#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTSCOPE_DIR="${AGENTSCOPE_DIR:-$(cd "$ROOT_DIR/../agentscope" && pwd)}"

if [ ! -f "$AGENTSCOPE_DIR/pyproject.toml" ]; then
  echo "AgentScope runtime not found at $AGENTSCOPE_DIR" >&2
  echo "Set AGENTSCOPE_DIR to a local AgentScope checkout." >&2
  exit 1
fi

export PYTHONPATH="$ROOT_DIR/backend${PYTHONPATH:+:$PYTHONPATH}"
export ENTERPRISE_FIXTURE_PATH="${ENTERPRISE_FIXTURE_PATH:-$ROOT_DIR/backend/fixtures/tenant_data.local.json}"

cd "$AGENTSCOPE_DIR"

uv run --extra service --extra storage --extra rag \
  python "$ROOT_DIR/backend/smoke_test_platform.py"
