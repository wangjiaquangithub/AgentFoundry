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
    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    tool_policy_service = _platform_tool_policy_service()
    runtime_selection = tool_policy_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    runtime_connector = runtime_selection["connector"]
    connector_label = runtime_selection["connector_label"]

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
        runtime = _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    tool_policy_service = _platform_tool_policy_service()
    runtime_selection = tool_policy_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    runtime_connector = runtime_selection["connector"]
    connector_label = runtime_selection["connector_label"]
    connector_source = runtime_selection["connector_source"]

    if tool_name not in ENTERPRISE_TOOL_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown enterprise tool: {tool_name}",
        )

    decision = tool_authorization_policy.authorize(tenant, user_id, tool_name)
    decision_payload = tool_policy_service.decision_payload(
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

    clean_inputs, call = tool_policy_service.build_connector_call(
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
    status_service = _platform_status_service()
    try:
        context = status_service.status_request_context(
            user_id=request.headers.get("X-User-ID"),
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)

    return status_service.platform_snapshot(
        platform_version=PLATFORM_VERSION,
        data_dir=DATA_DIR,
        runtime=context["runtime"],
        tenant=context["tenant"],
        user_id=context["user_id"],
        identities=context["identities"],
        tenant_workspaces=context["tenant_workspaces"],
        subagent_templates=ENTERPRISE_SUBAGENT_TEMPLATES,
    )


@app.get("/enterprise/platform/connectors")
async def enterprise_platform_connectors(request: Request) -> dict[str, Any]:
    """Return enterprise data source connector readiness and tenant scope."""
    try:
        connector_config_service = _platform_connector_config_service()
        return connector_config_service.platform_connectors_response(
            user_id=request.headers.get("X-User-ID"),
            connector_name=enterprise_connector.name,
            env=os.environ,
            identity_metadata=_platform_identity_metadata,
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


@app.get("/enterprise/platform/governance")
async def enterprise_platform_governance(request: Request) -> dict[str, Any]:
    """Return tenant, identity, approval, and audit governance state."""
    status_service = _platform_status_service()
    try:
        return status_service.governance_request_payload(
            user_id=request.headers.get("X-User-ID"),
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)


@app.get("/enterprise/platform/members")
async def enterprise_platform_members(request: Request) -> dict[str, Any]:
    """Return the editable enterprise member registry."""
    try:
        return _platform_member_service().registry_response_payload(
            user_id=request.headers.get("X-User-ID"),
            request_context=lambda user_id: _platform_status_service().status_request_context(
                user_id=user_id,
            ),
            registry_path=PLATFORM_MEMBERS_PATH,
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


@app.post("/enterprise/platform/members")
async def create_enterprise_platform_member(
    payload: EnterprisePlatformMemberUpsertRequest,
    request: Request,
) -> dict[str, Any]:
    """Create or replace one enterprise platform member."""
    try:
        return _platform_member_service().create_member_response_payload(
            payload=payload.model_dump(),
            actor=request.headers.get("X-User-ID"),
            identity_metadata=_platform_identity_metadata,
            registry_path=PLATFORM_MEMBERS_PATH,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


@app.patch("/enterprise/platform/members/{user_id:path}")
async def update_enterprise_platform_member(
    user_id: str,
    payload: EnterprisePlatformMemberPatchRequest,
    request: Request,
) -> dict[str, Any]:
    """Update one enterprise platform member."""
    try:
        return _platform_member_service().update_member_response_payload(
            user_id=user_id,
            payload=payload.model_dump(exclude_unset=True),
            actor=request.headers.get("X-User-ID"),
            identity_metadata=_platform_identity_metadata,
            registry_path=PLATFORM_MEMBERS_PATH,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


@app.delete("/enterprise/platform/members/{user_id:path}")
async def deactivate_enterprise_platform_member(
    user_id: str,
    request: Request,
) -> dict[str, Any]:
    """Soft-delete one enterprise platform member by marking it inactive."""
    try:
        return _platform_member_service().deactivate_member_response_payload(
            user_id=user_id,
            actor=request.headers.get("X-User-ID"),
            identity_metadata=_platform_identity_metadata,
            registry_path=PLATFORM_MEMBERS_PATH,
        )
    except PlatformMemberServiceError as exc:
        _raise_platform_member_service_error(exc)


@app.get("/enterprise/platform/policies/tools")
async def enterprise_platform_tool_policy(
    request: Request,
    user_id: str | None = None,
    tenant: str | None = None,
) -> dict[str, Any]:
    """Return editable enterprise tool authorization policy state."""
    try:
        return _platform_tool_policy_service().policy_request_payload(
            authorization_policy=tool_authorization_policy,
            query_user_id=user_id,
            header_user_id=request.headers.get("X-User-ID"),
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
        ) = _platform_tool_policy_service().update_user_policy_request_payload(
            payload.model_dump(),
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
    try:
        return _platform_connector_config_service().save_config_payload(
            payload,
            user_id=request.headers.get("X-User-ID"),
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

    connector_config_service = _platform_connector_config_service()
    actor = connector_config_service.import_actor(request.headers.get("X-User-ID"))
    try:
        mode, incoming = (
            connector_config_service.normalize_config_import_request(
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
    agent_service = _platform_agent_service()
    publish_request = agent_service.publish_request_payload(
        payload,
        header_user_id=request.headers.get("X-User-ID"),
    )
    user_id = publish_request["user_id"]
    await _validate_platform_agent_resources(
        request,
        user_id,
        **publish_request["resource_inputs"],
    )
    try:
        return agent_service.publish_agent_response_payload(payload, user_id)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)


@app.patch("/enterprise/platform/agents/{agent_id}")
async def update_enterprise_platform_agent(
    agent_id: str,
    payload: EnterpriseAgentUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update a tenant-scoped platform agent instance."""
    agent_service = _platform_agent_service()
    try:
        update_request = agent_service.update_request_payload(
            agent_id,
            payload,
            header_user_id=request.headers.get("X-User-ID"),
        )
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    user_id = update_request["user_id"]
    await _validate_platform_agent_resources(
        request,
        user_id,
        **update_request["resource_inputs"],
    )
    try:
        return agent_service.update_agent_response_payload(
            agent_id,
            payload,
            user_id,
        )
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)


@app.delete("/enterprise/platform/agents/{agent_id}")
async def archive_enterprise_platform_agent(
    agent_id: str,
) -> dict[str, Any]:
    """Archive a platform agent while keeping its registry record."""
    agent_service = _platform_agent_service()
    try:
        return agent_service.archive_agent_response_payload(agent_id)
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)


@app.get("/enterprise/platform/tools")
async def enterprise_platform_tools(
    request: Request,
    agent_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Return tool catalog metadata, authorization, bindings, and stats."""
    tool_policy_service = _platform_tool_policy_service()
    catalog_request = tool_policy_service.catalog_request_payload(
        query_user_id=user_id,
        header_user_id=request.headers.get("X-User-ID"),
        agent_id=agent_id,
    )
    resolved_user_id = catalog_request["user_id"]
    requested_agent_id = catalog_request["agent_id"]
    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(
            resolved_user_id
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    runtime_selection = tool_policy_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    try:
        published_agents = _platform_agent_service().list_published_agents()
    except PlatformAgentServiceError as exc:
        _raise_platform_agent_service_error(exc)
    configured_agent = None
    if requested_agent_id:
        try:
            configured_agent = _platform_agent_service().get_published_agent(
                requested_agent_id
            )
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
            tool_policy_service.catalog_tool_payload(
                tool_name=tool_name,
                catalog=catalog,
                decision=decision,
                events=events,
                published_agents=published_agents,
                configured_agent=configured_agent,
                configured_agent_tools=configured_agent_tools,
            ),
        )
    return tool_policy_service.catalog_response(
        tools=tools,
        user_id=resolved_user_id,
        tenant=tenant,
        runtime_selection=runtime_selection,
        agent_id=requested_agent_id,
    )


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
    return _platform_tool_policy_service().audit_log_response(
        events=events,
        filters={
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "success": success,
        },
        limit=normalized_limit,
    )


@app.post("/enterprise/platform/tools/run")
async def run_enterprise_tool(
    payload: EnterpriseToolRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run one tenant-aware enterprise tool from the platform console."""
    tool_policy_service = _platform_tool_policy_service()
    run_request = tool_policy_service.run_request_payload(
        tool_name=payload.tool_name,
        inputs=payload.inputs,
        payload_user_id=payload.user_id,
        header_user_id=request.headers.get("X-User-ID"),
        agent_id=payload.agent_id,
        approval_id=payload.approval_id,
    )
    user_id = run_request["user_id"]
    requested_tool_name = run_request["tool_name"]
    requested_inputs = run_request["inputs"]
    requested_agent_id = run_request["agent_id"]
    requested_approval_id = run_request["approval_id"]
    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    runtime_selection = tool_policy_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    runner_agent_id = "platform-console"
    if requested_agent_id:
        _, configured_tools = _published_platform_agent_tool_scope_for_user(
            requested_agent_id,
            user_id,
        )
        runner_agent_id = requested_agent_id
        if requested_tool_name not in configured_tools:
            try:
                runtime = _platform_connector_config_service().enterprise_runtime_context(
                    user_id
                )
            except PlatformConnectorConfigServiceError as exc:
                _raise_platform_connector_config_service_error(exc)
            runtime_selection = tool_policy_service.runtime_selection(runtime)
            decision = _platform_agent_service().tool_denial_payload(requested_tool_name)
            return tool_policy_service.agent_tool_denial_response(
                tool_name=requested_tool_name,
                tenant=tenant,
                user_id=user_id,
                runtime_selection=runtime_selection,
                decision=decision,
            )

    approval_id = None
    if requested_tool_name in APPROVAL_REQUIRED_TOOLS:
        approval_id = _require_platform_approval(
            approval_id=requested_approval_id,
            request_type="tool_run",
            target_key="tool_name",
            target_value=requested_tool_name,
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            inputs=requested_inputs,
        )

    response = _run_authorized_enterprise_tool(
        user_id=user_id,
        tool_name=requested_tool_name,
        inputs=requested_inputs,
        agent_id=runner_agent_id,
        session_id="platform-console",
    )
    return tool_policy_service.tool_run_response(
        response,
        approval_id=approval_id,
    )


@app.post("/enterprise/platform/agent/run")
async def run_enterprise_agent(
    payload: EnterpriseAgentRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Route a business question through a published enterprise agent."""

    agent_run_service = _platform_agent_run_service()
    run_request = agent_run_service.run_request_payload(
        question=payload.question,
        payload_user_id=payload.user_id,
        header_user_id=request.headers.get("X-User-ID"),
        agent_id=payload.agent_id,
        session_id=payload.session_id,
        approval_id=payload.approval_id,
    )
    user_id = run_request["user_id"]
    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    agent = None
    if run_request["agent_id"]:
        agent, _ = _published_platform_agent_tool_scope_for_user(
            run_request["agent_id"],
            user_id,
        )

    agent_metadata = _platform_agent_service().run_metadata(agent)
    runtime_adapter = get_runtime_adapter(agent_metadata)
    runtime_adapter_payload = runtime_adapter.describe(agent_metadata)
    execution_context = agent_run_service.build_execution_context(
        run_request=run_request,
        agent=agent,
        agent_metadata=agent_metadata,
        runtime=runtime,
        runtime_adapter=runtime_adapter_payload,
        default_tool_names=set(ENTERPRISE_TOOL_NAMES),
        safe_path_part=_safe_path_part,
    )
    tenant = execution_context["tenant"]
    connector_label = execution_context["connector_label"]
    connector_source = execution_context["connector_source"]
    question = execution_context["question"]
    configured_tools = execution_context["configured_tools"]
    runner_agent_id = execution_context["runner_agent_id"]
    runner_session_id = execution_context["runner_session_id"]
    response_record_context = execution_context["response_record_context"]
    knowledge_base_ids = execution_context["knowledge_base_ids"]
    memory_payload = platform_memory_service.build_agent_run_context(
        enabled=bool(agent_metadata.get("memory_enabled", False)),
        tenant=tenant,
        user_id=user_id,
        agent_id=runner_agent_id,
        question=question,
        max_records=PLATFORM_MEMORY_MAX_RECORDS,
        limit=PLATFORM_MEMORY_SEARCH_LIMIT,
    )
    memory_context = agent_run_service.build_memory_context(
        memory_payload=memory_payload,
        memory_state=platform_memory_service.agent_run_state(memory_payload),
    )
    memory_payload = memory_context["memory_payload"]
    memory_enabled = memory_context["memory_enabled"]
    memory_hits = memory_context["memory_hits"]
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
            knowledge_base_ids=knowledge_base_ids,
        )
    )
    knowledge_payload = knowledge_response_service.build_agent_run_payload(
        knowledge_hits=knowledge_hits,
        knowledge_error=knowledge_error,
    )
    knowledge_context = agent_run_service.build_knowledge_context(
        knowledge_hits=knowledge_hits,
        knowledge_error=knowledge_error,
        knowledge_payload=knowledge_payload,
    )
    knowledge_hits = knowledge_context["knowledge_hits"]
    knowledge_error = knowledge_context["knowledge_error"]
    knowledge_payload = knowledge_context["knowledge_payload"]
    routes, routing_error = await enterprise_router_service.select_routes_for_question(
        question,
        env=os.environ,
    )
    routing_context = agent_run_service.build_routing_context(
        routing_state=enterprise_router_service.routing_state_for(routes),
        routing_error=routing_error,
    )
    routing_mode = routing_context["routing_mode"]
    routing_source = routing_context["routing_source"]
    routing_error = routing_context["routing_error"]

    if not routes:
        decision = enterprise_router_service.unrouted_decision_for_question(
            question,
            routing_source=routing_source,
            routing_mode=routing_mode,
            routing_error=routing_error,
        )
        answer = agent_run_service.compose_unrouted_answer(
            **agent_run_service.build_unrouted_answer_context(
                knowledge_hits=knowledge_hits,
                memory_hits=memory_hits,
                format_knowledge_answer=knowledge_response_service.format_answer,
                format_memory_answer=platform_memory_service.format_answer,
            ),
        )
        memory_saved = platform_memory_service.append_agent_turn_if_enabled(
            **agent_run_service.build_unrouted_memory_append_context(
                execution_context=execution_context,
                memory_context=memory_context,
                user_id=user_id,
                answer=answer,
                max_records=PLATFORM_MEMORY_MAX_RECORDS,
            ),
        )

        unrouted_finalize_context = agent_run_service.build_unrouted_finalize_context(
            response_record_context=response_record_context,
            answer=answer,
            session_id=runner_session_id,
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            connector=connector_label,
            connector_source=connector_source,
            routing_mode=routing_mode,
            routing_source=routing_source,
            routing_error=routing_error,
            agent_metadata=agent_metadata,
            runtime_adapter=runtime_adapter_payload,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            knowledge_payload=knowledge_payload,
            memory_payload=memory_payload,
            memory_saved=memory_saved,
            decision=decision,
        )
        response = agent_run_service.finalize_unrouted_response(
            **unrouted_finalize_context,
        )
        return response

    tool_calls: list[dict[str, Any]] = []
    for route in routes:
        route_context = agent_run_service.normalize_route_context(
            route,
            default_source=ROUTING_SOURCE_RULES,
        )
        tool_name = route_context["tool_name"]
        route_inputs = route_context["inputs"]
        route_reason = route_context["reason"]
        route_source = route_context["source"]

        if not agent_run_service.is_configured_tool(
            tool_name=tool_name,
            configured_tools=configured_tools,
        ):
            denial = _platform_agent_service().tool_denial_payload(tool_name)
            answer = agent_run_service.denied_tool_answer(denial)
            decision = enterprise_router_service.decision_with_routing_context(
                **agent_run_service.build_denied_route_decision_context(
                    denial=denial,
                    routing_reason=route_reason,
                    routing_source=route_source,
                    routing_mode=routing_mode,
                    routing_error=routing_error,
                ),
            )

            tool_calls.append(
                agent_run_service.build_denied_routed_tool_call(
                    **agent_run_service.build_denied_routed_tool_call_context(
                        tool_name=tool_name,
                        inputs=route_inputs,
                        tenant=tenant,
                        user_id=user_id,
                        connector=connector_label,
                        connector_source=connector_source,
                        routing_source=route_source,
                        routing_reason=route_reason,
                        decision=decision,
                        answer=answer,
                    ),
                ),
            )
            continue

        approved_by: str | None = None
        if agent_run_service.requires_tool_approval(
            tool_name=tool_name,
            approval_required_tools=APPROVAL_REQUIRED_TOOLS,
        ):
            try:
                approved_by = _require_platform_approval(
                    **agent_run_service.build_tool_approval_requirement_context(
                        approval_id=run_request["approval_id"],
                        tool_name=tool_name,
                        tenant=tenant,
                        user_id=user_id,
                        agent_id=runner_agent_id,
                        inputs=route_inputs,
                    ),
                )
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, dict) else {}
                if not agent_run_service.is_approval_required_exception(
                    status_code=exc.status_code,
                    detail=detail,
                ):
                    raise

                try:
                    approval = _platform_approval_service().create_request(
                        **agent_run_service.build_approval_request_payload(
                            detail=detail,
                            tenant=tenant,
                            user_id=user_id,
                            agent_id=runner_agent_id,
                            tool_name=tool_name,
                            inputs=route_inputs,
                            requested_by=agent_run_service.resolve_requested_by(
                                headers=request.headers,
                                user_id=user_id,
                            ),
                        ),
                    )
                except PlatformApprovalServiceError as service_exc:
                    _raise_platform_approval_service_error(service_exc)
                approval_id = agent_run_service.resolve_approval_id(approval)
                pending_approval_context = (
                    agent_run_service.build_pending_approval_response_context(
                        detail=detail,
                        approval_id=approval_id,
                    )
                )
                decision = enterprise_router_service.decision_with_routing_context(
                    **agent_run_service.build_pending_approval_route_decision_context(
                        pending_approval_context=pending_approval_context,
                        routing_reason=route_reason,
                        routing_source=route_source,
                        routing_mode=routing_mode,
                        routing_error=routing_error,
                    ),
                )
                tool_calls.append(
                    agent_run_service.build_pending_approval_routed_tool_call(
                        **agent_run_service.build_pending_approval_routed_tool_call_context(
                            tool_name=tool_name,
                            inputs=route_inputs,
                            approval_id=approval_id,
                            tenant=tenant,
                            user_id=user_id,
                            connector=connector_label,
                            connector_source=connector_source,
                            routing_source=route_source,
                            routing_reason=route_reason,
                            decision=decision,
                            answer=agent_run_service.pending_approval_message(
                                pending_approval_context,
                            ),
                        ),
                    ),
                )
                continue

        tool_response = _run_authorized_enterprise_tool(
            **agent_run_service.build_tool_execution_request_context(
                user_id=user_id,
                tool_name=tool_name,
                inputs=route_inputs,
                agent_id=runner_agent_id,
                session_id=runner_session_id,
                fail_on_denied=False,
            ),
        )
        decision = enterprise_router_service.decision_with_routing_context(
            **agent_run_service.build_executed_tool_route_decision_context(
                tool_response=tool_response,
                routing_reason=route_reason,
                routing_source=route_source,
                routing_mode=routing_mode,
                routing_error=routing_error,
            ),
        )
        call_answer = _platform_tool_policy_service().format_tool_result_answer(
            **agent_run_service.build_executed_tool_answer_context(
                tool_name=tool_name,
                tool_response=tool_response,
            ),
        )
        executed_tool_call_context = (
            agent_run_service.build_executed_routed_tool_call_context(
                tool_name=tool_name,
                inputs=route_inputs,
                tool_response=tool_response,
                connector=connector_label,
                connector_source=connector_source,
                routing_source=route_source,
                routing_reason=route_reason,
                approval_id=approved_by,
                decision=decision,
                answer=call_answer,
            )
        )
        tool_calls.append(
            agent_run_service.build_executed_routed_tool_call(
                **executed_tool_call_context,
            ),
        )

    routed_summary_context = agent_run_service.build_routed_summary_context(
        tool_calls=tool_calls,
    )
    answer = agent_run_service.compose_routed_answer(
        **agent_run_service.build_routed_answer_context(
            tool_calls=tool_calls,
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            format_knowledge_answer=knowledge_response_service.format_answer,
            format_memory_answer=platform_memory_service.format_answer,
        ),
    )
    memory_saved = platform_memory_service.append_agent_turn_if_enabled(
        **agent_run_service.build_routed_memory_append_context(
            execution_context=execution_context,
            memory_context=memory_context,
            user_id=user_id,
            answer=answer,
            tool_calls=tool_calls,
            max_records=PLATFORM_MEMORY_MAX_RECORDS,
        ),
    )

    routed_finalize_context = agent_run_service.build_routed_finalize_context(
        routed_summary_context=routed_summary_context,
        response_record_context=response_record_context,
        answer=answer,
        session_id=runner_session_id,
        tenant=tenant,
        user_id=user_id,
        agent_id=runner_agent_id,
        connector=connector_label,
        connector_source=connector_source,
        routing_mode=routing_mode,
        routing_source=routing_source,
        routing_error=routing_error,
        agent_metadata=agent_metadata,
        runtime_adapter=runtime_adapter_payload,
        tool_calls=tool_calls,
        knowledge_hits=knowledge_hits,
        memory_hits=memory_hits,
        knowledge_payload=knowledge_payload,
        memory_payload=memory_payload,
        memory_saved=memory_saved,
    )
    response = agent_run_service.finalize_routed_response(
        **routed_finalize_context,
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
    agent_run_service = _platform_agent_run_service()
    list_context = agent_run_service.list_runs_request_payload(
        limit=limit,
        agent_id=agent_id,
        tenant=tenant,
        user_id=user_id,
        session_id=session_id,
    )
    return agent_run_service.list_runs(**list_context)


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
    agent_run_service = _platform_agent_run_service()
    clear_context = agent_run_service.clear_runs_request_payload(
        agent_id=agent_id,
        tenant=tenant,
        user_id=user_id,
        session_id=session_id,
    )
    try:
        return agent_run_service.clear_runs(**clear_context)
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
        workflow_run_service = _platform_workflow_run_service()
        allowed = workflow_run_service.tool_response_allowed(tool_response)
        decision = workflow_run_service.tool_response_decision(tool_response)
        message = (
            _platform_tool_policy_service().format_tool_result_answer(
                **workflow_run_service.build_tool_result_answer_context(
                    tool_name=tool_name,
                    tool_response=tool_response,
                ),
            )
            if allowed
            else str((decision or {}).get("reason") or "当前用户无权调用该工具。")
        )
        return workflow_run_service.executed_step_record(
            step_id=step_id,
            title=title,
            tool_name=tool_name,
            inputs=inputs,
            tool_response=tool_response,
            message=message,
        )
    except HTTPException as exc:
        workflow_run_service = _platform_workflow_run_service()
        decision = workflow_run_service.error_detail_decision(exc.detail)
        message = workflow_run_service.error_detail_message(exc.detail)
    except Exception as exc:  # pragma: no cover - defensive platform boundary.
        workflow_run_service = _platform_workflow_run_service()
        decision = None
        message = f"{exc.__class__.__name__}: {exc}"

    return workflow_run_service.failed_step_record(
        step_id=step_id,
        title=title,
        tool_name=tool_name,
        inputs=inputs,
        decision=decision,
        message=message,
    )


@app.get("/enterprise/platform/workflows")
async def list_enterprise_workflows() -> dict[str, Any]:
    """List platform-managed workflow templates."""
    try:
        return _platform_workflow_template_service().list_templates_response()
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)


@app.get("/enterprise/platform/scenarios")
async def list_enterprise_platform_scenarios() -> dict[str, Any]:
    """List business scenarios backed by platform-managed workflows."""
    return _enterprise_platform_scenarios()


@app.get("/enterprise/platform/ops/tasks")
async def enterprise_platform_ops_tasks(request: Request) -> dict[str, Any]:
    """List open operator tasks for the current enterprise platform tenant."""
    status_service = _platform_status_service()
    try:
        request_context = status_service.status_request_context(
            user_id=request.headers.get("X-User-ID"),
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    return status_service.ops_tasks(
        tenant=request_context["tenant"],
        user_id=request_context["user_id"],
        identities=request_context["identities"],
    )


@app.post("/enterprise/platform/ops/tasks/{task_code}/resolve")
async def resolve_enterprise_platform_ops_task(
    task_code: str,
    request: Request,
) -> dict[str, Any]:
    """Resolve deterministic platform operations tasks from the console."""
    status_service = _platform_status_service()
    try:
        resolve_context = status_service.resolve_ops_task_context(
            task_code=task_code,
            actor=request.headers.get("X-User-ID"),
            user_id=request.headers.get("X-User-ID"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        (
            enabled_workflows,
            workflows,
        ) = _platform_workflow_template_service().enable_disabled_templates(
            actor=resolve_context["actor"],
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)

    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(
            resolve_context["user_id"],
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    runtime_selection = status_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    identities = _platform_identity_metadata(resolve_context["user_id"], tenant)
    return status_service.resolved_disabled_workflows_payload(
        task_code=resolve_context["task_code"],
        enabled_workflows=enabled_workflows,
        workflows=workflows,
        tenant=tenant,
        user_id=resolve_context["user_id"],
        identities=identities,
    )


@app.patch("/enterprise/platform/workflows/{workflow_type}")
async def update_enterprise_workflow(
    workflow_type: str,
    payload: EnterpriseWorkflowTemplateUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update mutable workflow template metadata from the platform console."""
    workflow_service = _platform_workflow_template_service()
    update_context = workflow_service.update_template_context(
        workflow_type=workflow_type,
        actor=request.headers.get("X-User-ID"),
    )
    try:
        workflow, workflows = workflow_service.update_template(
            workflow_type=update_context["workflow_type"],
            payload=payload,
            actor=update_context["actor"],
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)
    return workflow_service.update_template_response(
        workflow=workflow,
        workflows=workflows,
    )


@app.get("/enterprise/platform/workflows/runs")
async def list_enterprise_workflow_runs(
    workflow_type: str | None = None,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform workflow runs for review and audit."""
    workflow_run_service = _platform_workflow_run_service()
    list_context = workflow_run_service.list_runs_request_payload(
        workflow_type=workflow_type,
        agent_id=agent_id,
        tenant=tenant,
        user_id=user_id,
        limit=limit,
    )
    return workflow_run_service.list_runs(**list_context)


@app.get("/enterprise/platform/approvals")
async def list_enterprise_approval_requests(
    status: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform governance approval requests."""
    approval_service = _platform_approval_service()
    list_context = approval_service.list_requests_request_payload(
        status=status,
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
        limit=limit,
    )
    try:
        return approval_service.list_requests(**list_context)
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)


@app.post("/enterprise/platform/approvals")
async def create_enterprise_approval_request(
    payload: EnterpriseApprovalCreateRequest,
    request: Request,
) -> dict[str, Any]:
    """Create a pending approval request for a high-risk platform action."""
    approval_service = _platform_approval_service()
    create_context = approval_service.build_create_request_context(
        payload=payload,
        actor=request.headers.get("X-User-ID"),
    )
    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(
            create_context["user_id"],
        )
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    runtime_selection = _platform_status_service().runtime_selection(runtime)
    request_payload = approval_service.build_create_request_payload(
        payload=payload,
        tenant=runtime_selection["tenant"],
        user_id=create_context["user_id"],
        requested_by=create_context["requested_by"],
    )
    tool_name = request_payload["tool_name"]
    workflow_type = request_payload["workflow_type"]
    if tool_name and tool_name not in ENTERPRISE_TOOL_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown enterprise tool: {tool_name}")
    if workflow_type:
        try:
            _platform_workflow_template_service().get_template(workflow_type)
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_platform_workflow_template_service_error(exc)

    try:
        record = approval_service.create_request(
            **request_payload,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return approval_service.create_response(record)


@app.post("/enterprise/platform/approvals/{approval_id}/approve")
async def approve_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Approve a pending platform governance request."""
    approval_service = _platform_approval_service()
    decision_payload = approval_service.build_decision_payload(
        payload=payload,
        actor=request.headers.get("X-User-ID"),
    )
    try:
        approval = approval_service.update_status(
            approval_id=approval_id,
            status="approved",
            **decision_payload,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return approval_service.decision_response(approval)


@app.post("/enterprise/platform/approvals/{approval_id}/reject")
async def reject_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Reject a pending platform governance request."""
    approval_service = _platform_approval_service()
    decision_payload = approval_service.build_decision_payload(
        payload=payload,
        actor=request.headers.get("X-User-ID"),
    )
    try:
        approval = approval_service.update_status(
            approval_id=approval_id,
            status="rejected",
            **decision_payload,
        )
    except PlatformApprovalServiceError as exc:
        _raise_platform_approval_service_error(exc)
    return approval_service.decision_response(approval)


@app.post("/enterprise/platform/workflows/run")
async def run_enterprise_workflow(
    payload: EnterpriseWorkflowRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run a predefined enterprise automation workflow from the platform."""
    workflow_run_service = _platform_workflow_run_service()
    run_request = workflow_run_service.build_run_request_payload(
        payload=payload,
        actor=request.headers.get("X-User-ID"),
    )
    user_id = run_request["user_id"]
    requested_agent_id = run_request["requested_agent_id"]
    agent_id = run_request["agent_id"]
    configured_tools: set[str] | None = None
    if requested_agent_id:
        _, configured_tools = _published_platform_agent_tool_scope_for_user(
            requested_agent_id,
            user_id,
        )

    workflow_type = run_request["workflow_type"]
    try:
        workflow_template = _platform_workflow_template_service().get_enabled_template(
            workflow_type,
        )
    except PlatformWorkflowTemplateServiceError as exc:
        _raise_platform_workflow_template_service_error(exc)

    try:
        runtime = _platform_connector_config_service().enterprise_runtime_context(user_id)
    except PlatformConnectorConfigServiceError as exc:
        _raise_platform_connector_config_service_error(exc)
    status_service = _platform_status_service()
    runtime_selection = status_service.runtime_selection(runtime)
    tenant = runtime_selection["tenant"]
    connector_label = runtime_selection["connector_label"]
    connector_source = runtime_selection["connector_source"]
    execution_context = workflow_run_service.build_execution_context(
        workflow_type=workflow_type,
        workflow_template=workflow_template,
        inputs=run_request["inputs"],
        run_id=uuid4().hex,
        started_at=_now_iso(),
    )
    session_id = execution_context["session_id"]
    normalized_inputs = execution_context["normalized_inputs"]
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
            **workflow_run_service.build_approval_request_context(
                approval_id=run_request["approval_id"],
                workflow_type=workflow_type,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                inputs=normalized_inputs,
            ),
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
        **workflow_run_service.build_run_record_context(
            workflow_type=workflow_type,
            execution_context=execution_context,
            finished_at=finished_at,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            connector=connector_label,
            connector_source=connector_source,
            approval_id=approval_id,
            steps=steps,
            tool_calls=tool_calls,
        ),
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
