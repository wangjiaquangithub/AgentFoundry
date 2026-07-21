#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${AGENTFOUNDRY_DATABASE_URL:-postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry}"

usage() {
  cat <<EOF
Usage: AGENTFOUNDRY_DATABASE_URL=postgresql://... $0

Applies AgentFoundry database migrations.

Environment:
  AGENTFOUNDRY_DATABASE_URL  Database URL. Defaults to:
                             postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry

PostgreSQL is the production target. sqlite:// URLs are accepted only for
local development compatibility.
EOF
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  "")
    ;;
  *)
    echo "unexpected argument: $1" >&2
    usage >&2
    exit 2
    ;;
esac

cd "$ROOT_DIR"
export PYTHONPATH="$ROOT_DIR/backend${PYTHONPATH:+:$PYTHONPATH}"

case "$DATABASE_URL" in
  postgresql://*|postgres://*)
    if command -v uv >/dev/null 2>&1; then
      exec uv run --with "psycopg[binary]" \
        python -c "from backend.persistence.migrations import main; main()" \
        --database-url "$DATABASE_URL"
    fi
    exec python3 -c "from backend.persistence.migrations import main; main()" \
      --database-url "$DATABASE_URL"
    ;;
  sqlite://*)
    exec python3 -c "from backend.persistence.migrations import main; main()" \
      --database-url "$DATABASE_URL"
    ;;
  *)
    echo "unsupported AGENTFOUNDRY_DATABASE_URL scheme: $DATABASE_URL" >&2
    echo "use postgresql:// for production or sqlite:// for local development" >&2
    exit 2
    ;;
esac
