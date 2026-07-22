#!/usr/bin/env python3
"""Check the Phase 2 PostgreSQL configuration status boundary.

This check does not open a database connection. It verifies that backend
status reporting can distinguish PostgreSQL production configuration from
unconfigured, unsupported, and explicit local SQLite compatibility paths.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def _check_status_contract() -> list[str]:
    from backend.persistence import (
        DatabaseConfigurationStatus,
        inspect_configured_database_status,
    )

    errors: list[str] = []

    empty = inspect_configured_database_status({})
    if not isinstance(empty, DatabaseConfigurationStatus):
        errors.append("database status helper must return DatabaseConfigurationStatus")
    if empty.configured:
        errors.append("empty environment must be reported as unconfigured")
    if empty.production_ready:
        errors.append("empty environment must not be production ready")
    if empty.operator_ready:
        errors.append("empty environment must not be operator ready")
    if empty.backend != "unconfigured":
        errors.append("empty environment must use the unconfigured backend label")
    if empty.required_backend != "postgresql":
        errors.append("empty environment must expose PostgreSQL as the required backend")
    if "postgresql://" not in empty.message:
        errors.append("unconfigured status must direct operators to postgresql://")

    postgres = inspect_configured_database_status(
        {
            "AGENTFOUNDRY_DATABASE_URL": (
                "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
            )
        }
    )
    if not postgres.configured or not postgres.production_ready:
        errors.append("postgresql:// status must be configured and production ready")
    if postgres.operator_ready is not postgres.runtime_ready:
        errors.append("postgresql:// operator_ready must follow runtime readiness")
    if postgres.scheme != "postgresql" or postgres.backend != "postgresql":
        errors.append("postgresql:// status must expose the PostgreSQL backend")
    if postgres.required_backend != "postgresql":
        errors.append("postgresql:// status must expose PostgreSQL as the required backend")
    if "secret" in postgres.message:
        errors.append("database status message must not expose URL credentials")

    postgres_alias = inspect_configured_database_status(
        {"AGENTFOUNDRY_DATABASE_URL": "postgres://agentfoundry:agentfoundry@localhost/db"}
    )
    if not postgres_alias.production_ready or postgres_alias.scheme != "postgres":
        errors.append("postgres:// alias must remain accepted as PostgreSQL")

    sqlite = inspect_configured_database_status(
        {"AGENTFOUNDRY_DATABASE_URL": "sqlite:////tmp/agentfoundry-local-dev.db"}
    )
    if not sqlite.configured:
        errors.append("sqlite:// status must report that a URL is configured")
    if sqlite.production_ready:
        errors.append("sqlite:// status must not be production ready")
    if sqlite.operator_ready:
        errors.append("sqlite:// status must not be operator ready")
    if sqlite.backend != "sqlite":
        errors.append("sqlite:// status must expose the local compatibility backend")
    if sqlite.required_backend != "postgresql":
        errors.append("sqlite:// status must still expose PostgreSQL as the required backend")
    if "explicit local development compatibility" not in sqlite.message:
        errors.append("sqlite:// status must be limited to explicit local development compatibility")

    unsupported = inspect_configured_database_status(
        {"AGENTFOUNDRY_DATABASE_URL": "mysql://agentfoundry:secret@localhost/db"}
    )
    if unsupported.production_ready:
        errors.append("unsupported URL schemes must not be production ready")
    if unsupported.operator_ready:
        errors.append("unsupported URL schemes must not be operator ready")
    if unsupported.backend != "unsupported" or unsupported.scheme != "mysql":
        errors.append("unsupported status must preserve the scheme without accepting it")
    if unsupported.required_backend != "postgresql":
        errors.append("unsupported status must expose PostgreSQL as the required backend")
    if "postgresql:// for production" not in unsupported.message:
        errors.append("unsupported status must direct production users to PostgreSQL")
    if "secret" in unsupported.message:
        errors.append("unsupported status message must not expose URL credentials")

    return errors


def main() -> int:
    errors = _check_status_contract()

    print("Phase 2 PostgreSQL configuration status gate")
    print("- production-ready backend: postgresql:// or postgres://")
    print("- sqlite:// scope: explicit local development compatibility")
    print("- database URL values are not exposed in status messages")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: database configuration status remains PostgreSQL-first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
