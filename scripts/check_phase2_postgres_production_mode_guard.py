#!/usr/bin/env python3
"""Check that production mode requires PostgreSQL persistence."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

POSTGRES_URL = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
SQLITE_URL = "sqlite:////tmp/agentfoundry-local-dev.db"


def _expect_runtime_error(environ: dict[str, str], fragments: tuple[str, ...]) -> list[str]:
    from backend.persistence import require_postgres_database_for_production

    errors: list[str] = []
    try:
        require_postgres_database_for_production(environ)
    except RuntimeError as exc:
        message = str(exc)
        for fragment in fragments:
            if fragment not in message:
                errors.append(f"production guard error must mention {fragment!r}: {message}")
        leaked = ("agentfoundry:agentfoundry", "secret", "localhost:5432", "sqlite:////tmp")
        if any(fragment in message for fragment in leaked):
            errors.append(f"production guard error must not expose connection details: {message}")
    else:
        errors.append(f"production guard unexpectedly accepted: {environ}")
    return errors


def _check_production_guard_contract() -> list[str]:
    from backend.persistence import (
        create_configured_postgres_database,
        inspect_configured_database_status,
        is_production_environment,
        require_postgres_database_for_production,
    )
    from backend.persistence.database import PostgresDatabase

    errors: list[str] = []

    if is_production_environment({"AGENTFOUNDRY_ENV": "development"}):
        errors.append("development environment must not be treated as production")
    if not is_production_environment({"AGENTFOUNDRY_ENV": "production"}):
        errors.append("AGENTFOUNDRY_ENV=production must enable production mode")
    if not is_production_environment({"AGENTFOUNDRY_ENV": "prod"}):
        errors.append("AGENTFOUNDRY_ENV=prod must enable production mode")

    local_sqlite_status = require_postgres_database_for_production(
        {
            "AGENTFOUNDRY_ENV": "development",
            "AGENTFOUNDRY_DATABASE_URL": SQLITE_URL,
        }
    )
    if local_sqlite_status.production_mode:
        errors.append("development SQLite compatibility must not report production mode")
    if local_sqlite_status.production_ready:
        errors.append("development SQLite compatibility must not be production ready")
    if local_sqlite_status.operator_ready:
        errors.append("development SQLite compatibility must not be operator ready")

    postgres_status = require_postgres_database_for_production(
        {
            "AGENTFOUNDRY_ENV": "production",
            "AGENTFOUNDRY_DATABASE_URL": POSTGRES_URL,
        }
    )
    if not postgres_status.production_mode or not postgres_status.production_ready:
        errors.append("production PostgreSQL URL must pass the production guard")
    if postgres_status.operator_ready is not postgres_status.runtime_ready:
        errors.append("production PostgreSQL operator readiness must follow runtime readiness")
    configured = create_configured_postgres_database(
        {
            "AGENTFOUNDRY_ENV": "production",
            "AGENTFOUNDRY_DATABASE_URL": POSTGRES_URL,
        }
    )
    if not isinstance(configured, PostgresDatabase):
        errors.append("production PostgreSQL config must create a PostgresDatabase")

    errors.extend(
        _expect_runtime_error(
            {"AGENTFOUNDRY_ENV": "production"},
            ("AGENTFOUNDRY_ENV=production", "AGENTFOUNDRY_DATABASE_URL"),
        )
    )
    errors.extend(
        _expect_runtime_error(
            {
                "AGENTFOUNDRY_ENV": "production",
                "AGENTFOUNDRY_DATABASE_URL": SQLITE_URL,
            },
            ("AGENTFOUNDRY_ENV=production", "sqlite://", "postgresql://"),
        )
    )
    errors.extend(
        _expect_runtime_error(
            {
                "AGENTFOUNDRY_ENV": "production",
                "AGENTFOUNDRY_DATABASE_URL": "mysql://agentfoundry:secret@localhost/db",
            },
            ("AGENTFOUNDRY_ENV=production", "PostgreSQL"),
        )
    )

    sqlite_status = inspect_configured_database_status(
        {
            "AGENTFOUNDRY_ENV": "production",
            "AGENTFOUNDRY_DATABASE_URL": SQLITE_URL,
        }
    )
    if not sqlite_status.production_mode:
        errors.append("status must expose production_mode for production SQLite rejection")
    if sqlite_status.production_ready:
        errors.append("production SQLite status must not be production ready")
    if sqlite_status.operator_ready:
        errors.append("production SQLite status must not be operator ready")

    return errors


def main() -> int:
    errors = _check_production_guard_contract()

    print("Phase 2 PostgreSQL production mode guard")
    print("- production mode: AGENTFOUNDRY_ENV=production or prod")
    print("- production persistence: postgresql:// or postgres:// only")
    print("- sqlite:// scope: explicit local development compatibility")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: production mode cannot run on SQLite or unsupported database URLs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
