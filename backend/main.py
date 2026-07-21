# -*- coding: utf-8 -*-
"""Enterprise knowledge assistant service example.

This example turns AgentScope's app service into an enterprise-style
assistant backend with tenant-aware tools, long-term memory, RAG endpoints,
and custom sub-agent templates.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, NoReturn

import uvicorn
from fastapi import HTTPException, Request
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from api.agent_runtime import (
    AgentRuntimeRouteDependencies,
    create_agent_runtime_router,
)
from api.agents import AgentCatalogRouteDependencies, create_agent_catalog_router
from api.platform_admin import (
    PlatformAdminRouteDependencies,
    create_platform_admin_router,
)
from api.tools import ToolAuditRouteDependencies, create_tool_audit_router
from api.workflows import (
    WorkflowGovernanceRouteDependencies,
    create_workflow_governance_router,
)
from agentscope.app import SubAgentTemplate, create_app
from agentscope.app.message_bus import InMemoryMessageBus, RedisMessageBus
from agentscope.app.rag.blob_store import LocalBlobStore
from agentscope.app.rag.knowledge_base_manager import CollectionPerKbManager
from agentscope.app.storage import RedisStorage
from agentscope.app.workspace_manager import LocalWorkspaceManager
from agentscope.middleware import AgenticMemoryMiddleware
from agentscope.permission import (
    PermissionContext,
    PermissionMode,
)
from agentscope.rag import QdrantStore

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
from repositories.agents import AgentRepository
from repositories.agent_runs import AgentRunRepository
from repositories.approvals import ApprovalRequestRepository
from repositories.connectors import ConnectorConfigRepository
from repositories.dev_knowledge import DevKnowledgeRepository
from repositories.memories import PlatformMemoryRepository
from repositories.members import MemberRepository
from repositories.workflows import (
    WorkflowRunRepository,
    WorkflowTemplateRepository,
)
from runtime import (
    build_runtime_invocation_request_payload,
    build_runtime_invocation_result_payload,
    describe_runtime_adapter,
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
from services.knowledge import PlatformKnowledgeResponseService
from services.members import PlatformMemberService, PlatformMemberServiceError
from services.memories import PlatformMemoryService
from services.platform_status import PlatformStatusService
from services.tools import (
    PlatformToolPolicyService,
    PlatformToolPolicyServiceError,
)
from services.workflows import (
    PlatformWorkflowRunService,
    PlatformWorkflowTemplateService,
)


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PLATFORM_AGENTS_PATH = DATA_DIR / "platform_agents.json"
PLATFORM_CONNECTOR_CONFIGS_PATH = DATA_DIR / "platform_connector_configs.json"
PLATFORM_WORKFLOW_TEMPLATES_PATH = DATA_DIR / "platform_workflow_templates.json"
PLATFORM_WORKFLOW_RUNS_PATH = DATA_DIR / "platform_workflow_runs.jsonl"
PLATFORM_AGENT_RUNS_PATH = DATA_DIR / "platform_agent_runs.jsonl"
PLATFORM_APPROVAL_REQUESTS_PATH = DATA_DIR / "platform_approval_requests.jsonl"
PLATFORM_TOOL_POLICY_PATH = DATA_DIR / "platform_tool_policy.json"
PLATFORM_MEMBERS_PATH = DATA_DIR / "platform_members.json"
PLATFORM_DEV_KNOWLEDGE_PATH = DATA_DIR / "platform_dev_knowledge.json"
PLATFORM_MEMORY_DIR = DATA_DIR / "platform_memory"
PLATFORM_VERSION = "0.1.0"
PLATFORM_DEV_KNOWLEDGE_PROVIDER = "agentfoundry-dev-local"
ROUTING_SOURCE_MODEL = "model"
ROUTING_SOURCE_RULES = "rules"
PLATFORM_MEMORY_MAX_RECORDS = 200
PLATFORM_MEMORY_SEARCH_LIMIT = 4
agent_repository = AgentRepository(PLATFORM_AGENTS_PATH)
agent_run_repository = AgentRunRepository(PLATFORM_AGENT_RUNS_PATH)
connector_config_repository = ConnectorConfigRepository(
    PLATFORM_CONNECTOR_CONFIGS_PATH,
)
workflow_template_repository = WorkflowTemplateRepository(
    PLATFORM_WORKFLOW_TEMPLATES_PATH,
)
workflow_run_repository = WorkflowRunRepository(PLATFORM_WORKFLOW_RUNS_PATH)
approval_request_repository = ApprovalRequestRepository(
    PLATFORM_APPROVAL_REQUESTS_PATH,
)
member_repository = MemberRepository(PLATFORM_MEMBERS_PATH)
dev_knowledge_repository = DevKnowledgeRepository(PLATFORM_DEV_KNOWLEDGE_PATH)
dev_knowledge_service = PlatformDevKnowledgeService(
    repository=dev_knowledge_repository,
)
knowledge_response_service = PlatformKnowledgeResponseService()
enterprise_router_service = PlatformEnterpriseRouterService(
    tool_names=ENTERPRISE_TOOL_NAMES,
    tool_input_fields=ENTERPRISE_TOOL_INPUT_FIELDS,
    default_source=ROUTING_SOURCE_RULES,
    model_source=ROUTING_SOURCE_MODEL,
)
platform_memory_repository = PlatformMemoryRepository(PLATFORM_MEMORY_DIR)
platform_memory_service = PlatformMemoryService(repository=platform_memory_repository)


def _load_local_env() -> None:
    """Load example-local .env values before building service components."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    try:
        from dotenv import load_dotenv
    except ModuleNotFoundError:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        return

    load_dotenv(env_path, override=False)


_load_local_env()
DATA_DIR.mkdir(parents=True, exist_ok=True)
enterprise_connector = build_enterprise_connector()
tool_audit_logger = ToolAuditLogger.from_env(
    DATA_DIR / "audit" / "tool_calls.jsonl",
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
        identity_metadata=lambda user_id, tenant: _platform_identity_metadata(
            user_id,
            tenant,
        ),
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


def _safe_path_part(value: str) -> str:
    """Turn an external id into a filesystem-safe path segment."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "unknown"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


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
        identity_metadata=_platform_identity_metadata,
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
        tool_policy=tool_authorization_policy,
        connector_health=connector_health,
        agent_readiness=agent_service.readiness,
        enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
        enterprise_tool_catalog=ENTERPRISE_TOOL_CATALOG,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        approval_required_workflows=APPROVAL_REQUIRED_WORKFLOWS,
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
        / _safe_path_part(user_id)
        / _safe_path_part(agent_id)
        / _safe_path_part(session_id)
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

ENTERPRISE_SUBAGENT_TEMPLATES = [
    SubAgentTemplate(
        type="policy_researcher",
        description=(
            "A read-only enterprise researcher for policy, knowledge-base, "
            "and ticket investigation."
        ),
        system_prompt_template="""You are {member_name}, an enterprise \
policy researcher in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Work only from the tenant-scoped tools, attached knowledge bases, and readable \
workspace files. Cite which source or tool result supports each conclusion. \
Do not modify files or external systems. Report your findings back to \
{leader_name} with TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.EXPLORE,
        ),
        override_leader_mode=True,
    ),
    SubAgentTemplate(
        type="workflow_operator",
        description=(
            "A controlled worker for drafting workflow steps, runbooks, "
            "and automation plans inside the approved workspace."
        ),
        system_prompt_template="""You are {member_name}, a workflow \
operator in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Turn the leader's business goal into concrete operating steps, checklists, or \
draft artifacts. Keep tenant boundaries strict. Use tools only when their \
scope is clear, and report every material action back to {leader_name} with \
TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.ACCEPT_EDITS,
        ),
    ),
]

ENTERPRISE_AGENT_TEMPLATES = [
    {
        "id": "enterprise_knowledge_assistant",
        "name": "企业知识助手",
        "description": "面向员工问答、制度查询、工单状态和部门指标的业务助手。",
        "tools": ENTERPRISE_TOOL_NAMES,
        "capabilities": [
            "knowledge_qa",
            "ticket_lookup",
            "policy_lookup",
            "metrics_summary",
        ],
    },
    {
        "id": "customer_support_assistant",
        "name": "智能客服助手",
        "description": "处理客户请求、查询工单和沉淀服务审计记录。",
        "tools": [
            "enterprise_get_ticket_status",
            "enterprise_lookup_policy",
        ],
        "capabilities": [
            "ticket_lookup",
            "policy_lookup",
            "customer_reply",
        ],
    },
    {
        "id": "data_analysis_assistant",
        "name": "数据分析助手",
        "description": "查询部门指标并生成可审计的分析摘要。",
        "tools": ["enterprise_summarize_department_metrics"],
        "capabilities": [
            "metrics_summary",
            "analysis_report",
        ],
    },
]


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
        tenant_hint_from_user_id=_tenant_hint_from_user_id,
        identity_metadata=_platform_identity_metadata,
        member_for_user=lambda user_id: _platform_member_service().get_member_by_user(
            user_id,
            include_inactive=True,
        ),
        role_for_user=_identity_role_for_user,
    )


def _raise_platform_agent_service_error(exc: PlatformAgentServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _platform_agent_run_service() -> PlatformAgentRunService:
    return PlatformAgentRunService(repository=agent_run_repository)


def _raise_platform_agent_run_service_error(
    exc: PlatformAgentRunServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _published_platform_agent_tool_scope_for_user(
    agent_id: str,
    user_id: str,
) -> tuple[dict[str, Any], set[str]]:
    try:
        return _platform_agent_service().published_tool_scope_access_context(
            agent_id,
            user_id=user_id,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)


def _platform_member_service() -> PlatformMemberService:
    return PlatformMemberService(
        repository=member_repository,
        tenant_hint_from_user_id=_tenant_hint_from_user_id,
        now=_now_iso,
    )


def _raise_platform_member_service_error(exc: PlatformMemberServiceError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _identity_role_for_user(user_id: str) -> str:
    tenant_hint = _tenant_hint_from_user_id(user_id)
    if tenant_hint:
        current_tenant = tenant_hint
    else:
        try:
            current_tenant = (
                _platform_connector_config_service().runtime_tenant_for_user(user_id)
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)
    if not current_tenant:
        try:
            current_tenant = (
                _platform_connector_config_service().configured_tenant_for_user(user_id)
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)
    for identity in _platform_identity_metadata(user_id, current_tenant):
        if identity.get("user_id") == user_id:
            return str(identity.get("role") or "").strip()
    return ""


def _resource_record_id(record: Any) -> str | None:
    if isinstance(record, dict):
        value = record.get("id")
    else:
        value = getattr(record, "id", None)
    if value is None:
        return None
    item = str(value).strip()
    return item or None


async def _validate_platform_agent_resources(
    request: Request,
    user_id: str,
    *,
    model_config_id: str | None,
    knowledge_base_ids: list[str],
) -> None:
    if model_config_id:
        access_service = getattr(request.app.state, "resource_access_service", None)
        storage = getattr(request.app.state, "storage", None)
        credential = None

        if access_service is not None:
            try:
                credential = await access_service.resolve_credential(
                    user_id,
                    model_config_id,
                )
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
        elif storage is not None:
            try:
                credential = await storage.get_credential(user_id, model_config_id)
            except AttributeError:
                credential = None

        if credential is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": (
                        "Unknown model credential configured for platform agent."
                    ),
                    "unknown_model_config_id": model_config_id,
                },
            )

    if not knowledge_base_ids:
        return

    knowledge_base_service = getattr(request.app.state, "knowledge_base_service", None)
    storage = getattr(request.app.state, "storage", None)
    knowledge_bases = []
    if knowledge_base_service is not None:
        knowledge_bases = await knowledge_base_service.list_knowledge_bases(user_id)
    elif storage is not None:
        try:
            knowledge_bases = await storage.list_knowledge_bases(user_id)
        except AttributeError:
            knowledge_bases = []

    visible_ids = {
        record_id
        for record_id in (_resource_record_id(record) for record in knowledge_bases)
        if record_id
    }
    missing_ids = [
        knowledge_base_id
        for knowledge_base_id in knowledge_base_ids
        if knowledge_base_id not in visible_ids
    ]
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Unknown knowledge bases configured for platform agent.",
                "unknown_knowledge_base_ids": missing_ids,
            },
        )


def _platform_connector_config_service() -> PlatformConnectorConfigService:
    return PlatformConnectorConfigService(
        repository=connector_config_repository,
        global_connector=enterprise_connector,
        now=_now_iso,
    )


def _raise_platform_connector_config_service_error(
    exc: PlatformConnectorConfigServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _tenant_hint_from_user_id(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    tenant, _user = user_id.split(":", 1)
    tenant = tenant.strip()
    return tenant or None


def _platform_identity_metadata(
    current_user_id: str,
    current_tenant: str,
) -> list[dict[str, Any]]:
    def current_tenant_sample_questions() -> list[Any]:
        try:
            runtime_connector, _source = (
                _platform_connector_config_service()
                .runtime_enterprise_connector_for_tenant(current_tenant)
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)
        return list(
            runtime_connector.describe_tenant_workspace(current_tenant).get(
                "sample_questions",
                [],
            ),
        )

    try:
        return _platform_member_service().identity_metadata_payload(
            current_user_id=current_user_id,
            current_tenant=current_tenant,
            connector_identities=enterprise_connector.list_demo_identities(),
            tenant_for_user=enterprise_connector.tenant_for_user,
            current_tenant_sample_questions=current_tenant_sample_questions,
            authorization_policy=tool_authorization_policy,
            tool_names=ENTERPRISE_TOOL_NAMES,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


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
        now=_now_iso,
    )


def _platform_workflow_run_service() -> PlatformWorkflowRunService:
    return PlatformWorkflowRunService(repository=workflow_run_repository)


def _platform_approval_service() -> PlatformApprovalService:
    return PlatformApprovalService(
        repository=approval_request_repository,
        now=_now_iso,
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
            identity_metadata=_platform_identity_metadata,
            tool_policy_path=_platform_tool_policy_path,
            now=_now_iso,
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
            validate_agent_resources=_validate_platform_agent_resources,
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
                _published_platform_agent_tool_scope_for_user
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
            dev_knowledge_service=dev_knowledge_service,
            enterprise_router_service=enterprise_router_service,
            published_agent_tool_scope_for_user=(
                _published_platform_agent_tool_scope_for_user
            ),
            require_platform_approval=_require_platform_approval,
            run_authorized_enterprise_tool=_run_authorized_enterprise_tool,
            safe_path_part=_safe_path_part,
            describe_runtime_adapter=describe_runtime_adapter,
            build_runtime_invocation_request_payload=(
                build_runtime_invocation_request_payload
            ),
            build_runtime_invocation_result_payload=(
                build_runtime_invocation_result_payload
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
            identity_metadata=_platform_identity_metadata,
            published_agent_tool_scope_for_user=(
                _published_platform_agent_tool_scope_for_user
            ),
            require_platform_approval=_require_platform_approval,
            run_authorized_enterprise_tool=_run_authorized_enterprise_tool,
            now=_now_iso,
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
