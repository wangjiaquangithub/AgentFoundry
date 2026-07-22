#!/usr/bin/env python3
"""Check PostgreSQL runtime dependency status without opening a database."""

from __future__ import annotations

import sys
from importlib.util import find_spec
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _expect_status_fields(status: Any, label: str) -> list[str]:
    errors: list[str] = []
    for field in ("driver_package", "driver_available", "runtime_ready", "operator_ready"):
        if not hasattr(status, field):
            errors.append(f"{label} status must expose {field}")
    return errors


def _check_postgres_driver_status() -> list[str]:
    from backend.persistence import (
        inspect_configured_database_status,
        is_postgres_driver_available,
    )

    errors: list[str] = []
    expected_driver_available = find_spec("psycopg") is not None
    helper_driver_available = is_postgres_driver_available()
    if helper_driver_available is not expected_driver_available:
        errors.append("is_postgres_driver_available must reflect psycopg import availability")

    postgres = inspect_configured_database_status(
        {
            "AGENTFOUNDRY_DATABASE_URL": (
                "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
            )
        }
    )
    errors.extend(_expect_status_fields(postgres, "postgresql://"))
    if postgres.driver_package != "psycopg":
        errors.append("postgresql:// status must identify psycopg as the driver package")
    if postgres.driver_available is not expected_driver_available:
        errors.append("postgresql:// status must report actual psycopg availability")
    if postgres.runtime_ready is not expected_driver_available:
        errors.append("postgresql:// runtime_ready must require psycopg availability")
    if postgres.operator_ready is not expected_driver_available:
        errors.append("postgresql:// operator_ready must require psycopg availability")
    if "secret" in repr(postgres):
        errors.append("postgresql:// runtime dependency status must not expose credentials")

    sqlite = inspect_configured_database_status(
        {"AGENTFOUNDRY_DATABASE_URL": "sqlite:////tmp/agentfoundry-local-dev.db"}
    )
    errors.extend(_expect_status_fields(sqlite, "sqlite://"))
    if sqlite.driver_package is not None:
        errors.append("sqlite:// status must not claim a PostgreSQL driver package")
    if sqlite.driver_available or sqlite.runtime_ready or sqlite.operator_ready:
        errors.append("sqlite:// must not be reported as PostgreSQL runtime ready")

    unconfigured = inspect_configured_database_status({})
    errors.extend(_expect_status_fields(unconfigured, "unconfigured"))
    if (
        unconfigured.driver_available
        or unconfigured.runtime_ready
        or unconfigured.operator_ready
    ):
        errors.append("unconfigured status must not be runtime ready")

    return errors


def _check_connect_error_mentions_driver() -> list[str]:
    from backend.persistence import PostgresDatabase

    if find_spec("psycopg") is not None:
        return []

    database = PostgresDatabase(
        database_url="postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
    )
    try:
        database.connect()
    except RuntimeError as exc:
        message = str(exc)
        if "psycopg" not in message:
            return ["missing-driver connect error must name psycopg"]
        if "secret" in message:
            return ["missing-driver connect error must not expose database credentials"]
        return []
    except Exception as exc:  # pragma: no cover - defensive gate output
        return [f"missing-driver connect error should be RuntimeError, got {type(exc).__name__}"]

    return ["PostgresDatabase.connect unexpectedly succeeded without psycopg"]


def main() -> int:
    errors = _check_postgres_driver_status()
    errors.extend(_check_connect_error_mentions_driver())

    print("Phase 2 PostgreSQL runtime dependency gate")
    print("- production URL detection remains PostgreSQL-first")
    print("- runtime_ready requires psycopg availability")
    print("- no database connection is opened")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL runtime dependency status is explicit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
