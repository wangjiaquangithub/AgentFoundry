"""Service composition helpers for production persistence-backed services."""

from __future__ import annotations

from backend.persistence import (
    PostgresAuditEventWriteRepository,
    PostgresDatabase,
    PostgresModelConfigReadRepository,
    PostgresModelConfigWriteRepository,
    create_configured_postgres_database,
)
from backend.services.model_configs import PlatformModelConfigService


def build_postgres_model_config_service(
    database: PostgresDatabase,
) -> PlatformModelConfigService:
    """Build the PostgreSQL-backed model config service."""

    return PlatformModelConfigService(
        model_config_reader=PostgresModelConfigReadRepository(database),
        model_config_writer=PostgresModelConfigWriteRepository(database),
        audit_event_writer=PostgresAuditEventWriteRepository(database),
    )


def build_configured_postgres_model_config_service() -> (
    PlatformModelConfigService | None
):
    """Build the model config service when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return build_postgres_model_config_service(database)
