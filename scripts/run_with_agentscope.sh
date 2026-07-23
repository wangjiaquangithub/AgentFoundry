#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AGENTSCOPE_DIR="$ROOT_DIR/../agentscope"

if [ -n "${AGENTSCOPE_DIR:-}" ]; then
	RUNTIME_DIR="$AGENTSCOPE_DIR"
elif [ -f "$DEFAULT_AGENTSCOPE_DIR/pyproject.toml" ]; then
	RUNTIME_DIR="$DEFAULT_AGENTSCOPE_DIR"
else
	RUNTIME_DIR=""
fi

if [ -n "$RUNTIME_DIR" ]; then
	if [ ! -f "$RUNTIME_DIR/pyproject.toml" ]; then
		echo "AgentScope checkout not found at $RUNTIME_DIR" >&2
		exit 1
	fi
	if ! command -v uv >/dev/null 2>&1; then
		echo "uv is required when AGENTSCOPE_DIR selects an AgentScope checkout." >&2
		exit 1
	fi
	cd "$RUNTIME_DIR"
	exec uv run --extra service --extra storage --extra rag python "$@"
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! "$PYTHON_BIN" -c 'import agentscope' >/dev/null 2>&1; then
	echo "AgentScope is not installed for $PYTHON_BIN." >&2
	echo "Install the pinned AgentScope runtime package, or set AGENTSCOPE_DIR for local development." >&2
	exit 1
fi

cd "$ROOT_DIR"
exec "$PYTHON_BIN" "$@"
