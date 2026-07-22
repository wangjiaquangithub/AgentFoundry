"""Service composition helpers for production persistence-backed services."""

from __future__ import annotations

from typing import Callable

from backend.persistence import (
    PostgresAuditEventWriteRepository,
    PostgresDatabase,
    PostgresDocumentChunkReadRepository,
    PostgresDocumentReadRepository,
    PostgresKnowledgeBaseReadRepository,
    PostgresModelConfigReadRepository,
    PostgresModelConfigWriteRepository,
    PostgresRetrievalEventWriteRepository,
    create_configured_postgres_database,
)
from backend.services.knowledge import PlatformKnowledgeRetrievalService
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


def build_postgres_knowledge_retrieval_service(
    database: PostgresDatabase,
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeRetrievalService:
    """Build the PostgreSQL-backed knowledge retrieval service."""

    return PlatformKnowledgeRetrievalService(
        knowledge_base_repository=PostgresKnowledgeBaseReadRepository(database),
        document_repository=PostgresDocumentReadRepository(database),
        document_chunk_repository=PostgresDocumentChunkReadRepository(database),
        retrieval_event_writer=PostgresRetrievalEventWriteRepository(database),
        audit_event_writer=PostgresAuditEventWriteRepository(database),
        now=now,
    )


def build_configured_postgres_knowledge_retrieval_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeRetrievalService | None:
    """Build the knowledge retrieval service when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return build_postgres_knowledge_retrieval_service(database, now=now)
