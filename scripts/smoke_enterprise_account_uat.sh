#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACCOUNT_UAT_PYTHON="${ACCOUNT_UAT_PYTHON:-uv run --with psycopg[binary] --with fastapi --with httpx python}"

cd "$ROOT_DIR"
read -r -a account_uat_python_parts <<< "$ACCOUNT_UAT_PYTHON"
"${account_uat_python_parts[@]}" scripts/enterprise_account_uat.py
