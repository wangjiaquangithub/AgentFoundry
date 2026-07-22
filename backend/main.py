# -*- coding: utf-8 -*-
"""Enterprise knowledge assistant service example.

This example turns AgentScope's app service into an enterprise-style
assistant backend with tenant-aware tools, long-term memory, RAG endpoints,
and custom sub-agent templates.
"""
import json
import os
import sys
from pathlib import Path
from typing import Any, NoReturn

import uvicorn
from fastapi import HTTPException, Request
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from api.agent_runtime import (
    AgentRuntimeRouteDependencies,
    create_agent_runtime_router,
)
from api.agents import AgentCatalogRouteDependencies, create_agent_catalog_router
from api.knowledge import (
    KnowledgeBasesRouteDependencies,
    KnowledgeDocumentsRouteDependencies,
    KnowledgeEmbeddingRecordsRouteDependencies,
    KnowledgeIngestionRouteDependencies,
    KnowledgeReadinessRouteDependencies,
    KnowledgeRetrievalRouteDependencies,
    KnowledgeRetrievalEventsRouteDependencies,
    create_knowledge_bases_router,
    create_knowledge_embedding_records_router,
    create_knowledge_documents_router,
    create_knowledge_ingestion_router,
    create_knowledge_readiness_router,
    create_knowledge_retrieval_router,
    create_knowledge_retrieval_events_router,
)
from api.model_configs import (
    ModelConfigRouteDependencies,
    create_model_config_router,
)
from api.platform_admin import (
    PlatformAdminRouteDependencies,
    create_platform_admin_router,
)
from api.tools import ToolAuditRouteDependencies, create_tool_audit_router
from api.workflows import (
    WorkflowGovernanceRouteDependencies,
    create_workflow_governance_router,
)
from agentscope.app import create_app
from agentscope.app.message_bus import InMemoryMessageBus, RedisMessageBus
from agentscope.app.rag.blob_store import LocalBlobStore
from agentscope.app.rag.knowledge_base_manager import CollectionPerKbManager
from agentscope.app.storage import RedisStorage
from agentscope.app.workspace_manager import LocalWorkspaceManager
from agentscope.middleware import AgenticMemoryMiddleware
from agentscope.rag import QdrantStore

from agent_templates import ENTERPRISE_AGENT_TEMPLATES, ENTERPRISE_SUBAGENT_TEMPLATES
from audit import ToolAuditLogger
from connectors import EnterpriseConnector, build_enterprise_connector
from enterprise_tools import (
    APPROVAL_REQUIRED_TOOLS,
    APPROVAL_REQUIRED_WORKFLOWS,
    ENTERPRISE_TOOL_CATALOG,
    ENTERPRISE_TOOL_INPUT_FIELDS,
    EnterpriseToolRuntimeError,
    EnterpriseToolRuntimeFactory,
)
from permissions import (
    DEFAULT_TOOL_POLICY,
    ENTERPRISE_TOOL_NAMES,
    ToolAuthorizationPolicy,
)
from platform_access import PlatformAccessHelpers, tenant_hint_from_user_id
from platform_config import (
    DATA_DIR,
    PLATFORM_AGENT_RUNS_PATH,
    PLATFORM_AGENTS_PATH,
    PLATFORM_APPROVAL_REQUESTS_PATH,
    PLATFORM_CONNECTOR_CONFIGS_PATH,
    PLATFORM_DEV_KNOWLEDGE_PATH,
    PLATFORM_DEV_KNOWLEDGE_PROVIDER,
    PLATFORM_MEMBERS_PATH,
    PLATFORM_MEMORY_DIR,
    PLATFORM_MEMORY_MAX_RECORDS,
    PLATFORM_MEMORY_SEARCH_LIMIT,
    PLATFORM_TOOL_POLICY_PATH,
    PLATFORM_VERSION,
    PLATFORM_WORKFLOW_RUNS_PATH,
    PLATFORM_WORKFLOW_TEMPLATES_PATH,
    ROUTING_SOURCE_MODEL,
    ROUTING_SOURCE_RULES,
    load_local_env,
    now_iso,
    safe_path_part,
)
from repositories.agents import (
    AgentRepository,
    AgentRepositoryProtocol,
    PostgresAgentCatalogWriteThroughRepository,
)
from backend.persistence import (
    PostgresAgentCatalogReadRepository,
    PostgresAgentCatalogWriteRepository,
    PostgresAgentRunReadRepository,
    PostgresAgentRunWriteRepository,
    PostgresApprovalReadRepository,
    PostgresApprovalWriteRepository,
    PostgresMemoryItemReadRepository,
    PostgresMemoryItemWriteRepository,
    PostgresModelConfigReadRepository,
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
from repositories.agent_runs import (
    AgentRunRepository,
    AgentRunRepositoryProtocol,
    PostgresAgentRunReadThroughRepository,
)
from repositories.approvals import (
    ApprovalRequestRepository,
    ApprovalRequestRepositoryProtocol,
    PostgresApprovalReadThroughRepository,
)
from repositories.connectors import ConnectorConfigRepository
from repositories.dev_knowledge import DevKnowledgeRepository
from repositories.memories import PlatformMemoryRepository
from repositories.members import (
    MemberRepository,
    MemberRepositoryProtocol,
    PostgresMemberReadThroughRepository,
)
from repositories.workflows import (
    PostgresWorkflowRunReadThroughRepository,
    WorkflowRunRepositoryProtocol,
    WorkflowRunRepository,
    WorkflowTemplateRepository,
)
from runtime import (
    build_adapter_backed_local_invocation_result_payload,
    build_runtime_invocation_request_payload,
    describe_runtime_adapter,
    describe_runtime_provider_health,
    invoke_runtime_adapter_from_payload,
)
from services.approvals import (
    PlatformApprovalService,
    PlatformApprovalServiceError,
)
from services.agent_runs import (
    PlatformAgentRunService,
    PlatformAgentRunServiceError,
)
from services.agents import PlatformAgentService, PlatformAgentServiceError
from services.connectors import (
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)
from services.dev_knowledge import PlatformDevKnowledgeService
from services.enterprise_router import PlatformEnterpriseRouterService
from services.knowledge import (
    PlatformKnowledgeDocumentReadinessService,
    PlatformKnowledgeResponseService,
    PlatformKnowledgeRetrievalService,
)
from services.knowledge_ingestion import PlatformKnowledgeIngestionService
from services.members import PlatformMemberService, PlatformMemberServiceError
from services.memories import PlatformMemoryService
from services.composition import (
    build_configured_postgres_audit_event_read_repository,
    build_configured_postgres_audit_event_write_repository,
    build_configured_postgres_knowledge_base_read_repository,
    build_configured_postgres_knowledge_base_write_repository,
    build_configured_postgres_knowledge_document_chunk_read_repository,
    build_configured_postgres_knowledge_document_chunk_write_repository,
    build_configured_postgres_knowledge_document_read_repository,
    build_configured_postgres_knowledge_document_readiness_service,
    build_configured_postgres_knowledge_document_write_repository,
    build_configured_postgres_knowledge_embedding_record_read_repository,
    build_configured_postgres_knowledge_embedding_record_write_repository,
    build_configured_postgres_knowledge_ingestion_service,
    build_configured_postgres_knowledge_response_service,
    build_configured_postgres_knowledge_retrieval_service,
    build_configured_postgres_model_config_service,
)
from services.platform_status import PlatformStatusService
from services.tools import (
    PlatformToolPolicyService,
    PlatformToolPolicyServiceError,
)
from services.workflows import (
    PlatformWorkflowRunService,
    PlatformWorkflowTemplateService,
)

load_local_env()

agent_fallback_repository = AgentRepository(PLATFORM_AGENTS_PATH)
agent_run_fallback_repository = AgentRunRepository(PLATFORM_AGENT_RUNS_PATH)
approval_request_fallback_repository = ApprovalRequestRepository(
    PLATFORM_APPROVAL_REQUESTS_PATH,
)
member_fallback_repository = MemberRepository(PLATFORM_MEMBERS_PATH)


def _build_agent_repository() -> AgentRepositoryProtocol:
    database = create_configured_postgres_database()
    if database is None:
        return agent_fallback_repository

    return PostgresAgentCatalogWriteThroughRepository(
        postgres_reader=PostgresAgentCatalogReadRepository(database),
        postgres_writer=PostgresAgentCatalogWriteRepository(database),
    )


def _build_agent_run_repository() -> AgentRunRepositoryProtocol:
    database = create_configured_postgres_database()
    if database is None:
        return agent_run_fallback_repository

    return PostgresAgentRunReadThroughRepository(
        postgres_reader=PostgresAgentRunReadRepository(database),
        postgres_writer=PostgresAgentRunWriteRepository(database),
    )


agent_repository = _build_agent_repository()
agent_run_repository = _build_agent_run_repository()


def _build_approval_request_repository() -> ApprovalRequestRepositoryProtocol:
    database = create_configured_postgres_database()
    if database is None:
        return approval_request_fallback_repository

    return PostgresApprovalReadThroughRepository(
        postgres_reader=PostgresApprovalReadRepository(database),
        postgres_writer=PostgresApprovalWriteRepository(database),
    )


approval_request_repository = _build_approval_request_repository()


def _build_tool_call_write_repository() -> PostgresToolCallWriteRepository | None:
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolCallWriteRepository(database)


def _build_tool_call_read_repository() -> PostgresToolCallReadRepository | None:
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolCallReadRepository(database)


def _build_tool_governance_read_repository() -> (
    PostgresToolGovernanceReadRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolGovernanceReadRepository(database)


def _build_tool_governance_write_repository() -> (
    PostgresToolGovernanceWriteRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresToolGovernanceWriteRepository(database)


def _build_memory_item_read_repository() -> (
    PostgresMemoryItemReadRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresMemoryItemReadRepository(database)


def _build_memory_item_write_repository() -> (
    PostgresMemoryItemWriteRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresMemoryItemWriteRepository(database)


def _build_runtime_read_repository() -> PostgresRuntimeReadRepository | None:
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRuntimeReadRepository(database)


def _build_runtime_write_repository() -> PostgresRuntimeWriteRepository | None:
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRuntimeWriteRepository(database)


def _build_audit_event_read_repository() -> Any | None:
    return build_configured_postgres_audit_event_read_repository()


def _build_audit_event_write_repository() -> Any | None:
    return build_configured_postgres_audit_event_write_repository()


def _build_retrieval_event_write_repository() -> (
    PostgresRetrievalEventWriteRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRetrievalEventWriteRepository(database)


def _build_retrieval_event_read_repository() -> (
    PostgresRetrievalEventReadRepository | None
):
    database = create_configured_postgres_database()
    if database is None:
        return None

    return PostgresRetrievalEventReadRepository(database)


def _build_member_repository() -> MemberRepositoryProtocol:
    database = create_configured_postgres_database()
    if database is None:
        return member_fallback_repository

    return PostgresMemberReadThroughRepository(
        postgres_reader=PostgresTenancyReadRepository(database),
        postgres_writer=PostgresTenancyWriteRepository(database),
    )


connector_config_repository = ConnectorConfigRepository(
    PLATFORM_CONNECTOR_CONFIGS_PATH,
)
workflow_template_repository = WorkflowTemplateRepository(
    PLATFORM_WORKFLOW_TEMPLATES_PATH,
)
workflow_run_fallback_repository = WorkflowRunRepository(PLATFORM_WORKFLOW_RUNS_PATH)
member_repository = _build_member_repository()


def _build_workflow_run_repository() -> WorkflowRunRepositoryProtocol:
    database = create_configured_postgres_database()
    if database is None:
        return workflow_run_fallback_repository

    return PostgresWorkflowRunReadThroughRepository(
        postgres_reader=PostgresWorkflowReadRepository(database),
        postgres_writer=PostgresWorkflowWriteRepository(database),
    )


workflow_run_repository = _build_workflow_run_repository()
dev_knowledge_repository = DevKnowledgeRepository(PLATFORM_DEV_KNOWLEDGE_PATH)
dev_knowledge_service = PlatformDevKnowledgeService(
    repository=dev_knowledge_repository,
)
knowledge_response_service = (
    build_configured_postgres_knowledge_response_service(now=now_iso)
    or PlatformKnowledgeResponseService(now=now_iso)
)


def _build_knowledge_document_readiness_service() -> (
    PlatformKnowledgeDocumentReadinessService | None
):
    return build_configured_postgres_knowledge_document_readiness_service()


def _build_knowledge_base_read_repository() -> Any | None:
    return build_configured_postgres_knowledge_base_read_repository()


def _build_knowledge_base_write_repository() -> Any | None:
    return build_configured_postgres_knowledge_base_write_repository()


def _build_knowledge_document_read_repository() -> Any | None:
    return build_configured_postgres_knowledge_document_read_repository()


def _build_knowledge_document_write_repository() -> Any | None:
    return build_configured_postgres_knowledge_document_write_repository()


def _build_knowledge_document_chunk_read_repository() -> Any | None:
    return build_configured_postgres_knowledge_document_chunk_read_repository()


def _build_knowledge_document_chunk_write_repository() -> Any | None:
    return build_configured_postgres_knowledge_document_chunk_write_repository()


def _build_knowledge_embedding_record_read_repository() -> Any | None:
    return build_configured_postgres_knowledge_embedding_record_read_repository()


def _build_knowledge_embedding_record_write_repository() -> Any | None:
    return build_configured_postgres_knowledge_embedding_record_write_repository()


def _build_knowledge_retrieval_service() -> (
    PlatformKnowledgeRetrievalService | None
):
    return build_configured_postgres_knowledge_retrieval_service(
        now=now_iso,
    )


def _build_knowledge_ingestion_service() -> (
    PlatformKnowledgeIngestionService | None
):
    return build_configured_postgres_knowledge_ingestion_service(
        now=now_iso,
    )


enterprise_router_service = PlatformEnterpriseRouterService(
    tool_names=ENTERPRISE_TOOL_NAMES,
    tool_input_fields=ENTERPRISE_TOOL_INPUT_FIELDS,
    default_source=ROUTING_SOURCE_RULES,
    model_source=ROUTING_SOURCE_MODEL,
)
platform_memory_repository = PlatformMemoryRepository(
    PLATFORM_MEMORY_DIR,
    memory_item_reader=_build_memory_item_read_repository(),
    memory_item_writer=_build_memory_item_write_repository(),
)
platform_memory_service = PlatformMemoryService(
    repository=platform_memory_repository,
    audit_event_writer=_build_audit_event_write_repository(),
)
DATA_DIR.mkdir(parents=True, exist_ok=True)
enterprise_connector = build_enterprise_connector()
tool_audit_logger = ToolAuditLogger.from_env(
    DATA_DIR / "audit" / "tool_calls.jsonl",
    tool_call_writer=_build_tool_call_write_repository(),
    tool_call_reader=_build_tool_call_read_repository(),
)


def _platform_tool_policy_path() -> Path:
    env_policy_path = os.getenv("ENTERPRISE_TOOL_POLICY_PATH")
    if env_policy_path:
        return Path(env_policy_path).expanduser()
    return PLATFORM_TOOL_POLICY_PATH


def _build_tool_authorization_policy() -> ToolAuthorizationPolicy:
    try:
        return _platform_tool_policy_service().build_authorization_policy()
    except PlatformToolPolicyServiceError as exc:
        _raise_platform_tool_policy_service_error(exc)


def _platform_tool_policy_service() -> PlatformToolPolicyService:
    def runtime_context(user_id: str) -> dict[str, Any]:
        try:
            return _platform_connector_config_service().enterprise_runtime_context(
                user_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)

    return PlatformToolPolicyService(
        policy_path=_platform_tool_policy_path,
        default_policy=json.loads(json.dumps(DEFAULT_TOOL_POLICY)),
        policy_mode=lambda: os.getenv(
            "ENTERPRISE_TOOL_POLICY_MODE",
            "permissive",
        ).strip().lower(),
        enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
        runtime_context=runtime_context,
        identity_metadata=lambda user_id, tenant: (
            _platform_access_helpers.identity_metadata(user_id, tenant)
        ),
        tool_governance_reader=_build_tool_governance_read_repository(),
        tool_governance_writer=_build_tool_governance_write_repository(),
        audit_event_writer=_build_audit_event_write_repository(),
        enterprise_tool_catalog=ENTERPRISE_TOOL_CATALOG,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        now=now_iso,
    )


def _raise_platform_tool_policy_service_error(
    exc: PlatformToolPolicyServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


tool_authorization_policy = _build_tool_authorization_policy()


def _get_tool_authorization_policy() -> ToolAuthorizationPolicy:
    return tool_authorization_policy


def _set_tool_authorization_policy(policy: ToolAuthorizationPolicy) -> None:
    global tool_authorization_policy
    tool_authorization_policy = policy


def _enterprise_runtime_context(user_id: str) -> dict[str, Any]:
    try:
        return _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


enterprise_tool_runtime = EnterpriseToolRuntimeFactory(
    runtime_context=_enterprise_runtime_context,
    tool_policy_service=_platform_tool_policy_service,
    audit_logger=tool_audit_logger,
    authorization_policy=_get_tool_authorization_policy,
    tool_names=ENTERPRISE_TOOL_NAMES,
)

def _platform_status_service() -> PlatformStatusService:
    """Build the service object that composes platform console status payloads."""
    agent_service = _platform_agent_service()
    workflow_template_service = _platform_workflow_template_service()
    approval_service = _platform_approval_service()

    def list_approval_records(**kwargs: Any) -> list[dict[str, Any]]:
        try:
            return approval_service.list_records(**kwargs)
        except PlatformApprovalServiceError as exc:
            _raise_platform_approval_service_error(exc)

    def connector_health() -> dict[str, Any]:
        connector_name = enterprise_connector.name
        try:
            return _platform_connector_config_service().health_response(
                connector_name=connector_name,
                env=os.environ,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)

    return PlatformStatusService(
        list_approval_records=list_approval_records,
        load_workflow_runs=_platform_workflow_run_service().list_run_records,
        load_workflow_templates=workflow_template_service.list_templates,
        load_agents=agent_service.list_agents,
        load_memories=lambda **kwargs: platform_memory_service.list_memories(
            limit=PLATFORM_MEMORY_MAX_RECORDS,
            **kwargs,
        ),
        runtime_context=lambda user_id: (
            _platform_connector_config_service().enterprise_runtime_context(user_id)
        ),
        identity_metadata=_platform_access_helpers.identity_metadata,
        tenant_workspaces=lambda **kwargs: (
            _platform_connector_config_service().tenant_workspaces(
                runtime_connector_for_tenant=(
                    _platform_connector_config_service()
                    .runtime_enterprise_connector_for_tenant
                ),
                **kwargs,
            )
        ),
        agent_run_repository=agent_run_repository,
        audit_logger=tool_audit_logger,
        audit_event_reader=_build_audit_event_read_repository(),
        retrieval_event_reader=_build_retrieval_event_read_repository(),
        tool_policy=tool_authorization_policy,
        connector_health=connector_health,
        runtime_provider_health=describe_runtime_provider_health,
        runtime_provider_reader=_build_runtime_read_repository(),
        agent_readiness=agent_service.readiness,
        enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
        enterprise_tool_catalog=ENTERPRISE_TOOL_CATALOG,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        approval_required_workflows=APPROVAL_REQUIRED_WORKFLOWS,
        database_config_status=inspect_configured_database_status,
    )


async def build_enterprise_middlewares(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[AgenticMemoryMiddleware]:
    """Attach session-isolated long-term memory to every agent run."""
    memory_workdir = (
        DATA_DIR
        / "memory"
        / safe_path_part(user_id)
        / safe_path_part(agent_id)
        / safe_path_part(session_id)
    )
    return [
        AgenticMemoryMiddleware(
            workdir=str(memory_workdir),
            memory_dir="Memory",
        ),
    ]


def _build_storage() -> RedisStorage:
    """Build the app storage backend."""
    return RedisStorage(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        password=os.getenv("REDIS_PASSWORD"),
    )


def _build_message_bus() -> InMemoryMessageBus | RedisMessageBus:
    """Use in-memory bus by default and Redis bus when requested."""
    if os.getenv("AGENTSCOPE_REDIS_BUS") != "1":
        return InMemoryMessageBus()

    return RedisMessageBus(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        password=os.getenv("REDIS_PASSWORD"),
    )


def _build_vector_store() -> QdrantStore:
    """Build a local or remote Qdrant vector store."""
    qdrant_url = os.getenv("QDRANT_URL")
    if qdrant_url:
        return QdrantStore(
            url=qdrant_url,
            api_key=os.getenv("QDRANT_API_KEY"),
        )
    return QdrantStore(path=str(DATA_DIR / "qdrant"))


storage = _build_storage()

def _platform_agent_service() -> PlatformAgentService:
    def tenant_for_user(user_id: str) -> str:
        try:
            return _platform_connector_config_service().runtime_tenant_for_user(user_id)
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)

    return PlatformAgentService(
        repository=agent_repository,
        templates=ENTERPRISE_AGENT_TEMPLATES,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        tenant_for_user=tenant_for_user,
        tenant_hint_from_user_id=tenant_hint_from_user_id,
        identity_metadata=_platform_access_helpers.identity_metadata,
        member_for_user=lambda user_id: _platform_member_service().get_member_by_user(
            user_id,
            include_inactive=True,
        ),
        role_for_user=_platform_access_helpers.role_for_user,
        audit_event_writer=_build_audit_event_write_repository(),
        knowledge_document_readiness_service=(
            _build_knowledge_document_readiness_service()
        ),
    )


def _raise_platform_agent_service_error(exc: PlatformAgentServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _platform_agent_run_service() -> PlatformAgentRunService:
    return PlatformAgentRunService(
        repository=agent_run_repository,
        tool_call_writer=_build_tool_call_write_repository(),
        runtime_invocation_writer=_build_runtime_write_repository(),
    )


def _raise_platform_agent_run_service_error(
    exc: PlatformAgentRunServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _platform_member_service() -> PlatformMemberService:
    return PlatformMemberService(
        repository=member_repository,
        tenant_hint_from_user_id=tenant_hint_from_user_id,
        audit_event_writer=_build_audit_event_write_repository(),
        now=now_iso,
    )


def _raise_platform_member_service_error(exc: PlatformMemberServiceError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _platform_connector_config_service() -> PlatformConnectorConfigService:
    return PlatformConnectorConfigService(
        repository=connector_config_repository,
        global_connector=enterprise_connector,
        audit_event_writer=_build_audit_event_write_repository(),
        now=now_iso,
    )


def _raise_platform_connector_config_service_error(
    exc: PlatformConnectorConfigServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


_platform_access_helpers = PlatformAccessHelpers(
    agent_service=_platform_agent_service,
    connector_config_service=_platform_connector_config_service,
    member_service=_platform_member_service,
    enterprise_connector=enterprise_connector,
    authorization_policy=_get_tool_authorization_policy,
    tool_names=ENTERPRISE_TOOL_NAMES,
    raise_agent_error=_raise_platform_agent_service_error,
    raise_connector_config_error=_raise_platform_connector_config_service_error,
    raise_member_error=_raise_platform_member_service_error,
)


def _run_authorized_enterprise_tool(
    *,
    user_id: str,
    tool_name: str,
    inputs: dict[str, Any],
    agent_id: str,
    session_id: str,
    fail_on_denied: bool = True,
) -> dict[str, Any]:
    try:
        return enterprise_tool_runtime.run_authorized_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=inputs,
            agent_id=agent_id,
            session_id=session_id,
            fail_on_denied=fail_on_denied,
        )
    except EnterpriseToolRuntimeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


app = create_app(
    storage=storage,
    message_bus=_build_message_bus(),
    workspace_manager=LocalWorkspaceManager(
        basedir=str(DATA_DIR / "workspaces"),
    ),
    knowledge_base_manager=CollectionPerKbManager(
        storage=storage,
        vector_store=_build_vector_store(),
    ),
    blob_store=LocalBlobStore(root_dir=DATA_DIR / "blobs"),
    enable_index_worker=os.getenv("AGENTSCOPE_ENABLE_INDEX_WORKER", "1") != "0",
    extra_agent_tools=enterprise_tool_runtime.build_tools,
    extra_agent_middlewares=build_enterprise_middlewares,
    custom_subagent_templates=ENTERPRISE_SUBAGENT_TEMPLATES,
    extra_middlewares=[
        Middleware(
            CORSMiddleware,
            allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
    title="AgentScope Enterprise Knowledge Assistant",
)


def _platform_workflow_template_service() -> PlatformWorkflowTemplateService:
    return PlatformWorkflowTemplateService(
        repository=workflow_template_repository,
        audit_event_writer=_build_audit_event_write_repository(),
        now=now_iso,
    )


def _platform_workflow_run_service() -> PlatformWorkflowRunService:
    return PlatformWorkflowRunService(repository=workflow_run_repository)


def _platform_approval_service() -> PlatformApprovalService:
    return PlatformApprovalService(
        repository=approval_request_repository,
        audit_event_writer=_build_audit_event_write_repository(),
        now=now_iso,
    )


def _raise_platform_approval_service_error(
    exc: PlatformApprovalServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _require_platform_approval(
    *,
    approval_id: str | None,
    request_type: str,
    target_key: str,
    target_value: str,
    tenant: str,
    user_id: str,
    agent_id: str,
    inputs: dict[str, Any],
) -> str:
    try:
        return _platform_approval_service().require_approval(
            approval_id=approval_id,
            request_type=request_type,
            target_key=target_key,
            target_value=target_value,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            inputs=inputs,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)


app.include_router(
    create_platform_admin_router(
        PlatformAdminRouteDependencies(
            platform_version=PLATFORM_VERSION,
            data_dir=DATA_DIR,
            members_path=PLATFORM_MEMBERS_PATH,
            connector_configs_path=PLATFORM_CONNECTOR_CONFIGS_PATH,
            agents_path=PLATFORM_AGENTS_PATH,
            workflow_templates_path=PLATFORM_WORKFLOW_TEMPLATES_PATH,
            connector_name=enterprise_connector.name,
            env=os.environ,
            subagent_templates=ENTERPRISE_SUBAGENT_TEMPLATES,
            status_service=_platform_status_service,
            connector_config_service=_platform_connector_config_service,
            member_service=_platform_member_service,
            tool_policy_service=_platform_tool_policy_service,
            agent_service=_platform_agent_service,
            workflow_template_service=_platform_workflow_template_service,
            identity_metadata=_platform_access_helpers.identity_metadata,
            tool_policy_path=_platform_tool_policy_path,
            now=now_iso,
            get_tool_authorization_policy=_get_tool_authorization_policy,
            set_tool_authorization_policy=_set_tool_authorization_policy,
            build_tool_authorization_policy=_build_tool_authorization_policy,
        )
    )
)

app.include_router(
    create_agent_catalog_router(
        AgentCatalogRouteDependencies(
            agent_service=_platform_agent_service,
            validate_agent_resources=_platform_access_helpers.validate_agent_resources,
        )
    )
)

app.include_router(
    create_knowledge_ingestion_router(
        KnowledgeIngestionRouteDependencies(
            ingestion_service=_build_knowledge_ingestion_service,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
        )
    )
)

app.include_router(
    create_knowledge_readiness_router(
        KnowledgeReadinessRouteDependencies(
            readiness_service=_build_knowledge_document_readiness_service,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
        )
    )
)

app.include_router(
    create_knowledge_bases_router(
        KnowledgeBasesRouteDependencies(
            knowledge_base_read_repository=_build_knowledge_base_read_repository,
            knowledge_base_write_repository=_build_knowledge_base_write_repository,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
            now=now_iso,
        )
    )
)

app.include_router(
    create_knowledge_documents_router(
        KnowledgeDocumentsRouteDependencies(
            document_repository=_build_knowledge_document_read_repository,
            document_write_repository=_build_knowledge_document_write_repository,
            document_chunk_repository=_build_knowledge_document_chunk_read_repository,
            document_chunk_write_repository=(
                _build_knowledge_document_chunk_write_repository
            ),
            tenant_hint_from_user_id=tenant_hint_from_user_id,
            now=now_iso,
        )
    )
)

app.include_router(
    create_knowledge_embedding_records_router(
        KnowledgeEmbeddingRecordsRouteDependencies(
            embedding_record_read_repository=(
                _build_knowledge_embedding_record_read_repository
            ),
            embedding_record_write_repository=(
                _build_knowledge_embedding_record_write_repository
            ),
            tenant_hint_from_user_id=tenant_hint_from_user_id,
            now=now_iso,
        )
    )
)

app.include_router(
    create_knowledge_retrieval_router(
        KnowledgeRetrievalRouteDependencies(
            retrieval_service=_build_knowledge_retrieval_service,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
        )
    )
)

app.include_router(
    create_knowledge_retrieval_events_router(
        KnowledgeRetrievalEventsRouteDependencies(
            retrieval_event_repository=_build_retrieval_event_read_repository,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
        )
    )
)

app.include_router(
    create_model_config_router(
        ModelConfigRouteDependencies(
            model_config_service=build_configured_postgres_model_config_service,
            tenant_hint_from_user_id=tenant_hint_from_user_id,
        )
    )
)

app.include_router(
    create_tool_audit_router(
        ToolAuditRouteDependencies(
            tool_names=ENTERPRISE_TOOL_NAMES,
            tool_catalog=ENTERPRISE_TOOL_CATALOG,
            approval_required_tools=APPROVAL_REQUIRED_TOOLS,
            audit_logger=tool_audit_logger,
            tool_policy_service=_platform_tool_policy_service,
            connector_config_service=_platform_connector_config_service,
            agent_service=_platform_agent_service,
            get_tool_authorization_policy=_get_tool_authorization_policy,
            published_agent_tool_scope_for_user=(
                _platform_access_helpers.published_agent_tool_scope_for_user
            ),
            require_platform_approval=_require_platform_approval,
            run_authorized_enterprise_tool=_run_authorized_enterprise_tool,
        )
    )
)

app.include_router(
    create_agent_runtime_router(
        AgentRuntimeRouteDependencies(
            tool_names=ENTERPRISE_TOOL_NAMES,
            approval_required_tools=APPROVAL_REQUIRED_TOOLS,
            memory_max_records=PLATFORM_MEMORY_MAX_RECORDS,
            memory_search_limit=PLATFORM_MEMORY_SEARCH_LIMIT,
            routing_source_rules=ROUTING_SOURCE_RULES,
            dev_knowledge_provider=PLATFORM_DEV_KNOWLEDGE_PROVIDER,
            env=os.environ,
            agent_run_service=_platform_agent_run_service,
            connector_config_service=_platform_connector_config_service,
            agent_service=_platform_agent_service,
            approval_service=_platform_approval_service,
            tool_policy_service=_platform_tool_policy_service,
            memory_service=platform_memory_service,
            knowledge_response_service=knowledge_response_service,
            knowledge_document_readiness_service=(
                _build_knowledge_document_readiness_service()
            ),
            dev_knowledge_service=dev_knowledge_service,
            enterprise_router_service=enterprise_router_service,
            published_agent_tool_scope_for_user=(
                _platform_access_helpers.published_agent_tool_scope_for_user
            ),
            require_platform_approval=_require_platform_approval,
            run_authorized_enterprise_tool=_run_authorized_enterprise_tool,
            safe_path_part=safe_path_part,
            describe_runtime_adapter=describe_runtime_adapter,
            build_runtime_invocation_request_payload=(
                build_runtime_invocation_request_payload
            ),
            invoke_runtime_adapter_from_payload=invoke_runtime_adapter_from_payload,
            build_runtime_invocation_result_payload=(
                build_adapter_backed_local_invocation_result_payload
            ),
        )
    )
)

app.include_router(
    create_workflow_governance_router(
        WorkflowGovernanceRouteDependencies(
            tool_names=ENTERPRISE_TOOL_NAMES,
            tool_catalog=ENTERPRISE_TOOL_CATALOG,
            approval_required_tools=APPROVAL_REQUIRED_TOOLS,
            approval_required_workflows=APPROVAL_REQUIRED_WORKFLOWS,
            workflow_template_service=_platform_workflow_template_service,
            workflow_run_service=_platform_workflow_run_service,
            approval_service=_platform_approval_service,
            connector_config_service=_platform_connector_config_service,
            status_service=_platform_status_service,
            agent_service=_platform_agent_service,
            tool_policy_service=_platform_tool_policy_service,
            identity_metadata=_platform_access_helpers.identity_metadata,
            published_agent_tool_scope_for_user=(
                _platform_access_helpers.published_agent_tool_scope_for_user
            ),
            require_platform_approval=_require_platform_approval,
            run_authorized_enterprise_tool=_run_authorized_enterprise_tool,
            now=now_iso,
        )
    )
)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "1") != "0",
    )
