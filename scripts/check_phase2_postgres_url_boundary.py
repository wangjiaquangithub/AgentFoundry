#!/usr/bin/env python3
"""Check the Phase 2 PostgreSQL-first database URL boundary.

This check does not open a database connection. It verifies that production
paths default to PostgreSQL, that postgres:// aliases are accepted, and that
sqlite:// remains an explicit local development compatibility path.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

POSTGRES_DEFAULT = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"

DATABASE_MODULE = ROOT / "backend" / "persistence" / "database.py"
MIGRATION_RUNNER = ROOT / "backend" / "persistence" / "migrations.py"
MIGRATION_SHELL = ROOT / "scripts" / "migrate_agentfoundry.sh"
SEED_SHELL = ROOT / "scripts" / "seed_agentfoundry.sh"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _check_runtime_contract() -> list[str]:
    from backend.persistence.database import (
        PostgresDatabase,
        SQLiteDatabase,
        create_configured_postgres_database,
        create_database,
        create_postgres_database,
        is_postgres_database_url,
    )

    errors: list[str] = []

    for database_url in (
        "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
        "postgres://agentfoundry:agentfoundry@localhost:5432/agentfoundry",
    ):
        if not is_postgres_database_url(database_url):
            errors.append(f"PostgreSQL URL was not accepted: {database_url}")
        if not isinstance(create_database(database_url), PostgresDatabase):
            errors.append(f"create_database did not select PostgreSQL for: {database_url}")

    sqlite_url = "sqlite:////tmp/agentfoundry-local-dev.db"
    if is_postgres_database_url(sqlite_url):
        errors.append("sqlite:// URL was incorrectly classified as PostgreSQL")
    if not isinstance(create_database(sqlite_url), SQLiteDatabase):
        errors.append("sqlite:// URL should remain an explicit local development path")

    if create_configured_postgres_database({"AGENTFOUNDRY_DATABASE_URL": sqlite_url}) is not None:
        errors.append("configured PostgreSQL factory must ignore sqlite:// URLs")
    configured = create_configured_postgres_database(
        {"AGENTFOUNDRY_DATABASE_URL": POSTGRES_DEFAULT}
    )
    if not isinstance(configured, PostgresDatabase):
        errors.append("configured PostgreSQL factory did not return a PostgreSQL database")

    try:
        create_postgres_database(sqlite_url)
    except ValueError as exc:
        if "postgresql://" not in str(exc) or "postgres://" not in str(exc):
            errors.append("PostgreSQL factory error should name accepted PostgreSQL schemes")
    else:
        errors.append("PostgreSQL factory accepted sqlite://")

    try:
        create_database("mysql://agentfoundry:agentfoundry@localhost/agentfoundry")
    except ValueError as exc:
        message = str(exc)
        if "postgresql:// for production" not in message:
            errors.append("unsupported URL error must point production users to PostgreSQL")
        if "sqlite:// for explicit local development compatibility" not in message:
            errors.append("unsupported URL error must limit SQLite to explicit local dev")
    else:
        errors.append("unsupported mysql:// URL was accepted")

    return errors


def _check_source_contracts() -> list[str]:
    errors: list[str] = []
    sources = {
        "database module": _read(DATABASE_MODULE),
        "migration runner": _read(MIGRATION_RUNNER),
        "migration shell": _read(MIGRATION_SHELL),
        "seed shell": _read(SEED_SHELL),
    }

    for label, source in sources.items():
        if POSTGRES_DEFAULT not in source and label != "database module":
            errors.append(f"{label} does not default to the PostgreSQL local URL")
        if "postgresql" not in source or "postgres" not in source:
            errors.append(f"{label} does not recognize PostgreSQL URL schemes")

    sqlite_scope_phrases = (
        "explicit local development compatibility",
        "local development compatibility",
    )
    for label, source in sources.items():
        if "sqlite://" in source and not any(phrase in source for phrase in sqlite_scope_phrases):
            errors.append(f"{label} mentions sqlite:// without local development scope")

    database_source = sources["database module"]
    if "POSTGRES_DATABASE_SCHEMES" not in database_source:
        errors.append("database module must define the PostgreSQL scheme boundary")
    if "Unsupported database URL scheme" not in database_source:
        errors.append("database module must reject unsupported database URL schemes")

    return errors


def main() -> int:
    errors = [*_check_runtime_contract(), *_check_source_contracts()]

    print("Phase 2 PostgreSQL URL boundary gate")
    print("- production default: PostgreSQL")
    print("- accepted PostgreSQL schemes: postgresql://, postgres://")
    print("- sqlite:// scope: explicit local development compatibility")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: database URL handling remains PostgreSQL-first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
