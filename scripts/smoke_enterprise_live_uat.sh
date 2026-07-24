#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTSCOPE_PYTHON="${AGENTSCOPE_PYTHON:-$ROOT_DIR/../agentscope/.venv/bin/python}"
POSTGRES_PYTHON="${POSTGRES_PYTHON:-uv run --with psycopg[binary] python}"

if [[ ! -x "$AGENTSCOPE_PYTHON" ]]; then
  echo "AgentScope Python not found: $AGENTSCOPE_PYTHON" >&2
  exit 1
fi
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY is required for the live AgentScope acceptance." >&2
  exit 1
fi

cd "$ROOT_DIR"
read -r -a postgres_python_parts <<< "$POSTGRES_PYTHON"
"${postgres_python_parts[@]}" scripts/enterprise_live_uat.py postgres
"$AGENTSCOPE_PYTHON" scripts/enterprise_live_uat.py weather
