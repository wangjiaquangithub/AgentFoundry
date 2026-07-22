"""Service composition helpers for production persistence-backed services."""

from __future__ import annotations

from typing import Callable

from backend.persistence import (
    PostgresAgentCatalogReadRepository,
    PostgresAgentCatalogWriteRepository,
    PostgresAgentRunReadRepository,
    PostgresAgentRunWriteRepository,
    PostgresApprovalReadRepository,
    PostgresApprovalWriteRepository,
    PostgresAuditEventReadRepository,
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
    PostgresMemoryItemReadRepository,
    PostgresMemoryItemWriteRepository,
    PostgresModelConfigReadRepository,
    PostgresModelConfigWriteRepository,
    PostgresRetrievalEventReadRepository,
    PostgresRetrievalEventWriteRepository,
    PostgresRuntimeReadRepository,
    PostgresRuntimeWriteRepository,
    PostgresTenancyReadRepository,
    PostgresTenancyWriteRepository,
    PostgresToolCallReadRepository,
    PostgresToolCallWriteRepository,
    PostgresToolGovernanceReadRepository,
    PostgresToolGovernanceWriteRepository,
    PostgresWorkflowReadRepository,
    PostgresWorkflowWriteRepository,
    create_configured_postgres_database,
    inspect_configured_database_status,
)
from backend.repositories.agents import (
    AgentRepositoryProtocol,
    PostgresAgentCatalogWriteThroughRepository,
)
from backend.repositories.agent_runs import (
    AgentRunRepositoryProtocol,
    PostgresAgentRunReadThroughRepository,
)
from backend.repositories.approvals import (
    ApprovalRequestRepositoryProtocol,
    PostgresApprovalReadThroughRepository,
)
from backend.repositories.members import (
    MemberRepositoryProtocol,
    PostgresMemberReadThroughRepository,
)
from backend.repositories.workflows import (
    PostgresWorkflowTemplateReadThroughRepository,
    PostgresWorkflowRunReadThroughRepository,
    WorkflowRunRepositoryProtocol,
    WorkflowTemplateRepositoryProtocol,
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


def build_model_config_service() -> PlatformModelConfigService | None:
    """Select the configured production model config service implementation."""

    return build_configured_postgres_model_config_service()


def build_database_config_status_inspector() -> Callable[..., dict[str, object]]:
    """Select the configured production database status inspector."""

    return inspect_configured_database_status


def build_configured_postgres_audit_event_read_repository() -> (
    PostgresAuditEventReadRepository | None
):
    """Build the audit event read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresAuditEventReadRepository(database)


def build_configured_postgres_audit_event_write_repository() -> (
    PostgresAuditEventWriteRepository | None
):
    """Build the audit event write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresAuditEventWriteRepository(database)


def build_audit_event_read_repository() -> PostgresAuditEventReadRepository | None:
    """Select the configured production audit event read repository."""

    return build_configured_postgres_audit_event_read_repository()


def build_audit_event_write_repository() -> PostgresAuditEventWriteRepository | None:
    """Select the configured production audit event write repository."""

    return build_configured_postgres_audit_event_write_repository()


def build_configured_postgres_retrieval_event_read_repository() -> (
    PostgresRetrievalEventReadRepository | None
):
    """Build the retrieval event read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRetrievalEventReadRepository(database)


def build_configured_postgres_retrieval_event_write_repository() -> (
    PostgresRetrievalEventWriteRepository | None
):
    """Build the retrieval event write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRetrievalEventWriteRepository(database)


def build_retrieval_event_read_repository() -> (
    PostgresRetrievalEventReadRepository | None
):
    """Select the configured production retrieval event read repository."""

    return build_configured_postgres_retrieval_event_read_repository()


def build_retrieval_event_write_repository() -> (
    PostgresRetrievalEventWriteRepository | None
):
    """Select the configured production retrieval event write repository."""

    return build_configured_postgres_retrieval_event_write_repository()


def build_configured_postgres_tool_call_read_repository() -> (
    PostgresToolCallReadRepository | None
):
    """Build the tool call read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolCallReadRepository(database)


def build_configured_postgres_tool_call_write_repository() -> (
    PostgresToolCallWriteRepository | None
):
    """Build the tool call write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolCallWriteRepository(database)


def build_tool_call_read_repository() -> PostgresToolCallReadRepository | None:
    """Select the configured production tool call read repository."""

    return build_configured_postgres_tool_call_read_repository()


def build_tool_call_write_repository() -> PostgresToolCallWriteRepository | None:
    """Select the configured production tool call write repository."""

    return build_configured_postgres_tool_call_write_repository()


def build_configured_postgres_tool_governance_read_repository() -> (
    PostgresToolGovernanceReadRepository | None
):
    """Build the tool governance read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolGovernanceReadRepository(database)


def build_configured_postgres_tool_governance_write_repository() -> (
    PostgresToolGovernanceWriteRepository | None
):
    """Build the tool governance write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolGovernanceWriteRepository(database)


def build_tool_governance_read_repository() -> (
    PostgresToolGovernanceReadRepository | None
):
    """Select the configured production tool governance read repository."""

    return build_configured_postgres_tool_governance_read_repository()


def build_tool_governance_write_repository() -> (
    PostgresToolGovernanceWriteRepository | None
):
    """Select the configured production tool governance write repository."""

    return build_configured_postgres_tool_governance_write_repository()


def build_configured_postgres_memory_item_read_repository() -> (
    PostgresMemoryItemReadRepository | None
):
    """Build the memory item read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresMemoryItemReadRepository(database)


def build_configured_postgres_memory_item_write_repository() -> (
    PostgresMemoryItemWriteRepository | None
):
    """Build the memory item write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresMemoryItemWriteRepository(database)


def build_memory_item_read_repository() -> PostgresMemoryItemReadRepository | None:
    """Select the configured production memory item read repository."""

    return build_configured_postgres_memory_item_read_repository()


def build_memory_item_write_repository() -> PostgresMemoryItemWriteRepository | None:
    """Select the configured production memory item write repository."""

    return build_configured_postgres_memory_item_write_repository()


def build_configured_postgres_runtime_read_repository() -> (
    PostgresRuntimeReadRepository | None
):
    """Build the runtime read repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRuntimeReadRepository(database)


def build_configured_postgres_runtime_write_repository() -> (
    PostgresRuntimeWriteRepository | None
):
    """Build the runtime write repository when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRuntimeWriteRepository(database)


def build_runtime_read_repository() -> PostgresRuntimeReadRepository | None:
    """Select the configured production runtime read repository."""

    return build_configured_postgres_runtime_read_repository()


def build_runtime_write_repository() -> PostgresRuntimeWriteRepository | None:
    """Select the configured production runtime write repository."""

    return build_configured_postgres_runtime_write_repository()


def build_configured_postgres_member_repository() -> (
    PostgresMemberReadThroughRepository | None
):
    """Build the member repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresMemberReadThroughRepository(
        postgres_reader=PostgresTenancyReadRepository(database),
        postgres_writer=PostgresTenancyWriteRepository(database),
    )


def build_member_repository(
    fallback_repository: MemberRepositoryProtocol,
) -> MemberRepositoryProtocol:
    """Select the configured production member repository."""

    return build_configured_postgres_member_repository() or fallback_repository


def build_configured_postgres_agent_repository() -> (
    PostgresAgentCatalogWriteThroughRepository | None
):
    """Build the agent catalog repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresAgentCatalogWriteThroughRepository(
        postgres_reader=PostgresAgentCatalogReadRepository(database),
        postgres_writer=PostgresAgentCatalogWriteRepository(database),
    )


def build_agent_repository(
    fallback_repository: AgentRepositoryProtocol,
) -> AgentRepositoryProtocol:
    """Select the configured production agent catalog repository."""

    return build_configured_postgres_agent_repository() or fallback_repository


def build_configured_postgres_agent_run_repository() -> (
    PostgresAgentRunReadThroughRepository | None
):
    """Build the agent run repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresAgentRunReadThroughRepository(
        postgres_reader=PostgresAgentRunReadRepository(database),
        postgres_writer=PostgresAgentRunWriteRepository(database),
    )


def build_agent_run_repository(
    fallback_repository: AgentRunRepositoryProtocol,
) -> AgentRunRepositoryProtocol:
    """Select the configured production agent run repository."""

    return build_configured_postgres_agent_run_repository() or fallback_repository


def build_configured_postgres_approval_request_repository() -> (
    PostgresApprovalReadThroughRepository | None
):
    """Build the approval request repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresApprovalReadThroughRepository(
        postgres_reader=PostgresApprovalReadRepository(database),
        postgres_writer=PostgresApprovalWriteRepository(database),
    )


def build_approval_request_repository(
    fallback_repository: ApprovalRequestRepositoryProtocol,
) -> ApprovalRequestRepositoryProtocol:
    """Select the configured production approval request repository."""

    return (
        build_configured_postgres_approval_request_repository()
        or fallback_repository
    )


def build_configured_postgres_workflow_template_repository() -> (
    PostgresWorkflowTemplateReadThroughRepository | None
):
    """Build the workflow template repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresWorkflowTemplateReadThroughRepository(
        postgres_reader=PostgresWorkflowReadRepository(database),
        postgres_writer=PostgresWorkflowWriteRepository(database),
    )


def build_workflow_template_repository(
    fallback_repository: WorkflowTemplateRepositoryProtocol,
) -> WorkflowTemplateRepositoryProtocol:
    """Select the configured production workflow template repository."""

    return (
        build_configured_postgres_workflow_template_repository()
        or fallback_repository
    )


def build_configured_postgres_workflow_run_repository() -> (
    PostgresWorkflowRunReadThroughRepository | None
):
    """Build the workflow run repository adapter when PostgreSQL is configured."""

    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresWorkflowRunReadThroughRepository(
        postgres_reader=PostgresWorkflowReadRepository(database),
        postgres_writer=PostgresWorkflowWriteRepository(database),
    )


def build_workflow_run_repository(
    fallback_repository: WorkflowRunRepositoryProtocol,
) -> WorkflowRunRepositoryProtocol:
    """Select the configured production workflow run repository."""

    return (
        build_configured_postgres_workflow_run_repository()
        or fallback_repository
    )


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


def build_knowledge_base_read_repository() -> (
    PostgresKnowledgeBaseReadRepository | None
):
    """Select the configured production knowledge base read repository."""

    return build_configured_postgres_knowledge_base_read_repository()


def build_knowledge_base_write_repository() -> (
    PostgresKnowledgeBaseWriteRepository | None
):
    """Select the configured production knowledge base write repository."""

    return build_configured_postgres_knowledge_base_write_repository()


def build_knowledge_document_read_repository() -> (
    PostgresDocumentReadRepository | None
):
    """Select the configured production knowledge document read repository."""

    return build_configured_postgres_knowledge_document_read_repository()


def build_knowledge_document_write_repository() -> (
    PostgresDocumentWriteRepository | None
):
    """Select the configured production knowledge document write repository."""

    return build_configured_postgres_knowledge_document_write_repository()


def build_knowledge_document_chunk_read_repository() -> (
    PostgresDocumentChunkReadRepository | None
):
    """Select the configured production document chunk read repository."""

    return build_configured_postgres_knowledge_document_chunk_read_repository()


def build_knowledge_document_chunk_write_repository() -> (
    PostgresDocumentChunkWriteRepository | None
):
    """Select the configured production document chunk write repository."""

    return build_configured_postgres_knowledge_document_chunk_write_repository()


def build_knowledge_embedding_record_read_repository() -> (
    PostgresEmbeddingRecordReadRepository | None
):
    """Select the configured production embedding record read repository."""

    return build_configured_postgres_knowledge_embedding_record_read_repository()


def build_knowledge_embedding_record_write_repository() -> (
    PostgresEmbeddingRecordWriteRepository | None
):
    """Select the configured production embedding record write repository."""

    return build_configured_postgres_knowledge_embedding_record_write_repository()


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


def build_knowledge_document_readiness_service() -> (
    PlatformKnowledgeDocumentReadinessService | None
):
    """Select the configured knowledge readiness service implementation."""

    return build_configured_postgres_knowledge_document_readiness_service()


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


def build_knowledge_ingestion_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeIngestionService | None:
    """Select the configured knowledge ingestion service implementation."""

    return build_configured_postgres_knowledge_ingestion_service(now=now)


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


def build_knowledge_retrieval_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeRetrievalService | None:
    """Select the configured knowledge retrieval service implementation."""

    return build_configured_postgres_knowledge_retrieval_service(now=now)


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


def build_knowledge_response_service(
    *,
    now: Callable[[], str] | None = None,
) -> PlatformKnowledgeResponseService:
    """Select the configured knowledge response service implementation."""

    return (
        build_configured_postgres_knowledge_response_service(now=now)
        or PlatformKnowledgeResponseService(now=now)
    )
