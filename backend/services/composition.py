"""Service composition helpers for production persistence-backed services."""

from __future__ import annotations

from typing import Callable

from backend.persistence import (
    PostgresAuditEventWriteRepository,
    PostgresDatabase,
    PostgresDocumentChunkReadRepository,
    PostgresDocumentChunkWriteRepository,
    PostgresDocumentReadRepository,
    PostgresDocumentWriteRepository,
    PostgresEmbeddingRecordReadRepository,
    PostgresEmbeddingRecordWriteRepository,
    PostgresKnowledgeBaseReadRepository,
    PostgresKnowledgeBaseWriteRepository,
    PostgresModelConfigReadRepository,
    PostgresModelConfigWriteRepository,
    PostgresRetrievalEventWriteRepository,
    create_configured_postgres_database,
)
from backend.services.knowledge import (
    PlatformKnowledgeDocumentReadinessService,
    PlatformKnowledgeResponseService,
    PlatformKnowledgeRetrievalService,
)
from backend.services.knowledge_ingestion import PlatformKnowledgeIngestionService
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


def build_configured_postgres_knowledge_base_read_repository() -> (
    PostgresKnowledgeBaseReadRepository | None
):
    """Build the knowledge base read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresKnowledgeBaseReadRepository(database)


def build_configured_postgres_knowledge_base_write_repository() -> (
    PostgresKnowledgeBaseWriteRepository | None
):
    """Build the knowledge base write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresKnowledgeBaseWriteRepository(database)


def build_configured_postgres_knowledge_document_read_repository() -> (
    PostgresDocumentReadRepository | None
):
    """Build the knowledge document read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresDocumentReadRepository(database)


def build_configured_postgres_knowledge_document_write_repository() -> (
    PostgresDocumentWriteRepository | None
):
    """Build the knowledge document write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresDocumentWriteRepository(database)


def build_configured_postgres_knowledge_document_chunk_read_repository() -> (
    PostgresDocumentChunkReadRepository | None
):
    """Build the document chunk read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresDocumentChunkReadRepository(database)


def build_configured_postgres_knowledge_document_chunk_write_repository() -> (
    PostgresDocumentChunkWriteRepository | None
):
    """Build the document chunk write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresDocumentChunkWriteRepository(database)


def build_configured_postgres_knowledge_embedding_record_read_repository() -> (
    PostgresEmbeddingRecordReadRepository | None
):
    """Build the embedding record read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresEmbeddingRecordReadRepository(database)


def build_configured_postgres_knowledge_embedding_record_write_repository() -> (
    PostgresEmbeddingRecordWriteRepository | None
):
    """Build the embedding record write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresEmbeddingRecordWriteRepository(database)


def build_postgres_knowledge_document_readiness_service(
    database: PostgresDatabase,
) -> PlatformKnowledgeDocumentReadinessService:
    """Build the PostgreSQL-backed knowledge document readiness service."""

    return PlatformKnowledgeDocumentReadinessService(
        knowledge_base_repository=PostgresKnowledgeBaseReadRepository(database),
        document_repository=PostgresDocumentReadRepository(database),
        document_chunk_repository=PostgresDocumentChunkReadRepository(database),
        embedding_record_repository=PostgresEmbeddingRecordReadRepository(database),
        model_config_repository=PostgresModelConfigReadRepository(database),
    )


def build_configured_postgres_knowledge_document_readiness_service() -> (
    PlatformKnowledgeDocumentReadinessService | None
):
    """Build the knowledge readiness service when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return build_postgres_knowledge_document_readiness_service(database)


def build_postgres_knowledge_ingestion_service(
    database: PostgresDatabase,
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeIngestionService:
    """Build the PostgreSQL-backed knowledge ingestion service."""

    kwargs = {}
    if now is not None:
        kwargs["now"] = now

    return PlatformKnowledgeIngestionService(
        knowledge_base_repository=PostgresKnowledgeBaseReadRepository(database),
        document_repository=PostgresDocumentWriteRepository(database),
        document_chunk_repository=PostgresDocumentChunkWriteRepository(database),
        document_chunk_read_repository=PostgresDocumentChunkReadRepository(database),
        embedding_record_repository=PostgresEmbeddingRecordWriteRepository(database),
        **kwargs,
    )


def build_configured_postgres_knowledge_ingestion_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeIngestionService | None:
    """Build the knowledge ingestion service when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return build_postgres_knowledge_ingestion_service(database, now=now)


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


def build_postgres_knowledge_response_service(
    database: PostgresDatabase,
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeResponseService:
    """Build the PostgreSQL-backed knowledge response service."""

    return PlatformKnowledgeResponseService(
        retrieval_event_writer=PostgresRetrievalEventWriteRepository(database),
        audit_event_writer=PostgresAuditEventWriteRepository(database),
        now=now,
    )


def build_configured_postgres_knowledge_response_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeResponseService | None:
    """Build the knowledge response service when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return build_postgres_knowledge_response_service(database, now=now)
