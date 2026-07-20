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
from uuid import uuid4

import httpx
import uvicorn
from fastapi import HTTPException, Request
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from api.schemas import (
    EnterpriseAgentPublishRequest,
    EnterpriseAgentRunRequest,
    EnterpriseAgentUpdateRequest,
    EnterpriseApprovalCreateRequest,
    EnterpriseApprovalDecisionRequest,
    EnterpriseConnectorConfigSaveRequest,
    EnterpriseConnectorTestRequest,
    EnterprisePlatformConfigImportRequest,
    EnterprisePlatformMemberPatchRequest,
    EnterprisePlatformMemberUpsertRequest,
    EnterpriseToolPolicyUpdateRequest,
    EnterpriseToolRunRequest,
    EnterpriseWorkflowRunRequest,
    EnterpriseWorkflowTemplateUpdateRequest,
)
from agentscope.app import SubAgentTemplate, create_app
from agentscope.app.message_bus import InMemoryMessageBus, RedisMessageBus
from agentscope.app.rag.blob_store import LocalBlobStore
from agentscope.app.rag.knowledge_base_manager import CollectionPerKbManager
from agentscope.app.storage import RedisStorage
from agentscope.app.workspace_manager import LocalWorkspaceManager
from agentscope.middleware import AgenticMemoryMiddleware
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
    PermissionMode,
)
from agentscope.rag import QdrantStore
from agentscope.tool import FunctionTool, ToolBase

from audit import ToolAuditLogger
from connectors import EnterpriseConnector, build_enterprise_connector
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
from runtime import get_runtime_adapter
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
from services.enterprise_router import (
    EnterpriseRouterError,
    PlatformEnterpriseRouterService,
)
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
    PlatformWorkflowRunServiceError,
    PlatformWorkflowTemplateService,
    PlatformWorkflowTemplateServiceError,
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
APPROVAL_REQUIRED_TOOLS = {"enterprise_summarize_department_metrics"}
APPROVAL_REQUIRED_WORKFLOWS = {"policy_review"}
ENTERPRISE_TOOL_INPUT_FIELDS = {
    "enterprise_lookup_policy": "keyword",
    "enterprise_get_ticket_status": "ticket_id",
    "enterprise_summarize_department_metrics": "department",
}
ENTERPRISE_TOOL_CATALOG = {
    "enterprise_lookup_policy": {
        "description": "Read a tenant-scoped enterprise policy snippet by keyword.",
        "input_key": "keyword",
        "default_input": "remote",
    },
    "enterprise_get_ticket_status": {
        "description": "Read a tenant-scoped IT, finance, or support ticket.",
        "input_key": "ticket_id",
        "default_input": "INC-1001",
    },
    "enterprise_summarize_department_metrics": {
        "description": "Read a tenant-scoped department operations metrics summary.",
        "input_key": "department",
        "default_input": "engineering",
    },
}


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
    return PlatformToolPolicyService(
        policy_path=_platform_tool_policy_path,
        default_policy=json.loads(json.dumps(DEFAULT_TOOL_POLICY)),
        policy_mode=lambda: os.getenv(
            "ENTERPRISE_TOOL_POLICY_MODE",
            "permissive",
        ).strip().lower(),
        enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
        runtime_context=lambda user_id: _enterprise_runtime_context(user_id),
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
        connector_mode = os.getenv("ENTERPRISE_CONNECTOR", connector_name).lower().strip()
        try:
            return _platform_connector_config_service().health_response(
                connector_name=connector_name,
                connector_mode=connector_mode,
                env_configured=_env_configured,
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


class ReadOnlyEnterpriseTool(FunctionTool):
    """Read-only function tool gated by enterprise authorization policy."""

    def __init__(
        self,
        *args: Any,
        tenant: str,
        user_id: str,
        authorization_policy: ToolAuthorizationPolicy,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._tenant = tenant
        self._user_id = user_id
        self._authorization_policy = authorization_policy

    async def check_read_only(
        self,
        _tool_input: dict[str, Any],
    ) -> bool:
        return self.is_read_only and self._authorization_policy.is_allowed(
            self._tenant,
            self._user_id,
            self.name,
        )

    async def check_permissions(
        self,
        _tool_input: dict[str, Any],
        _context: PermissionContext,
    ) -> PermissionDecision:
        decision = self._authorization_policy.authorize(
            self._tenant,
            self._user_id,
            self.name,
        )
        if not decision.allowed:
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message=(
                    f"Enterprise tool {self.name} is not allowed for "
                    f"user {self._user_id} in tenant {self._tenant}."
                ),
                decision_reason=decision.reason,
            )

        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message=(
                f"Enterprise tool {self.name} is allowed for "
                f"user {self._user_id} in tenant {self._tenant}."
            ),
            decision_reason=decision.reason,
        )


async def build_enterprise_tools(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[ToolBase]:
    """Create tenant-aware business tools for one agent invocation."""
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    runtime_connector = runtime["connector"]
    connector_label = str(runtime["connector_label"])

    def audit_tool_call(
        tool_name: str,
        inputs: dict[str, Any],
        call: Any,
    ) -> dict[str, Any]:
        return tool_audit_logger.capture(
            user_id=user_id,
            tenant=tenant,
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            connector=connector_label,
            inputs=inputs,
            call=call,
        )

    def lookup_policy(keyword: str) -> dict[str, Any]:
        """Look up tenant policy snippets by keyword.

        Args:
            keyword: Policy keyword, for example remote, expense, or security.
        """
        return audit_tool_call(
            "enterprise_lookup_policy",
            {"keyword": keyword},
            lambda: runtime_connector.lookup_policy(tenant, keyword),
        )

    def get_ticket_status(ticket_id: str) -> dict[str, Any]:
        """Return the status of a tenant-scoped ticket.

        Args:
            ticket_id: Ticket id visible inside the caller's tenant.
        """
        return audit_tool_call(
            "enterprise_get_ticket_status",
            {"ticket_id": ticket_id},
            lambda: runtime_connector.get_ticket_status(tenant, ticket_id),
        )

    def summarize_department_metrics(department: str) -> dict[str, Any]:
        """Return a compact operational summary for one department.

        Args:
            department: Department name, such as engineering or support.
        """
        return audit_tool_call(
            "enterprise_summarize_department_metrics",
            {"department": department},
            lambda: runtime_connector.summarize_department_metrics(
                tenant,
                department,
            ),
        )

    return [
        ReadOnlyEnterpriseTool(
            lookup_policy,
            name="enterprise_lookup_policy",
            description=(
                "Read a tenant-scoped enterprise policy snippet by keyword."
            ),
            is_read_only=True,
            tenant=tenant,
            user_id=user_id,
            authorization_policy=tool_authorization_policy,
        ),
        ReadOnlyEnterpriseTool(
            get_ticket_status,
            name="enterprise_get_ticket_status",
            description="Read a tenant-scoped IT, finance, or support ticket.",
            is_read_only=True,
            tenant=tenant,
            user_id=user_id,
            authorization_policy=tool_authorization_policy,
        ),
        ReadOnlyEnterpriseTool(
            summarize_department_metrics,
            name="enterprise_summarize_department_metrics",
            description=(
                "Read a tenant-scoped department operations metrics summary."
            ),
            is_read_only=True,
            tenant=tenant,
            user_id=user_id,
            authorization_policy=tool_authorization_policy,
        ),
    ]


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
    return PlatformAgentService(
        repository=agent_repository,
        templates=ENTERPRISE_AGENT_TEMPLATES,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        tenant_for_user=_runtime_tenant_for_user,
        tenant_hint_from_user_id=_tenant_hint_from_user_id,
        identity_metadata=_platform_identity_metadata,
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
        member = _platform_member_service().get_member_by_user(
            user_id,
            include_inactive=True,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)
    try:
        return _platform_agent_service().published_tool_scope_for_user(
            agent_id,
            user_id=user_id,
            member=member,
            role=_identity_role_for_user(user_id),
        )
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
    current_tenant = tenant_hint or _runtime_tenant_for_user(user_id)
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
        tenant_hint_from_user_id=_tenant_hint_from_user_id,
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


def _runtime_tenant_for_user(user_id: str) -> str:
    try:
        return _platform_connector_config_service().runtime_tenant_for_user(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


def _runtime_enterprise_connector_for_tenant(
    tenant: str,
) -> tuple[EnterpriseConnector, str]:
    try:
        return (
            _platform_connector_config_service()
            .runtime_enterprise_connector_for_tenant(tenant)
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


def _enterprise_runtime_context(user_id: str) -> dict[str, Any]:
    try:
        return _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


def _export_platform_config() -> dict[str, Any]:
    try:
        connector_config_service = _platform_connector_config_service()
        connector_configs = connector_config_service.export_configs_payload()
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    try:
        agents = _platform_agent_service().list_agents()
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    try:
        workflow_templates = _platform_workflow_template_service().list_templates()
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)

    try:
        tool_policy = _platform_tool_policy_service().load_policy()
    except PlatformToolPolicyServiceError as exc:
        _raise_platform_tool_policy_service_error(exc)
    try:
        members = _platform_member_service().list_members(include_inactive=True)
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)

    config = {
        "members": members,
        "connector_configs": connector_configs,
        "agents": agents,
        "workflow_templates": workflow_templates,
        "tool_policy": tool_policy,
    }
    return connector_config_service.export_config_response(
        config=config,
        platform_version=PLATFORM_VERSION,
        exported_at=_now_iso(),
        file_paths={
            "members": str(PLATFORM_MEMBERS_PATH),
            "connector_configs": str(PLATFORM_CONNECTOR_CONFIGS_PATH),
            "agents": str(PLATFORM_AGENTS_PATH),
            "workflow_templates": str(PLATFORM_WORKFLOW_TEMPLATES_PATH),
            "tool_policy": str(_platform_tool_policy_path()),
        },
    )


def _platform_identity_metadata(
    current_user_id: str,
    current_tenant: str,
) -> list[dict[str, Any]]:
    def current_tenant_sample_questions() -> list[Any]:
        runtime_connector, _source = _runtime_enterprise_connector_for_tenant(
            current_tenant,
        )
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


def _env_configured(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _env_value(name: str, default: str) -> str:
    return os.getenv(name, default)


def _run_authorized_enterprise_tool(
    *,
    user_id: str,
    tool_name: str,
    inputs: dict[str, Any],
    agent_id: str,
    session_id: str,
    fail_on_denied: bool = True,
) -> dict[str, Any]:
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    runtime_connector = runtime["connector"]
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])

    if tool_name not in ENTERPRISE_TOOL_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown enterprise tool: {tool_name}",
        )

    decision = tool_authorization_policy.authorize(tenant, user_id, tool_name)
    decision_payload = _platform_tool_policy_service().decision_payload(
        tool_name,
        decision,
    )
    if not decision.allowed:
        if fail_on_denied:
            raise HTTPException(
                status_code=403,
                detail={"decision": decision_payload},
            )

        return {
            "tool_name": tool_name,
            "allowed": False,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector_label,
            "connector_source": connector_source,
            "decision": decision_payload,
        }

    clean_inputs, call = _platform_tool_policy_service().build_connector_call(
        tenant=tenant,
        tool_name=tool_name,
        inputs=inputs,
        runtime_connector=runtime_connector,
    )

    result = tool_audit_logger.capture(
        user_id=user_id,
        tenant=tenant,
        agent_id=agent_id,
        session_id=session_id,
        tool_name=tool_name,
        connector=connector_label,
        inputs=clean_inputs,
        call=call,
    )

    return {
        "tool_name": tool_name,
        "allowed": True,
        "tenant": tenant,
        "user_id": user_id,
        "connector": connector_label,
        "connector_source": connector_source,
        "decision": decision_payload,
        "result": result,
    }


def _enterprise_router_config() -> dict[str, Any] | None:
    base_url = os.getenv("ENTERPRISE_AGENT_ROUTER_BASE_URL", "").strip()
    api_key = os.getenv("ENTERPRISE_AGENT_ROUTER_API_KEY", "").strip()
    model = os.getenv("ENTERPRISE_AGENT_ROUTER_MODEL", "").strip()

    if not base_url and not api_key and not model:
        return None

    missing = [
        name
        for name, value in (
            ("ENTERPRISE_AGENT_ROUTER_BASE_URL", base_url),
            ("ENTERPRISE_AGENT_ROUTER_API_KEY", api_key),
            ("ENTERPRISE_AGENT_ROUTER_MODEL", model),
        )
        if not value
    ]
    if missing:
        raise EnterpriseRouterError(
            "Router env is incomplete: missing " + ", ".join(missing),
        )

    provider = (
        os.getenv("ENTERPRISE_AGENT_ROUTER_PROVIDER", "openai")
        .strip()
        .lower()
        or "openai"
    )
    timeout_value = os.getenv("ENTERPRISE_AGENT_ROUTER_TIMEOUT_SECONDS", "8")
    try:
        timeout_seconds = max(1.0, float(timeout_value))
    except ValueError:
        timeout_seconds = 8.0

    return {
        "base_url": base_url,
        "api_key": api_key,
        "model": model,
        "provider": provider,
        "timeout_seconds": timeout_seconds,
    }


async def _route_enterprise_agent_question_with_model(
    question: str,
) -> dict[str, Any]:
    config = _enterprise_router_config()
    if config is None:
        raise EnterpriseRouterError("Router model is not configured.")

    system_prompt, user_prompt = enterprise_router_service.build_model_prompt(question)
    endpoint = enterprise_router_service.build_model_endpoint(
        config["base_url"],
        config["provider"],
    )

    headers, payload = enterprise_router_service.build_model_request(
        provider=config["provider"],
        api_key=config["api_key"],
        model=config["model"],
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    try:
        async with httpx.AsyncClient(
            timeout=config["timeout_seconds"],
        ) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            response_payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise EnterpriseRouterError(
            f"Router HTTP error: {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise EnterpriseRouterError(
            f"Router request failed: {exc.__class__.__name__}",
        ) from exc
    except json.JSONDecodeError as exc:
        raise EnterpriseRouterError("Router HTTP response is not JSON.") from exc

    content = enterprise_router_service.extract_model_response_content(
        provider=config["provider"],
        response_payload=response_payload,
    )
    if not content:
        raise EnterpriseRouterError("Router response content is empty.")

    return enterprise_router_service.parse_model_route_content(content)


def _route_enterprise_agent_question_with_rules(
    question: str,
) -> list[dict[str, Any]]:
    normalized = question.lower()
    routes: list[dict[str, Any]] = []

    routes.extend(enterprise_router_service.ticket_routes_for_question(question))
    routes.extend(enterprise_router_service.policy_routes_for_question(question))

    department_keywords = {
        "engineering": ("engineering", "Detected engineering metrics request."),
        "工程": ("engineering", "Detected engineering metrics request."),
        "研发": ("engineering", "Detected engineering metrics request."),
        "support": ("support", "Detected support metrics request."),
        "客服": ("support", "Detected support metrics request."),
        "支持": ("support", "Detected support metrics request."),
        "sales": ("sales", "Detected sales metrics request."),
        "销售": ("sales", "Detected sales metrics request."),
    }
    for marker, (department, reason) in department_keywords.items():
        if marker in normalized or marker in question:
            routes.append(
                {
                    "routed": True,
                    "tool_name": "enterprise_summarize_department_metrics",
                    "inputs": {"department": department},
                    "reason": reason,
                    "source": ROUTING_SOURCE_RULES,
                },
            )

    has_metrics_route = any(
        route.get("tool_name") == "enterprise_summarize_department_metrics"
        for route in routes
    )
    if (
        not has_metrics_route
        and ("部门" in question or "指标" in question or "metrics" in normalized)
    ):
        routes.append(
            {
                "routed": True,
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": {"department": "engineering"},
                "reason": "Detected a generic department metrics request.",
                "source": ROUTING_SOURCE_RULES,
            },
        )

    return enterprise_router_service.dedupe_routes(routes)


def _route_enterprise_agent_question(question: str) -> dict[str, Any]:
    routes = _route_enterprise_agent_question_with_rules(question)
    return enterprise_router_service.primary_route_or_fallback(routes)


async def _select_enterprise_agent_routes(
    question: str,
) -> tuple[list[dict[str, Any]], str | None]:
    rule_routes = _route_enterprise_agent_question_with_rules(question)
    router_env_present = any(
        os.getenv(name, "").strip()
        for name in (
            "ENTERPRISE_AGENT_ROUTER_BASE_URL",
            "ENTERPRISE_AGENT_ROUTER_API_KEY",
            "ENTERPRISE_AGENT_ROUTER_MODEL",
        )
    )
    if router_env_present:
        try:
            model_route = await _route_enterprise_agent_question_with_model(question)
        except EnterpriseRouterError as exc:
            return rule_routes, str(exc)

        model_routes = [model_route] if model_route.get("routed") else []
        return enterprise_router_service.dedupe_routes(model_routes + rule_routes), None

    return rule_routes, None


def _format_enterprise_agent_answer(
    *,
    tool_name: str,
    result: dict[str, Any] | None,
    tenant: str,
) -> str:
    if not result:
        return "已匹配到企业工具，但当前用户没有权限调用。"

    if tool_name == "enterprise_get_ticket_status":
        ticket_id = result.get("ticket_id", "")
        ticket = result.get("ticket")
        if not ticket:
            return f"在租户 {tenant} 下没有找到工单 {ticket_id}。"

        return (
            f"工单 {ticket_id} 当前状态是 {ticket.get('status', '-')}, "
            f"负责人是 {ticket.get('owner', '-')}, "
            f"摘要：{ticket.get('summary', '-')}。"
        )

    if tool_name == "enterprise_lookup_policy":
        matches = result.get("matches") or {}
        if not matches:
            available = ", ".join(result.get("available_policy_keys", []))
            return f"没有找到匹配的制度内容。当前可查关键词：{available}。"

        snippets = [
            f"{name}: {text}"
            for name, text in list(matches.items())[:3]
        ]
        return "查到这些制度内容：" + " ".join(snippets)

    metrics = result.get("metrics")
    department = result.get("department", "")
    if not metrics:
        available = ", ".join(result.get("available_departments", []))
        return f"没有找到 {department} 部门指标。当前可查部门：{available}。"

    return (
        f"{department} 部门当前有 {metrics.get('active_projects', '-')} 个活跃项目，"
        f"{metrics.get('open_incidents', '-')} 个未关闭事件，"
        f"SLA 为 {metrics.get('sla', '-')}。"
    )


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
    extra_agent_tools=build_enterprise_tools,
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


@app.get("/enterprise/platform/status")
async def enterprise_platform_status(request: Request) -> dict[str, Any]:
    """Return enterprise platform state for the frontend console."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    tenant_workspaces = _platform_connector_config_service().tenant_workspaces(
        identities=identities,
        current_tenant=tenant,
        runtime_connector_for_tenant=_runtime_enterprise_connector_for_tenant,
    )

    return _platform_status_service().platform_snapshot(
        platform_version=PLATFORM_VERSION,
        data_dir=DATA_DIR,
        runtime=runtime,
        tenant=tenant,
        user_id=user_id,
        identities=identities,
        tenant_workspaces=tenant_workspaces,
        subagent_templates=ENTERPRISE_SUBAGENT_TEMPLATES,
    )


@app.get("/enterprise/platform/connectors")
async def enterprise_platform_connectors(request: Request) -> dict[str, Any]:
    """Return enterprise data source connector readiness and tenant scope."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    connector_mode = os.getenv("ENTERPRISE_CONNECTOR", enterprise_connector.name)
    connector_mode = connector_mode.lower().strip()

    try:
        response = _platform_connector_config_service().metadata_response(
            runtime=runtime,
            connector_name=enterprise_connector.name,
            connector_mode=connector_mode,
            env_configured=_env_configured,
            env_value=_env_value,
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)

    response["identities"] = identities
    response["tenant_workspaces"] = (
        _platform_connector_config_service().tenant_workspaces(
            identities=identities,
            current_tenant=tenant,
            runtime_connector_for_tenant=_runtime_enterprise_connector_for_tenant,
        )
    )
    return response


@app.get("/enterprise/platform/governance")
async def enterprise_platform_governance(request: Request) -> dict[str, Any]:
    """Return tenant, identity, approval, and audit governance state."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    tenant_workspaces = _platform_connector_config_service().tenant_workspaces(
        identities=identities,
        current_tenant=tenant,
        runtime_connector_for_tenant=_runtime_enterprise_connector_for_tenant,
    )
    return _platform_status_service().governance_snapshot(
        identities=identities,
        tenant_workspaces=tenant_workspaces,
    )


@app.get("/enterprise/platform/members")
async def enterprise_platform_members(request: Request) -> dict[str, Any]:
    """Return the editable enterprise member registry."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    identities = _platform_identity_metadata(user_id, str(runtime["tenant"]))
    try:
        return _platform_member_service().registry_payload(
            identities=identities,
            registry_path=PLATFORM_MEMBERS_PATH,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


@app.post("/enterprise/platform/members")
async def create_enterprise_platform_member(
    payload: EnterprisePlatformMemberUpsertRequest,
    request: Request,
) -> dict[str, Any]:
    """Create or replace one enterprise platform member."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    try:
        member, members = _platform_member_service().upsert_member(
            payload.model_dump(),
            actor=actor,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)
    return _platform_member_service().mutation_payload(
        member=member,
        members=members,
        identities=_platform_identity_metadata(actor, member["tenant"]),
        registry_path=PLATFORM_MEMBERS_PATH,
    )


@app.patch("/enterprise/platform/members/{user_id:path}")
async def update_enterprise_platform_member(
    user_id: str,
    payload: EnterprisePlatformMemberPatchRequest,
    request: Request,
) -> dict[str, Any]:
    """Update one enterprise platform member."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    try:
        member, members = _platform_member_service().patch_member(
            user_id,
            payload.model_dump(exclude_unset=True),
            actor=actor,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)
    return _platform_member_service().mutation_payload(
        member=member,
        members=members,
        identities=_platform_identity_metadata(actor, member["tenant"]),
        registry_path=PLATFORM_MEMBERS_PATH,
    )


@app.delete("/enterprise/platform/members/{user_id:path}")
async def deactivate_enterprise_platform_member(
    user_id: str,
    request: Request,
) -> dict[str, Any]:
    """Soft-delete one enterprise platform member by marking it inactive."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    try:
        existing, members = _platform_member_service().deactivate_member(
            user_id,
            actor=actor,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)
    return _platform_member_service().mutation_payload(
        member=existing,
        members=members,
        identities=_platform_identity_metadata(actor, existing["tenant"]),
        registry_path=PLATFORM_MEMBERS_PATH,
    )


@app.get("/enterprise/platform/policies/tools")
async def enterprise_platform_tool_policy(
    request: Request,
    user_id: str | None = None,
    tenant: str | None = None,
) -> dict[str, Any]:
    """Return editable enterprise tool authorization policy state."""
    resolved_user_id = user_id or request.headers.get("X-User-ID") or "acme:alice"
    try:
        return _platform_tool_policy_service().policy_payload(
            authorization_policy=tool_authorization_policy,
            user_id=resolved_user_id,
            tenant=tenant,
        )
    except PlatformToolPolicyServiceError as exc:
        _raise_platform_tool_policy_service_error(exc)


@app.patch("/enterprise/platform/policies/tools")
async def update_enterprise_platform_tool_policy(
    payload: EnterpriseToolPolicyUpdateRequest,
) -> dict[str, Any]:
    """Persist one tenant user's enterprise tool authorization policy."""
    global tool_authorization_policy

    try:
        (
            tool_authorization_policy,
            response_payload,
        ) = _platform_tool_policy_service().update_user_policy_payload(
            tenant=payload.tenant,
            user_id=payload.user_id,
            allow=payload.allow,
            deny=payload.deny,
        )
    except PlatformToolPolicyServiceError as exc:
        _raise_platform_tool_policy_service_error(exc)

    return response_payload


@app.get("/enterprise/platform/connectors/configs")
async def enterprise_platform_connector_configs() -> dict[str, Any]:
    """Return tenant connector configurations without exposing secrets."""
    try:
        return _platform_connector_config_service().list_configs_response()
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


@app.post("/enterprise/platform/connectors/configs")
async def save_enterprise_platform_connector_config(
    payload: EnterpriseConnectorConfigSaveRequest,
    request: Request,
) -> dict[str, Any]:
    """Persist a tenant-scoped connector configuration."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    try:
        return _platform_connector_config_service().save_config_payload(
            payload,
            user_id=user_id,
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


@app.post("/enterprise/platform/connectors/test")
async def test_enterprise_platform_connector(
    payload: EnterpriseConnectorTestRequest,
) -> dict[str, Any]:
    """Validate an enterprise HTTP connector against core business endpoints."""
    try:
        return _platform_connector_config_service().test_connector(payload)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


@app.get("/enterprise/platform/config/export")
async def export_enterprise_platform_config() -> dict[str, Any]:
    """Export portable platform configuration without runtime data or secrets."""
    return _export_platform_config()


@app.post("/enterprise/platform/config/import")
async def import_enterprise_platform_config(
    payload: EnterprisePlatformConfigImportRequest,
    request: Request,
) -> dict[str, Any]:
    """Import portable platform configuration by merging or replacing sections."""
    global tool_authorization_policy

    actor = request.headers.get("X-User-ID") or "acme:alice"
    try:
        mode, incoming = (
            _platform_connector_config_service().normalize_config_import_request(
                payload,
            )
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)

    if "members" in incoming:
        try:
            _platform_member_service().import_members_payload(
                incoming.get("members"),
                actor=actor,
                mode=mode,
            )
        except PlatformMemberServiceError as exc:
            _raise_platform_member_service_error(exc)

    if "connector_configs" in incoming:
        try:
            _platform_connector_config_service().import_configs_payload(
                incoming.get("connector_configs"),
                actor=actor,
                mode=mode,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_platform_connector_config_service_error(exc)

    if "agents" in incoming:
        try:
            _platform_agent_service().import_agents_payload(
                incoming.get("agents"),
                mode=mode,
            )
        except PlatformAgentServiceError as exc:
            _raise_platform_agent_service_error(exc)

    if "workflow_templates" in incoming:
        try:
            _platform_workflow_template_service().import_templates_payload(
                incoming.get("workflow_templates"),
                mode=mode,
            )
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_platform_workflow_template_service_error(exc)

    if "tool_policy" in incoming:
        try:
            _platform_tool_policy_service().import_policy_payload(
                incoming.get("tool_policy"),
                mode=mode,
            )
        except PlatformToolPolicyServiceError as exc:
            _raise_platform_tool_policy_service_error(exc)
        tool_authorization_policy = _build_tool_authorization_policy()

    exported = _export_platform_config()
    return _platform_connector_config_service().import_config_response(
        mode=mode,
        exported_config=exported,
    )


@app.get("/enterprise/platform/agents")
async def enterprise_platform_agents() -> dict[str, Any]:
    """Return platform agent templates and published tenant instances."""
    return _platform_agent_service().registry_response()


@app.post("/enterprise/platform/agents/publish")
async def publish_enterprise_platform_agent(
    payload: EnterpriseAgentPublishRequest,
    request: Request,
) -> dict[str, Any]:
    """Publish one business template as a tenant-scoped platform agent."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    resource_inputs = _platform_agent_service().resource_validation_inputs(payload)
    await _validate_platform_agent_resources(
        request,
        user_id,
        **resource_inputs,
    )
    try:
        agent, agents = _platform_agent_service().create_agent(payload, user_id)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    return _platform_agent_service().mutation_response(agent, agents)


@app.patch("/enterprise/platform/agents/{agent_id}")
async def update_enterprise_platform_agent(
    agent_id: str,
    payload: EnterpriseAgentUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update a tenant-scoped platform agent instance."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    try:
        existing_agent = _platform_agent_service().get_agent(agent_id)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    resource_inputs = _platform_agent_service().resource_validation_inputs(
        payload,
        existing_agent=existing_agent,
    )
    await _validate_platform_agent_resources(
        request,
        user_id,
        **resource_inputs,
    )
    try:
        agent, agents = _platform_agent_service().update_agent(
            agent_id,
            payload,
            user_id,
        )
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    return _platform_agent_service().mutation_response(agent, agents)


@app.delete("/enterprise/platform/agents/{agent_id}")
async def archive_enterprise_platform_agent(
    agent_id: str,
) -> dict[str, Any]:
    """Archive a platform agent while keeping its registry record."""
    try:
        agent, agents = _platform_agent_service().archive_agent(agent_id)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    return _platform_agent_service().mutation_response(agent, agents)


@app.get("/enterprise/platform/tools")
async def enterprise_platform_tools(
    request: Request,
    agent_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Return tool catalog metadata, authorization, bindings, and stats."""
    resolved_user_id = user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(resolved_user_id)
    tenant = str(runtime["tenant"])
    try:
        published_agents = _platform_agent_service().list_published_agents()
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    configured_agent = None
    if agent_id:
        try:
            configured_agent = _platform_agent_service().get_published_agent(agent_id)
        except PlatformAgentServiceError as exc:
            _raise_platform_agent_service_error(exc)

    configured_agent_tools = (
        set(configured_agent.get("tools") or []) if configured_agent else set()
    )
    decisions = {
        decision["name"]: decision
        for decision in tool_authorization_policy.describe_for_user(
            tenant,
            resolved_user_id,
            ENTERPRISE_TOOL_NAMES,
        )
    }
    tools = []
    for tool_name in ENTERPRISE_TOOL_NAMES:
        catalog = ENTERPRISE_TOOL_CATALOG[tool_name]
        events = tool_audit_logger.query(
            user_id=resolved_user_id,
            tool_name=tool_name,
            limit=200,
        )
        decision = decisions.get(tool_name)
        tools.append(
            {
                "name": tool_name,
                "description": catalog["description"],
                "input_key": catalog["input_key"],
                "default_input": catalog["default_input"],
                "allowed": bool(decision and decision.get("allowed")),
                "reason": decision.get("reason") if decision else "",
                "configured_by_agents": [
                    str(agent.get("id"))
                    for agent in published_agents
                    if tool_name in (agent.get("tools") or [])
                ],
                "configured_for_agent": (
                    tool_name in configured_agent_tools
                    if configured_agent is not None
                    else None
                ),
                "configured_agent_id": (
                    str(configured_agent.get("id")) if configured_agent else None
                ),
                "stats": _platform_tool_policy_service().audit_stats(events),
            },
        )
    return {
        "tools": tools,
        "user_id": resolved_user_id,
        "tenant": tenant,
        "connector": runtime["connector_label"],
        "connector_source": runtime["connector_source"],
        "agent_id": agent_id,
    }


@app.get("/enterprise/platform/audit")
async def enterprise_platform_audit(
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    tool_name: str | None = None,
    success: bool | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Return filtered enterprise tool audit events."""
    normalized_limit = max(1, min(limit, 200))
    events = tool_audit_logger.query(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
        tool_name=tool_name,
        success=success,
        limit=normalized_limit,
    )
    stats = _platform_tool_policy_service().audit_stats(events)
    return {
        "events": events,
        "summary": {
            "total_returned": stats["calls"],
            "successes": stats["successes"],
            "failures": stats["failures"],
            "avg_duration_ms": stats["avg_duration_ms"],
            "unique_users": len(
                {
                    event.get("user_id")
                    for event in events
                    if event.get("user_id")
                }
            ),
            "unique_agents": len(
                {
                    event.get("agent_id")
                    for event in events
                    if event.get("agent_id")
                }
            ),
            "unique_tools": len(
                {
                    event.get("tool_name")
                    for event in events
                    if event.get("tool_name")
                }
            ),
        },
        "filters": {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "success": success,
        },
        "limit": normalized_limit,
    }


@app.post("/enterprise/platform/tools/run")
async def run_enterprise_tool(
    payload: EnterpriseToolRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run one tenant-aware enterprise tool from the platform console."""
    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    runner_agent_id = "platform-console"
    configured_agent_id = (payload.agent_id or "").strip()
    if configured_agent_id:
        _, configured_tools = _published_platform_agent_tool_scope_for_user(
            configured_agent_id,
            user_id,
        )
        runner_agent_id = configured_agent_id
        if payload.tool_name not in configured_tools:
            runtime = _enterprise_runtime_context(user_id)
            decision = _platform_agent_service().tool_denial_payload(payload.tool_name)
            return {
                "tool_name": payload.tool_name,
                "allowed": False,
                "tenant": runtime["tenant"],
                "user_id": user_id,
                "connector": runtime["connector_label"],
                "connector_source": runtime["connector_source"],
                "decision": decision,
            }

    approval_id = None
    if payload.tool_name in APPROVAL_REQUIRED_TOOLS:
        approval_id = _require_platform_approval(
            approval_id=payload.approval_id,
            request_type="tool_run",
            target_key="tool_name",
            target_value=payload.tool_name,
            tenant=str(runtime["tenant"]),
            user_id=user_id,
            agent_id=runner_agent_id,
            inputs=payload.inputs,
        )

    response = _run_authorized_enterprise_tool(
        user_id=user_id,
        tool_name=payload.tool_name,
        inputs=payload.inputs,
        agent_id=runner_agent_id,
        session_id="platform-console",
    )
    if approval_id:
        response["approval_id"] = approval_id
    return response


@app.post("/enterprise/platform/agent/run")
async def run_enterprise_agent(
    payload: EnterpriseAgentRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Route a business question through a published enterprise agent."""

    def routing_mode_for(routes: list[dict[str, Any]]) -> str:
        sources: list[str] = []
        for route in routes:
            source = str(route.get("source", ROUTING_SOURCE_RULES))
            if source not in sources:
                sources.append(source)

        return "+".join(sources) if sources else ROUTING_SOURCE_RULES

    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])
    question = payload.question.strip()
    agent = None
    if payload.agent_id:
        agent, _ = _published_platform_agent_tool_scope_for_user(
            payload.agent_id,
            user_id,
        )

    agent_metadata = _platform_agent_service().run_metadata(agent)
    runtime_adapter = get_runtime_adapter(agent_metadata)
    runtime_adapter_payload = runtime_adapter.describe(agent_metadata)
    configured_tools = (
        set(agent_metadata["configured_tools"])
        if agent is not None
        else set(ENTERPRISE_TOOL_NAMES)
    )
    runner_agent_id = (
        str(agent_metadata["agent_id"])
        if agent_metadata.get("agent_id")
        else "platform-agent-runner"
    )
    runner_session_id = (payload.session_id or "").strip() or (
        f"platform-agent:{runner_agent_id}:{_safe_path_part(user_id)}"
    )
    memory_enabled = bool(agent_metadata.get("memory_enabled", False))
    memory_hits = (
        platform_memory_service.search_memories(
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            question=question,
            max_records=PLATFORM_MEMORY_MAX_RECORDS,
            limit=PLATFORM_MEMORY_SEARCH_LIMIT,
        )
        if memory_enabled
        else []
    )
    memory_payload = {
        "memory_enabled": memory_enabled,
        "memory_hits": memory_hits,
        "memory_scope": {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": runner_agent_id,
        },
    }
    knowledge_hits, knowledge_error = (
        await knowledge_response_service.search_agent_knowledge_bases(
            knowledge_base_service=getattr(
                request.app.state,
                "knowledge_base_service",
                None,
            ),
            dev_knowledge_service=dev_knowledge_service,
            dev_knowledge_provider=PLATFORM_DEV_KNOWLEDGE_PROVIDER,
            user_id=user_id,
            question=question,
            knowledge_base_ids=list(agent_metadata.get("knowledge_base_ids") or []),
        )
    )
    knowledge_payload = {
        "knowledge_hits": knowledge_hits,
        **({"knowledge_error": knowledge_error} if knowledge_error else {}),
    }
    routes, routing_error = await _select_enterprise_agent_routes(question)
    routing_mode = routing_mode_for(routes)
    routing_source = routing_mode

    if not routes:
        route = _route_enterprise_agent_question(question)
        decision = {
            "reason": route["reason"],
            "routing_reason": route["reason"],
            "routing_source": routing_source,
            "routing_mode": routing_mode,
        }
        if routing_error:
            decision["routing_error"] = routing_error
        answer = (
            knowledge_response_service.format_answer(knowledge_hits)
            if knowledge_hits
            else (
                platform_memory_service.format_answer(memory_hits)
                if memory_hits
                else (
                    "这个演示 Agent 暂时只会处理三类问题：工单状态、制度查询、"
                    "部门指标。你可以试试：帮我查一下 INC-1001 的工单状态。"
                )
            )
        )
        memory_saved = False
        if memory_enabled and not platform_memory_service.is_agent_turn_memory_lookup(
            question,
        ):
            platform_memory_service.append_agent_turn_memory(
                tenant=tenant,
                user_id=user_id,
                agent_id=runner_agent_id,
                session_id=runner_session_id,
                question=question,
                answer=answer,
                tool_calls=[],
                knowledge_base_ids=list(
                    agent_metadata.get("knowledge_base_ids") or [],
                ),
                max_records=PLATFORM_MEMORY_MAX_RECORDS,
            )
            memory_saved = True

        turn_id = uuid4().hex
        created_at = _now_iso()
        evidence = _platform_agent_run_service().build_evidence(
            turn_id=turn_id,
            created_at=created_at,
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            tool_calls=[],
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
        )
        response = {
            "answer": answer,
            "routed": False,
            "turn_id": turn_id,
            "session_id": runner_session_id,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector_label,
            "connector_source": connector_source,
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": route["reason"],
            **({"routing_error": routing_error} if routing_error else {}),
            **agent_metadata,
            "runtime_adapter": runtime_adapter_payload,
            **knowledge_payload,
            **memory_payload,
            "memory_saved": memory_saved,
            "decision": decision,
            "tool_calls": [],
            "evidence": evidence,
        }
        _platform_agent_run_service().append_run(
            {
                "turn_id": turn_id,
                "session_id": runner_session_id,
                "agent_id": runner_agent_id,
                "agent_name": agent_metadata.get("agent_name"),
                "tenant": tenant,
                "user_id": user_id,
                "question": question,
                "answer": answer,
                "created_at": created_at,
                "runtime_adapter": runtime_adapter_payload,
                "evidence": evidence,
                "response": response,
            },
        )
        return response

    tool_calls: list[dict[str, Any]] = []
    for route in routes:
        tool_name = str(route["tool_name"])
        route_inputs = dict(route["inputs"])
        route_reason = str(route.get("reason", "Matched enterprise tool route."))
        route_source = str(route.get("source", ROUTING_SOURCE_RULES))

        if tool_name not in configured_tools:
            denial = _platform_agent_service().tool_denial_payload(tool_name)
            reason = str(denial["reason"])
            decision = {
                **denial,
                "routing_reason": route_reason,
                "routing_source": route_source,
                "routing_mode": routing_mode,
            }
            if routing_error:
                decision["routing_error"] = routing_error

            tool_calls.append(
                {
                    "tool_name": tool_name,
                    "inputs": route_inputs,
                    "allowed": False,
                    "tenant": tenant,
                    "user_id": user_id,
                    "connector": connector_label,
                    "connector_source": connector_source,
                    "routing_source": route_source,
                    "routing_reason": route_reason,
                    "decision": decision,
                    "answer": reason,
                },
            )
            continue

        approved_by: str | None = None
        if tool_name in APPROVAL_REQUIRED_TOOLS:
            try:
                approved_by = _require_platform_approval(
                    approval_id=payload.approval_id,
                    request_type="tool_run",
                    target_key="tool_name",
                    target_value=tool_name,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=runner_agent_id,
                    inputs=route_inputs,
                )
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, dict) else {}
                if exc.status_code != 403 or not detail.get("approval_required"):
                    raise

                try:
                    approval = _platform_approval_service().create_request(
                        request_type="tool_run",
                        tenant=tenant,
                        user_id=user_id,
                        agent_id=runner_agent_id,
                        tool_name=tool_name,
                        inputs=route_inputs,
                        reason=str(
                            detail.get(
                                "message",
                                "该工具需要审批后才能运行。",
                            ),
                        ),
                        requested_by=request.headers.get("X-User-ID") or user_id,
                    )
                except PlatformApprovalServiceError as service_exc:
                    _raise_platform_approval_service_error(service_exc)
                approval_id = str(approval["approval_id"])
                approval_message = (
                    f"该工具需要审批，已自动创建审批请求 {approval_id}。"
                    "请到审批中心批准后再运行。"
                )
                decision = {
                    "allowed": False,
                    "reason": detail.get(
                        "message",
                        "该工具需要审批后才能运行。",
                    ),
                    "approval_required": True,
                    "approval_id": approval_id,
                    "approval_status": "pending",
                    "routing_reason": route_reason,
                    "routing_source": route_source,
                    "routing_mode": routing_mode,
                    **({"routing_error": routing_error} if routing_error else {}),
                }
                tool_calls.append(
                    {
                        "tool_name": tool_name,
                        "inputs": route_inputs,
                        "allowed": False,
                        "approval_required": True,
                        "approval_id": approval_id,
                        "approval_status": "pending",
                        "tenant": tenant,
                        "user_id": user_id,
                        "connector": connector_label,
                        "connector_source": connector_source,
                        "routing_source": route_source,
                        "routing_reason": route_reason,
                        "decision": decision,
                        "answer": approval_message,
                    },
                )
                continue

        tool_response = _run_authorized_enterprise_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=route_inputs,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            fail_on_denied=False,
        )
        decision = {
            **tool_response["decision"],
            "routing_reason": route_reason,
            "routing_source": route_source,
            "routing_mode": routing_mode,
            **({"routing_error": routing_error} if routing_error else {}),
        }
        call_answer = _format_enterprise_agent_answer(
            tool_name=tool_name,
            result=tool_response.get("result"),
            tenant=tool_response["tenant"],
        )
        tool_calls.append(
            {
                "tool_name": tool_name,
                "inputs": route_inputs,
                "allowed": bool(tool_response.get("allowed")),
                "tenant": tool_response["tenant"],
                "user_id": tool_response["user_id"],
                "connector": tool_response.get("connector", connector_label),
                "connector_source": tool_response.get(
                    "connector_source",
                    connector_source,
                ),
                "routing_source": route_source,
                "routing_reason": route_reason,
                "approval_id": approved_by,
                "decision": decision,
                "result": tool_response.get("result"),
                "answer": call_answer,
            },
        )

    executed_tool_calls = [call for call in tool_calls if call.get("allowed")]
    primary_call = executed_tool_calls[0] if executed_tool_calls else tool_calls[0]
    routing_reason = "; ".join(
        f"{call['tool_name']}: {call.get('routing_reason', '')}"
        for call in tool_calls
    )
    answer_parts = [
        f"工具 {call['tool_name']}: {call['answer']}"
        for call in tool_calls
        if call.get("answer")
    ]
    if knowledge_hits:
        answer_parts.append(
            f"知识库: {knowledge_response_service.format_answer(knowledge_hits)}",
        )
    if memory_hits:
        answer_parts.insert(
            0,
            f"长期记忆: {platform_memory_service.format_answer(memory_hits)}",
        )
    answer = "\n\n".join(answer_parts)
    memory_saved = False
    if memory_enabled and not platform_memory_service.is_agent_turn_memory_lookup(
        question,
    ):
        platform_memory_service.append_agent_turn_memory(
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            question=question,
            answer=answer,
            tool_calls=tool_calls,
            knowledge_base_ids=list(agent_metadata.get("knowledge_base_ids") or []),
            max_records=PLATFORM_MEMORY_MAX_RECORDS,
        )
        memory_saved = True

    turn_id = uuid4().hex
    created_at = _now_iso()
    evidence = _platform_agent_run_service().build_evidence(
        turn_id=turn_id,
        created_at=created_at,
        tenant=primary_call.get("tenant", tenant),
        user_id=primary_call.get("user_id", user_id),
        agent_id=runner_agent_id,
        session_id=runner_session_id,
        tool_calls=tool_calls,
        knowledge_hits=knowledge_hits,
        memory_hits=memory_hits,
        memory_saved=memory_saved,
    )
    response = {
        "answer": answer,
        "routed": bool(executed_tool_calls),
        "turn_id": turn_id,
        "session_id": runner_session_id,
        "tool_name": primary_call.get("tool_name"),
        "inputs": primary_call.get("inputs"),
        "tenant": primary_call.get("tenant", tenant),
        "user_id": primary_call.get("user_id", user_id),
        "connector": primary_call.get("connector", connector_label),
        "connector_source": primary_call.get("connector_source", connector_source),
        "routing_mode": routing_mode,
        "routing_source": routing_source,
        "routing_reason": routing_reason,
        **({"routing_error": routing_error} if routing_error else {}),
        **agent_metadata,
        "runtime_adapter": runtime_adapter_payload,
        "decision": primary_call.get("decision"),
        "result": primary_call.get("result"),
        "tool_calls": tool_calls,
        **knowledge_payload,
        **memory_payload,
        "memory_saved": memory_saved,
        "evidence": evidence,
    }
    _platform_agent_run_service().append_run(
        {
            "turn_id": turn_id,
            "session_id": runner_session_id,
            "agent_id": runner_agent_id,
            "agent_name": agent_metadata.get("agent_name"),
            "tenant": tenant,
            "user_id": user_id,
            "question": question,
            "answer": answer,
            "created_at": created_at,
            "runtime_adapter": runtime_adapter_payload,
            "evidence": evidence,
            "response": response,
        },
    )
    return response


@app.get("/enterprise/platform/agent/runs")
async def list_enterprise_agent_runs(
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent enterprise agent question-answer turns."""
    return _platform_agent_run_service().list_runs(
        limit=limit,
        agent_id=agent_id,
        tenant=tenant,
        user_id=user_id,
        session_id=session_id,
    )


@app.get("/enterprise/platform/agent/runs/{turn_id}")
async def get_enterprise_agent_run(turn_id: str) -> dict[str, Any]:
    """Get a single enterprise agent question-answer turn by run ID."""
    try:
        return _platform_agent_run_service().get_run(turn_id)
    except PlatformAgentRunServiceError as exc:
        _raise_platform_agent_run_service_error(exc)


@app.delete("/enterprise/platform/agent/runs")
async def clear_enterprise_agent_runs(
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Clear matching enterprise agent question-answer turns."""
    try:
        return _platform_agent_run_service().clear_runs(
            agent_id=agent_id,
            tenant=tenant,
            user_id=user_id,
            session_id=session_id,
        )
    except PlatformAgentRunServiceError as exc:
        _raise_platform_agent_run_service_error(exc)


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


def _raise_platform_workflow_template_service_error(
    exc: PlatformWorkflowTemplateServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _raise_platform_workflow_run_service_error(
    exc: PlatformWorkflowRunServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _raise_platform_approval_service_error(
    exc: PlatformApprovalServiceError,
) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _enterprise_platform_scenarios() -> dict[str, Any]:
    try:
        workflows = _platform_workflow_template_service().list_templates()
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)
    workflow_run_service = _platform_workflow_run_service()
    workflow_runs = workflow_run_service.list_run_records(limit=100)
    try:
        pending_approvals = _platform_approval_service().list_records(
            limit=100,
            status="pending",
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return workflow_run_service.build_platform_scenarios(
        workflows=workflows,
        workflow_runs=workflow_runs,
        pending_approvals=pending_approvals,
        enterprise_tool_catalog=ENTERPRISE_TOOL_CATALOG,
        approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        approval_required_workflows=APPROVAL_REQUIRED_WORKFLOWS,
    )


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


def _workflow_error_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        decision = detail.get("decision")
        if isinstance(decision, dict) and decision.get("reason"):
            return str(decision["reason"])
        if detail.get("detail"):
            return str(detail["detail"])
    return str(detail)


def _workflow_step(
    *,
    user_id: str,
    agent_id: str,
    session_id: str,
    step_id: str,
    title: str,
    tool_name: str,
    inputs: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        tool_response = _run_authorized_enterprise_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=inputs,
            agent_id=agent_id,
            session_id=session_id,
            fail_on_denied=False,
        )
        allowed = bool(tool_response.get("allowed"))
        result = tool_response.get("result")
        decision = tool_response.get("decision")
        message = (
            _format_enterprise_agent_answer(
                tool_name=tool_name,
                result=result,
                tenant=str(tool_response["tenant"]),
            )
            if allowed
            else str((decision or {}).get("reason") or "当前用户无权调用该工具。")
        )
        status = "success" if allowed else "denied"

        step = {
            "id": step_id,
            "title": title,
            "tool_name": tool_name,
            "inputs": inputs,
            "status": status,
            "result": result,
            "decision": decision,
            "message": message,
        }
        tool_call = {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": allowed,
            "tenant": tool_response.get("tenant"),
            "user_id": tool_response.get("user_id"),
            "connector": tool_response.get("connector"),
            "connector_source": tool_response.get("connector_source"),
            "decision": decision,
            "result": result,
            "answer": message,
        }
        return step, tool_call
    except HTTPException as exc:
        decision = None
        if isinstance(exc.detail, dict) and isinstance(exc.detail.get("decision"), dict):
            decision = exc.detail["decision"]
        message = _workflow_error_message(exc)
    except Exception as exc:  # pragma: no cover - defensive platform boundary.
        decision = None
        message = f"{exc.__class__.__name__}: {exc}"

    step = {
        "id": step_id,
        "title": title,
        "tool_name": tool_name,
        "inputs": inputs,
        "status": "failed",
        "decision": decision,
        "message": message,
    }
    tool_call = {
        "tool_name": tool_name,
        "inputs": inputs,
        "allowed": False,
        "decision": decision,
        "answer": message,
    }
    return step, tool_call


@app.get("/enterprise/platform/workflows")
async def list_enterprise_workflows() -> dict[str, Any]:
    """List platform-managed workflow templates."""
    try:
        workflows = _platform_workflow_template_service().list_templates()
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)
    return {"workflows": workflows}


@app.get("/enterprise/platform/scenarios")
async def list_enterprise_platform_scenarios() -> dict[str, Any]:
    """List business scenarios backed by platform-managed workflows."""
    return _enterprise_platform_scenarios()


@app.get("/enterprise/platform/ops/tasks")
async def enterprise_platform_ops_tasks(request: Request) -> dict[str, Any]:
    """List open operator tasks for the current enterprise platform tenant."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    return _platform_status_service().ops_tasks(
        tenant=tenant,
        user_id=user_id,
        identities=identities,
    )


@app.post("/enterprise/platform/ops/tasks/{task_code}/resolve")
async def resolve_enterprise_platform_ops_task(
    task_code: str,
    request: Request,
) -> dict[str, Any]:
    """Resolve deterministic platform operations tasks from the console."""
    normalized_code = task_code.strip()
    if normalized_code != "disabled_workflows":
        raise HTTPException(
            status_code=400,
            detail=f"Operations task cannot be auto-resolved: {normalized_code}",
        )

    actor = request.headers.get("X-User-ID") or "platform-admin"
    try:
        (
            enabled_workflows,
            workflows,
        ) = _platform_workflow_template_service().enable_disabled_templates(
            actor=actor,
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)

    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    return _platform_status_service().resolved_disabled_workflows_payload(
        task_code=normalized_code,
        enabled_workflows=enabled_workflows,
        workflows=workflows,
        tenant=tenant,
        user_id=user_id,
        identities=identities,
    )


@app.patch("/enterprise/platform/workflows/{workflow_type}")
async def update_enterprise_workflow(
    workflow_type: str,
    payload: EnterpriseWorkflowTemplateUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update mutable workflow template metadata from the platform console."""
    normalized_type = workflow_type.strip()
    try:
        workflow, workflows = _platform_workflow_template_service().update_template(
            workflow_type=normalized_type,
            payload=payload,
            actor=request.headers.get("X-User-ID") or "platform-admin",
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)
    return {"workflow": workflow, "workflows": workflows}


@app.get("/enterprise/platform/workflows/runs")
async def list_enterprise_workflow_runs(
    workflow_type: str | None = None,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform workflow runs for review and audit."""
    return _platform_workflow_run_service().list_runs(
        limit=limit,
        workflow_type=workflow_type,
        agent_id=agent_id,
        tenant=tenant,
        user_id=user_id,
    )


@app.get("/enterprise/platform/approvals")
async def list_enterprise_approval_requests(
    status: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform governance approval requests."""
    try:
        return _platform_approval_service().list_requests(
            limit=limit,
            status=status,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)


@app.post("/enterprise/platform/approvals")
async def create_enterprise_approval_request(
    payload: EnterpriseApprovalCreateRequest,
    request: Request,
) -> dict[str, Any]:
    """Create a pending approval request for a high-risk platform action."""
    request_type = payload.request_type.strip()
    tool_name = (payload.tool_name or "").strip() or None
    workflow_type = (payload.workflow_type or "").strip() or None
    if tool_name and tool_name not in ENTERPRISE_TOOL_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown enterprise tool: {tool_name}")
    if workflow_type:
        try:
            _platform_workflow_template_service().get_template(workflow_type)
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_platform_workflow_template_service_error(exc)

    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    default_agent_id = "platform-workflow" if request_type == "workflow_run" else "platform-console"
    try:
        record = _platform_approval_service().create_request(
            request_type=request_type,
            tenant=str(runtime["tenant"]),
            user_id=user_id,
            agent_id=(payload.agent_id or "").strip() or default_agent_id,
            tool_name=tool_name,
            workflow_type=workflow_type,
            inputs=payload.inputs,
            reason=payload.reason,
            requested_by=request.headers.get("X-User-ID") or user_id,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return {"approval": record}


@app.post("/enterprise/platform/approvals/{approval_id}/approve")
async def approve_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Approve a pending platform governance request."""
    decided_by = (
        (payload.decided_by or "").strip()
        or request.headers.get("X-User-ID")
        or "platform-admin"
    )
    try:
        approval = _platform_approval_service().update_status(
            approval_id=approval_id,
            status="approved",
            decided_by=decided_by,
            decision_note=payload.decision_note,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return {"approval": approval}


@app.post("/enterprise/platform/approvals/{approval_id}/reject")
async def reject_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Reject a pending platform governance request."""
    decided_by = (
        (payload.decided_by or "").strip()
        or request.headers.get("X-User-ID")
        or "platform-admin"
    )
    try:
        approval = _platform_approval_service().update_status(
            approval_id=approval_id,
            status="rejected",
            decided_by=decided_by,
            decision_note=payload.decision_note,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return {"approval": approval}


@app.post("/enterprise/platform/workflows/run")
async def run_enterprise_workflow(
    payload: EnterpriseWorkflowRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run a predefined enterprise automation workflow from the platform."""
    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    requested_agent_id = (payload.agent_id or "").strip()
    agent_id = requested_agent_id or "platform-workflow"
    configured_tools: set[str] | None = None
    if requested_agent_id:
        _, configured_tools = _published_platform_agent_tool_scope_for_user(
            requested_agent_id,
            user_id,
        )

    workflow_type = payload.workflow_type.strip()
    try:
        workflow_template = _platform_workflow_template_service().get_enabled_template(
            workflow_type,
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)

    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])
    run_id = uuid4().hex
    started_at = _now_iso()
    workflow_run_service = _platform_workflow_run_service()
    session_id = workflow_run_service.session_id(workflow_type, run_id)
    workflow_name = workflow_run_service.workflow_name(workflow_template, workflow_type)
    default_inputs = workflow_run_service.default_inputs(workflow_template)
    normalized_inputs = workflow_run_service.normalize_inputs(
        payload.inputs,
        default_inputs,
    )
    try:
        step_specs = workflow_run_service.build_step_specs(
            workflow_template,
            normalized_inputs,
            enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
            enterprise_tool_catalog=ENTERPRISE_TOOL_CATALOG,
        )
    except PlatformWorkflowRunServiceError as exc:
        _raise_platform_workflow_run_service_error(exc)
    approval_required_tools = workflow_run_service.approval_required_tools(
        step_specs,
        APPROVAL_REQUIRED_TOOLS,
    )

    approval_id = None
    if workflow_run_service.requires_approval(
        workflow_type,
        approval_required_tools,
        APPROVAL_REQUIRED_WORKFLOWS,
    ):
        approval_id = _require_platform_approval(
            approval_id=payload.approval_id,
            request_type="workflow_run",
            target_key="workflow_type",
            target_value=workflow_type,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            inputs=normalized_inputs,
        )

    steps: list[dict[str, Any]] = []
    tool_calls: list[dict[str, Any]] = []
    for step_id, title, tool_name, step_inputs in step_specs:
        if configured_tools is not None and tool_name not in configured_tools:
            decision = _platform_agent_service().tool_denial_payload(tool_name)
            step, tool_call = workflow_run_service.denied_step_record(
                step_id=step_id,
                title=title,
                tool_name=tool_name,
                inputs=step_inputs,
                decision=decision,
                tenant=tenant,
                user_id=user_id,
                connector=connector_label,
                connector_source=connector_source,
            )
        else:
            step, tool_call = _workflow_step(
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
                step_id=step_id,
                title=title,
                tool_name=tool_name,
                inputs=step_inputs,
            )
        steps.append(step)
        tool_calls.append(tool_call)

    finished_at = _now_iso()
    response = workflow_run_service.build_run_record(
        run_id=run_id,
        workflow_type=workflow_type,
        workflow_name=workflow_name,
        started_at=started_at,
        finished_at=finished_at,
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
        connector=connector_label,
        connector_source=connector_source,
        approval_id=approval_id,
        inputs=normalized_inputs,
        steps=steps,
        tool_calls=tool_calls,
        session_id=session_id,
    )
    workflow_run_service.append_run(response)
    return response


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "1") != "0",
    )
