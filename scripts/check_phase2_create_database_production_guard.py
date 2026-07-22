#!/usr/bin/env python3
"""Check that the generic database factory cannot bypass production PG guard."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

POSTGRES_URL = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
SQLITE_URL = "sqlite:////tmp/agentfoundry-local-dev.db"


def _expect_runtime_error(callable_name: str, action, fragments: tuple[str, ...]) -> list[str]:
    errors: list[str] = []
    try:
        action()
    except RuntimeError as exc:
        message = str(exc)
        for fragment in fragments:
            if fragment not in message:
                errors.append(f"{callable_name} error must mention {fragment!r}: {message}")
        leaked = ("agentfoundry:agentfoundry", "secret", "localhost:5432", "sqlite:////tmp")
        if any(fragment in message for fragment in leaked):
            errors.append(f"{callable_name} error must not expose connection details: {message}")
    else:
        errors.append(f"{callable_name} unexpectedly accepted a production-unsafe URL")
    return errors


def _check_create_database_production_guard() -> list[str]:
    from backend.persistence.database import (
        PostgresDatabase,
        SQLiteDatabase,
        create_database,
    )

    errors: list[str] = []

    local_database = create_database(
        SQLITE_URL,
        {"AGENTFOUNDRY_ENV": "development"},
    )
    if not isinstance(local_database, SQLiteDatabase):
        errors.append("development sqlite:// must remain explicit local compatibility")

    errors.extend(
        _expect_runtime_error(
            "create_database",
            lambda: create_database(
                SQLITE_URL,
                {"AGENTFOUNDRY_ENV": "production"},
            ),
            ("AGENTFOUNDRY_ENV=production", "sqlite://", "postgresql://"),
        )
    )
    errors.extend(
        _expect_runtime_error(
            "create_database",
            lambda: create_database(
                "mysql://agentfoundry:secret@localhost/agentfoundry",
                {"AGENTFOUNDRY_ENV": "production"},
            ),
            ("AGENTFOUNDRY_ENV=production", "PostgreSQL"),
        )
    )

    with patch("backend.persistence.database.is_postgres_driver_available", return_value=True):
        postgres_database = create_database(
            POSTGRES_URL,
            {"AGENTFOUNDRY_ENV": "production"},
        )
    if not isinstance(postgres_database, PostgresDatabase):
        errors.append("production postgresql:// must create a PostgresDatabase")

    with patch("backend.persistence.database.is_postgres_driver_available", return_value=False):
        errors.extend(
            _expect_runtime_error(
                "create_database",
                lambda: create_database(
                    POSTGRES_URL,
                    {"AGENTFOUNDRY_ENV": "production"},
                ),
                ("AGENTFOUNDRY_ENV=production", "runtime readiness", "psycopg"),
            )
        )

    return errors


def main() -> int:
    errors = _check_create_database_production_guard()

    print("Phase 2 create_database production guard")
    print("- production factory path: PostgreSQL only")
    print("- sqlite:// scope: explicit local development compatibility")
    print("- validation: no database connection required")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: generic database factory cannot bypass the production PG guard.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
