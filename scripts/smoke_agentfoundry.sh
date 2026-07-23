#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PYTHONPATH="$ROOT_DIR/backend${PYTHONPATH:+:$PYTHONPATH}"
export ENTERPRISE_FIXTURE_PATH="${ENTERPRISE_FIXTURE_PATH:-$ROOT_DIR/backend/fixtures/tenant_data.local.json}"

exec "$ROOT_DIR/scripts/run_with_agentscope.sh" "$ROOT_DIR/backend/smoke_test_platform.py"
