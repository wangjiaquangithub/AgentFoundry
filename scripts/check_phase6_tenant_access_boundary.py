#!/usr/bin/env python3
"""Validate phase 6 tenant access boundaries for platform agents."""

from __future__ import annotations

from pathlib import Path
import sys
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from repositories.agents import (  # noqa: E402
    AgentRegistryError,
    PostgresAgentCatalogWriteThroughRepository,
)
from services.agents import PlatformAgentService, PlatformAgentServiceError  # noqa: E402
from services.members import PlatformMemberService, PlatformMemberServiceError  # noqa: E402
from services.platform_status import PlatformStatusService  # noqa: E402


IDENTITIES = [
    {
        "user_id": "acme:alice",
        "tenant": "acme",
        "role": "admin",
        "status": "active",
    },
    {
        "user_id": "acme:bob",
        "tenant": "acme",
        "role": "member",
        "status": "active",
    },
    {
        "user_id": "globex:bob",
        "tenant": "globex",
        "role": "admin",
        "status": "active",
    },
]


class Agents:
    supports_unscoped_reads = True

    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._records = [dict(record) for record in records]

    def list(self, *, tenant: str | None = None) -> list[dict[str, Any]]:
        return [
            dict(record)
            for record in self._records
            if tenant is None or str(record.get("tenant") or "").strip() == tenant
        ]

    def get(
        self,
        agent_id: str,
        *,
        tenant: str | None = None,
    ) -> dict[str, Any] | None:
        return next(
            (
                dict(record)
                for record in self._records
                if record.get("id") == agent_id
                and (
                    tenant is None
                    or str(record.get("tenant") or "").strip() == tenant
                )
            ),
            None,
        )

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        self._records = [dict(agent) for agent in agents]

    def save_tenant_agents(self, *, tenant: str, agents: list[dict[str, Any]]) -> None:
        retained_agents = [
            record
            for record in self._records
            if str(record.get("tenant") or "").strip() != tenant
        ]
        self._records = [*retained_agents, *[dict(agent) for agent in agents]]


class Members:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._config = {"members": [dict(record) for record in records]}

    def load_config(self) -> dict[str, Any]:
        return {
            "members": [dict(record) for record in self._config["members"]],
        }

    def save_config(self, config: dict[str, Any]) -> None:
        self._config = {
            "members": [dict(record) for record in config.get("members", [])],
        }


def build_agent(agent_id: str, tenant: str, **overrides: Any) -> dict[str, Any]:
    agent = {
        "id": agent_id,
        "template_id": "knowledge-assistant",
        "name": f"{tenant} Knowledge Assistant",
        "description": "Answers with enterprise knowledge.",
        "tenant": tenant,
        "tools": ["enterprise_search"],
        "knowledge_base_ids": ["kb_support"],
        "model_config_id": "model_primary",
        "memory_enabled": True,
        "workflow_enabled": True,
        "allowed_user_ids": [],
        "allowed_roles": [],
        "capabilities": ["knowledge"],
        "status": "published",
        "created_by": f"{tenant}:system",
        "created_at": "2026-07-22T00:00:00+00:00",
        "updated_at": "2026-07-22T00:00:00+00:00",
    }
    agent.update(overrides)
    return agent


def tenant_for_user(user_id: str) -> str:
    return user_id.split(":", 1)[0]


def identity_metadata(_user_id: str, tenant: str) -> list[dict[str, Any]]:
    return [dict(identity) for identity in IDENTITIES if identity["tenant"] == tenant]


def member_for_user(user_id: str) -> dict[str, Any] | None:
    return next(
        (dict(identity) for identity in IDENTITIES if identity["user_id"] == user_id),
        None,
    )


def role_for_user(user_id: str) -> str:
    member = member_for_user(user_id)
    return str(member.get("role") or "") if member is not None else ""


def build_service() -> PlatformAgentService:
    return PlatformAgentService(
        repository=Agents(
            [
                build_agent("agent_acme", "acme"),
                build_agent("agent_globex", "globex"),
            ],
        ),
        templates=[
            {
                "id": "knowledge-assistant",
                "name": "Knowledge Assistant",
                "description": "Answers with enterprise knowledge.",
                "tools": ["enterprise_search"],
                "capabilities": ["knowledge"],
            },
        ],
        approval_required_tools=set(),
        tenant_for_user=tenant_for_user,
        tenant_hint_from_user_id=lambda user_id: tenant_for_user(user_id),
        identity_metadata=identity_metadata,
        member_for_user=member_for_user,
        role_for_user=role_for_user,
    )


def assert_error_status(
    expected_status: int,
    fn: Any,
    *args: Any,
    **kwargs: Any,
) -> PlatformAgentServiceError:
    try:
        fn(*args, **kwargs)
    except PlatformAgentServiceError as exc:
        if exc.status_code != expected_status:
            raise AssertionError(
                f"Expected status {expected_status}, got {exc.status_code}: {exc.detail}",
            ) from exc
        return exc
    raise AssertionError(f"Expected PlatformAgentServiceError {expected_status}.")


def assert_agent_list_is_tenant_scoped() -> None:
    service = build_service()

    acme_agents = service.list_agents_for_user("acme:alice")
    globex_agents = service.list_agents_for_user("globex:bob")

    assert [agent["id"] for agent in acme_agents] == ["agent_acme"]
    assert [agent["id"] for agent in globex_agents] == ["agent_globex"]

    registry = service.registry_response_for_user("acme:alice")
    assert [agent["id"] for agent in registry["agents"]] == ["agent_acme"]


def assert_cross_tenant_runtime_access_is_denied() -> None:
    service = build_service()

    exc = assert_error_status(
        403,
        service.published_tool_scope_access_context,
        "agent_acme",
        user_id="globex:bob",
    )
    assert "不属于该 Agent 租户" in str(exc.detail)


def assert_access_scope_rejects_other_tenant_users() -> None:
    service = build_service()

    exc = assert_error_status(
        400,
        service.create_agent,
        SimpleNamespace(
            template_id="knowledge-assistant",
            tenant="acme",
            name="Scoped Assistant",
            description="",
            tools=["enterprise_search"],
            model_config_id="model_primary",
            knowledge_base_ids=["kb_support"],
            memory_enabled=True,
            workflow_enabled=True,
            allowed_user_ids=["globex:bob"],
            allowed_roles=[],
        ),
        "acme:alice",
    )
    assert isinstance(exc.detail, dict)
    assert exc.detail["tenant_mismatched_user_ids"] == ["globex:bob"]


def assert_pg_agent_catalog_requires_tenant_scope() -> None:
    repository = PostgresAgentCatalogWriteThroughRepository(
        postgres_reader=SimpleNamespace(
            list_agents=lambda **_kwargs: [],
            get_agent=lambda **_kwargs: None,
            get_current_version=lambda **_kwargs: None,
        ),
        postgres_writer=SimpleNamespace(save_agents=lambda _agents: []),
    )

    assert repository.supports_unscoped_reads is False
    for method_name, args in (("list", {}), ("get", {"agent_id": "agent_acme"})):
        try:
            getattr(repository, method_name)(**args)
        except AgentRegistryError as exc:
            assert "tenant scope" in str(exc)
        else:
            raise AssertionError(f"PostgreSQL {method_name} allowed unscoped reads.")


def assert_knowledge_api_rejects_tenant_mismatch() -> None:
    source = (BACKEND_DIR / "api" / "knowledge.py").read_text(encoding="utf-8")
    required_fragments = (
        "explicit_tenant and hinted_tenant",
        "explicit_tenant != hinted_tenant",
        "status_code=403",
        "tenant does not match X-User-ID tenant boundary",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in source
    ]
    if missing_fragments:
        raise AssertionError(
            "Knowledge API tenant mismatch guard is incomplete: "
            + ", ".join(missing_fragments),
        )


def assert_agent_run_history_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "agent_runtime.py").read_text(
        encoding="utf-8",
    )
    required_fragments = (
        "identity_tenant = (identity.tenant_id or \"\").strip()",
        "request_tenant = identity_tenant or hinted_tenant",
        "explicit_tenant and explicit_tenant != request_tenant",
        "tenant does not match request identity tenant boundary",
        "tenant=tenant_id",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in source
    ]
    if missing_fragments:
        raise AssertionError(
            "Agent run history tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )

    history_routes = source[source.index(
        '@router.get("/enterprise/platform/agent/runs")'
    ):]
    if history_routes.count("_request_tenant(") != 3:
        raise AssertionError(
            "All three Agent run history routes must resolve the request tenant.",
        )


def assert_tool_audit_history_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "tools.py").read_text(encoding="utf-8")
    required_fragments = (
        "identity_tenant = (identity.tenant_id or \"\").strip()",
        "request_tenant = identity_tenant or hinted_tenant",
        "explicit_tenant and explicit_tenant != request_tenant",
        "tenant does not match request identity tenant boundary",
        "tenant=tenant_id",
        '"tenant": tenant_id',
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in source
    ]
    if missing_fragments:
        raise AssertionError(
            "Tool audit history tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )

    audit_route = source[source.index(
        '@router.get("/enterprise/platform/audit")'
    ):source.index('@router.post("/enterprise/platform/tools/run")')]
    if audit_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Tool audit history must resolve the canonical request tenant.",
        )


def assert_workflow_run_history_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "workflows.py").read_text(encoding="utf-8")
    required_fragments = (
        "identity_tenant = (identity.tenant_id or \"\").strip()",
        "request_tenant = identity_tenant or hinted_tenant",
        "explicit_tenant and explicit_tenant != request_tenant",
        "tenant does not match request identity tenant boundary",
        "tenant=tenant_id",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in source
    ]
    if missing_fragments:
        raise AssertionError(
            "Workflow run history tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )

    workflow_run_route = source[source.index(
        '@router.get("/enterprise/platform/workflows/runs")'
    ):source.index('@router.get("/enterprise/platform/approvals")')]
    if workflow_run_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Workflow run history must resolve the canonical request tenant.",
        )


def assert_approval_history_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "workflows.py").read_text(encoding="utf-8")
    approval_route = source[source.index(
        '@router.get("/enterprise/platform/approvals")'
    ):source.index('@router.post("/enterprise/platform/approvals")')]
    required_fragments = (
        "request: Request",
        "tenant_id = _request_tenant(",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "tenant=tenant_id",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in approval_route
    ]
    if missing_fragments:
        raise AssertionError(
            "Approval history tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )
    if approval_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Approval history must resolve the canonical request tenant.",
        )


def assert_tool_policy_query_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    required_fragments = (
        'identity_tenant = (identity_tenant_id or "").strip()',
        "request_tenant = identity_tenant or hinted_tenant",
        "explicit_tenant and explicit_tenant != request_tenant",
        "tenant does not match request identity tenant boundary",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "tenant=tenant_id",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in source
    ]
    if missing_fragments:
        raise AssertionError(
            "Tool policy query tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )

    policy_route = source[source.index(
        '@router.get("/enterprise/platform/policies/tools")'
    ):source.index('@router.patch("/enterprise/platform/policies/tools")')]
    route_fragments = (
        "query_user_id = _request_user_id(",
        "identity_user_id=identity.user_id",
        "tenant=tenant_id",
        "user_id=user_id",
        "query_user_id=query_user_id",
    )
    missing_route_fragments = [
        fragment for fragment in route_fragments if fragment not in policy_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Tool policy query user boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if policy_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Tool policy query must resolve the canonical request tenant.",
        )
    if policy_route.count("_request_user_id(") != 1:
        raise AssertionError(
            "Tool policy query must resolve a tenant-scoped request user.",
        )

    helper_source = source[source.index("def _request_user_id("):source.index(
        "def create_platform_admin_router("
    )]
    helper_fragments = (
        "user_tenant = tenant_hint_from_user_id(request_user_id)",
        "requested user does not resolve to a tenant",
        "user_tenant != tenant",
        "status_code=403",
        "requested user does not match request identity tenant boundary",
    )
    missing_helper_fragments = [
        fragment for fragment in helper_fragments if fragment not in helper_source
    ]
    if missing_helper_fragments:
        raise AssertionError(
            "Tool policy request user tenant validation is incomplete: "
            + ", ".join(missing_helper_fragments),
        )


def assert_tool_policy_update_uses_request_tenant() -> None:
    source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    update_route = source[source.index(
        '@router.patch("/enterprise/platform/policies/tools")'
    ):source.index('@router.get("/enterprise/platform/connectors/configs")')]
    required_fragments = (
        "tenant_id = _request_tenant(",
        "tenant=payload.tenant",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        'update_payload["tenant"] = tenant_id',
        "update_user_policy_request_payload(\n                update_payload,",
        "actor_user_id=identity.user_id",
    )
    missing_fragments = [
        fragment for fragment in required_fragments if fragment not in update_route
    ]
    if missing_fragments:
        raise AssertionError(
            "Tool policy update tenant boundary is incomplete: "
            + ", ".join(missing_fragments),
        )
    if update_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Tool policy update must resolve the canonical request tenant.",
        )


def assert_connector_config_query_uses_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    query_route = api_source[api_source.index(
        '@router.get("/enterprise/platform/connectors/configs")'
    ):api_source.index('@router.post("/enterprise/platform/connectors/configs")')]
    required_route_fragments = (
        "request: Request",
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=None",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "list_configs_response(\n                tenant=tenant_id,",
    )
    missing_route_fragments = [
        fragment for fragment in required_route_fragments if fragment not in query_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Connector config query tenant boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if query_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Connector config query must resolve the canonical request tenant.",
        )

    service_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    response_method = service_source[service_source.index(
        "def list_configs_response("
    ):service_source.index("@staticmethod", service_source.index(
        "def list_configs_response("
    ))]
    required_service_fragments = (
        "*, tenant: str",
        "self.redacted_configs(tenant=tenant)",
    )
    missing_service_fragments = [
        fragment
        for fragment in required_service_fragments
        if fragment not in response_method
    ]
    if missing_service_fragments:
        raise AssertionError(
            "Connector config service query scope is incomplete: "
            + ", ".join(missing_service_fragments),
        )


def assert_connector_config_update_uses_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    update_route = api_source[api_source.index(
        '@router.post("/enterprise/platform/connectors/configs")'
    ):api_source.index('@router.post("/enterprise/platform/connectors/test")')]
    required_route_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=payload.tenant",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "user_id=identity.user_id",
        "tenant=tenant_id",
    )
    missing_route_fragments = [
        fragment for fragment in required_route_fragments if fragment not in update_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Connector config update tenant boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if update_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Connector config update must resolve the canonical request tenant.",
        )

    service_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    save_method = service_source[service_source.index(
        "def save_config_payload("
    ):service_source.index("def normalize_import_configs(", service_source.index(
        "def save_config_payload("
    ))]
    required_service_fragments = (
        "tenant: str",
        "tenant=tenant",
        "existing_config=configs.get(tenant)",
        '"saved_configs": self.redacted_configs(tenant=tenant)',
    )
    missing_service_fragments = [
        fragment for fragment in required_service_fragments if fragment not in save_method
    ]
    if missing_service_fragments:
        raise AssertionError(
            "Connector config service update scope is incomplete: "
            + ", ".join(missing_service_fragments),
        )


def assert_connector_test_uses_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    test_route = api_source[api_source.index(
        '@router.post("/enterprise/platform/connectors/test")'
    ):api_source.index('@router.get("/enterprise/platform/config/export")')]
    required_route_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=payload.tenant",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "tenant=tenant_id",
    )
    missing_route_fragments = [
        fragment for fragment in required_route_fragments if fragment not in test_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Connector test tenant boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if test_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Connector test must resolve the canonical request tenant.",
        )

    service_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    test_method = service_source[service_source.index(
        "def test_connector("
    ):service_source.index(
        "def _append_connector_config_audit_event(",
        service_source.index("def test_connector("),
    )]
    required_service_fragments = (
        "*, tenant: str",
        "self.list_configs().get(tenant)",
        "connector.lookup_policy(tenant,",
        "connector.get_ticket_status(tenant,",
        "connector.summarize_department_metrics(\n                    tenant,",
    )
    missing_service_fragments = [
        fragment for fragment in required_service_fragments if fragment not in test_method
    ]
    if missing_service_fragments:
        raise AssertionError(
            "Connector test service scope is incomplete: "
            + ", ".join(missing_service_fragments),
        )
    if "payload.tenant" in test_method:
        raise AssertionError(
            "Connector test service must not trust the payload tenant.",
        )


def assert_platform_config_export_uses_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    export_route = api_source[api_source.index(
        '@router.get("/enterprise/platform/config/export")'
    ):api_source.index('@router.post("/enterprise/platform/config/import")')]
    required_route_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=None",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "actor_user_id=identity.user_id",
        "tenant=tenant_id",
    )
    missing_route_fragments = [
        fragment for fragment in required_route_fragments if fragment not in export_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Platform config export tenant boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if export_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Platform config export must resolve the canonical request tenant.",
        )

    export_helper = api_source[api_source.index(
        "def export_platform_config("
    ):api_source.index(
        '@router.get("/enterprise/platform/status")',
        api_source.index("def export_platform_config("),
    )]
    required_helper_fragments = (
        "tenant: str",
        "export_configs_payload(\n                tenant=tenant,",
        "list_members(\n                include_inactive=True,\n                tenant=tenant,",
        "export_policy_payload(\n                tenant=tenant,",
    )
    missing_helper_fragments = [
        fragment for fragment in required_helper_fragments if fragment not in export_helper
    ]
    if missing_helper_fragments:
        raise AssertionError(
            "Platform config export helper scope is incomplete: "
            + ", ".join(missing_helper_fragments),
        )

    connector_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    export_method = connector_source[connector_source.index(
        "def export_configs_payload("
    ):connector_source.index(
        "def export_config_counts(",
        connector_source.index("def export_configs_payload("),
    )]
    if "self.redacted_configs(tenant=tenant)" not in export_method:
        raise AssertionError(
            "Connector config export must filter by the canonical tenant.",
        )

    member_source = (BACKEND_DIR / "services" / "members.py").read_text(
        encoding="utf-8",
    )
    list_method = member_source[member_source.index(
        "def list_members("
    ):member_source.index(
        "def get_member_by_user(",
        member_source.index("def list_members("),
    )]
    if 'member["tenant"] == tenant' not in list_method:
        raise AssertionError(
            "Member export scope must support canonical tenant filtering.",
        )

    tool_policy_source = (BACKEND_DIR / "services" / "tools.py").read_text(
        encoding="utf-8",
    )
    export_policy = tool_policy_source[tool_policy_source.index(
        "def export_policy_payload("
    ):tool_policy_source.index(
        "def save_policy(",
        tool_policy_source.index("def export_policy_payload("),
    )]
    required_policy_fragments = (
        "tenant: str",
        'tenants.get(tenant) if isinstance(tenants, dict) else None',
        'policy["tenants"] =',
        "{tenant: json.loads(json.dumps(tenant_policy))}",
    )
    missing_policy_fragments = [
        fragment for fragment in required_policy_fragments
        if fragment not in export_policy
    ]
    if missing_policy_fragments:
        raise AssertionError(
            "Tool policy export tenant scope is incomplete: "
            + ", ".join(missing_policy_fragments),
        )


def assert_platform_config_import_uses_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    import_route = api_source[api_source.index(
        '@router.post("/enterprise/platform/config/import")'
    ):api_source.index("return router", api_source.index(
        '@router.post("/enterprise/platform/config/import")'
    ))]
    required_route_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=None",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "import_members_payload(",
        "import_configs_payload(",
        "tenant=tenant_id",
        "export_platform_config(\n            actor_user_id=actor,\n            tenant=tenant_id,",
    )
    missing_route_fragments = [
        fragment for fragment in required_route_fragments if fragment not in import_route
    ]
    if missing_route_fragments:
        raise AssertionError(
            "Platform config import tenant boundary is incomplete: "
            + ", ".join(missing_route_fragments),
        )
    if import_route.count("_request_tenant(") != 1:
        raise AssertionError(
            "Platform config import must resolve the canonical request tenant.",
        )
    if import_route.count("tenant=tenant_id") != 5:
        raise AssertionError(
            "Platform config import must scope tenant-owned writes and response export.",
        )

    tool_policy_source = (BACKEND_DIR / "services" / "tools.py").read_text(
        encoding="utf-8",
    )
    policy_import = tool_policy_source[tool_policy_source.index(
        "def import_policy_payload("
    ):tool_policy_source.index(
        "def build_authorization_policy(",
        tool_policy_source.index("def import_policy_payload("),
    )]
    required_policy_fragments = (
        "tenant: str",
        'value.get("tenants", {})',
        "str(imported_tenant) != tenant",
        "Imported tool policies must belong to the request tenant.",
        "next_tenants = json.loads(json.dumps(current_tenants))",
        "next_tenants.pop(tenant, None)",
        "next_tenants[tenant] = self.merge_import_policy(",
        'policy["tenants"] = next_tenants',
    )
    missing_policy_fragments = [
        fragment for fragment in required_policy_fragments
        if fragment not in policy_import
    ]
    if missing_policy_fragments:
        raise AssertionError(
            "Tool policy import tenant scope is incomplete: "
            + ", ".join(missing_policy_fragments),
        )

    member_source = (BACKEND_DIR / "services" / "members.py").read_text(
        encoding="utf-8",
    )
    member_import = member_source[member_source.index(
        "def import_members_payload("
    ):member_source.index(
        "def list_members(",
        member_source.index("def import_members_payload("),
    )]
    required_member_fragments = (
        "tenant: str",
        'member["tenant"] != tenant',
        "Imported members must belong to the request tenant.",
        "if mode == \"replace\"",
    )
    missing_member_fragments = [
        fragment for fragment in required_member_fragments
        if fragment not in member_import
    ]
    if missing_member_fragments:
        raise AssertionError(
            "Member config import tenant scope is incomplete: "
            + ", ".join(missing_member_fragments),
        )

    connector_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    normalize_configs = connector_source[connector_source.index(
        "def normalize_import_configs("
    ):connector_source.index(
        "def import_configs_payload(",
        connector_source.index("def normalize_import_configs("),
    )]
    required_normalize_fragments = (
        "tenant: str | None = None",
        "config_tenant != tenant",
        "Imported connector configs must belong to the request tenant.",
        "existing_configs.get(config_tenant)",
    )
    missing_normalize_fragments = [
        fragment for fragment in required_normalize_fragments
        if fragment not in normalize_configs
    ]
    if missing_normalize_fragments:
        raise AssertionError(
            "Connector config normalization tenant scope is incomplete: "
            + ", ".join(missing_normalize_fragments),
        )

    connector_import = connector_source[connector_source.index(
        "def import_configs_payload("
    ):connector_source.index(
        "def test_connector(",
        connector_source.index("def import_configs_payload("),
    )]
    required_import_fragments = (
        "tenant: str",
        "tenant=tenant",
        "if config_tenant != tenant",
        "if mode == \"replace\"",
    )
    missing_import_fragments = [
        fragment for fragment in required_import_fragments
        if fragment not in connector_import
    ]
    if missing_import_fragments:
        raise AssertionError(
            "Connector config import tenant scope is incomplete: "
            + ", ".join(missing_import_fragments),
        )


def assert_platform_member_operations_use_request_tenant() -> None:
    repository = Members(
        [
            {
                "user_id": "acme:alice",
                "tenant": "acme",
                "display_name": "Alice",
                "role": "admin",
                "status": "active",
            },
            {
                "user_id": "globex:bob",
                "tenant": "globex",
                "display_name": "Globex Bob",
                "role": "admin",
                "status": "active",
            },
        ],
    )
    service = PlatformMemberService(
        repository=repository,
        tenant_hint_from_user_id=tenant_for_user,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )
    registry = service.registry_response_payload(
        user_id="acme:alice",
        tenant="acme",
        request_context=lambda _user_id: {"identities": IDENTITIES},
        registry_path="members.json",
    )
    if {member["tenant"] for member in registry["members"]} != {"acme"}:
        raise AssertionError("Member registry response leaked another tenant.")
    if {identity["tenant"] for identity in registry["identities"]} != {"acme"}:
        raise AssertionError("Member identity response leaked another tenant.")

    created = service.create_member_response_payload(
        payload={"user_id": "acme:charlie", "role": "member"},
        actor="acme:alice",
        tenant="acme",
        identity_metadata=identity_metadata,
        registry_path="members.json",
    )
    if {member["tenant"] for member in created["members"]} != {"acme"}:
        raise AssertionError("Member create response leaked another tenant.")
    if service.get_member_by_user("globex:bob") is None:
        raise AssertionError("Tenant-scoped member create removed another tenant.")

    cross_tenant_creates = (
        {"user_id": "globex:mallory", "tenant": "acme"},
        {"user_id": "acme:mallory", "tenant": "globex"},
    )
    for payload in cross_tenant_creates:
        try:
            service.create_member_response_payload(
                payload=payload,
                actor="acme:alice",
                tenant="acme",
                identity_metadata=identity_metadata,
                registry_path="members.json",
            )
        except PlatformMemberServiceError as exc:
            if exc.status_code != 403:
                raise AssertionError("Cross-tenant member create returned the wrong status.")
        else:
            raise AssertionError("Cross-tenant member create was allowed.")

    try:
        service.update_member_response_payload(
            user_id="globex:bob",
            payload={"display_name": "Compromised"},
            actor="acme:alice",
            tenant="acme",
            identity_metadata=identity_metadata,
            registry_path="members.json",
        )
    except PlatformMemberServiceError as exc:
        if exc.status_code != 404:
            raise AssertionError("Cross-tenant member update returned the wrong status.")
    else:
        raise AssertionError("Cross-tenant member update was allowed.")

    try:
        service.deactivate_member_response_payload(
            user_id="globex:bob",
            actor="acme:alice",
            tenant="acme",
            identity_metadata=identity_metadata,
            registry_path="members.json",
        )
    except PlatformMemberServiceError as exc:
        if exc.status_code != 404:
            raise AssertionError("Cross-tenant member deactivation returned the wrong status.")
    else:
        raise AssertionError("Cross-tenant member deactivation was allowed.")

    updated = service.update_member_response_payload(
        user_id="acme:charlie",
        payload={"display_name": "Charlie"},
        actor="acme:alice",
        tenant="acme",
        identity_metadata=identity_metadata,
        registry_path="members.json",
    )
    if updated["member"]["tenant"] != "acme":
        raise AssertionError("Member update changed the request tenant.")
    deactivated = service.deactivate_member_response_payload(
        user_id="acme:charlie",
        actor="acme:alice",
        tenant="acme",
        identity_metadata=identity_metadata,
        registry_path="members.json",
    )
    if deactivated["member"]["status"] != "inactive":
        raise AssertionError("Tenant-scoped member deactivation was not persisted.")
    globex_member = service.get_member_by_user("globex:bob")
    if globex_member is None or globex_member["display_name"] != "Globex Bob":
        raise AssertionError("Member mutations changed another tenant's data.")

    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    route_bounds = (
        (
            '@router.get("/enterprise/platform/members")',
            '@router.post("/enterprise/platform/members")',
        ),
        (
            '@router.post("/enterprise/platform/members")',
            '@router.patch("/enterprise/platform/members/{user_id:path}")',
        ),
        (
            '@router.patch("/enterprise/platform/members/{user_id:path}")',
            '@router.delete("/enterprise/platform/members/{user_id:path}")',
        ),
        (
            '@router.delete("/enterprise/platform/members/{user_id:path}")',
            '@router.get("/enterprise/platform/policies/tools")',
        ),
    )
    for start, end in route_bounds:
        route = api_source[api_source.index(start):api_source.index(end)]
        required_fragments = (
            "identity = get_request_identity(request)",
            "tenant_id = _request_tenant(",
            "identity_user_id=identity.user_id",
            "identity_tenant_id=identity.tenant_id",
            "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
            "tenant=tenant_id",
        )
        missing_fragments = [
            fragment for fragment in required_fragments if fragment not in route
        ]
        if missing_fragments or route.count("_request_tenant(") != 1:
            raise AssertionError(
                f"Platform member route tenant boundary is incomplete for {start}: "
                + ", ".join(missing_fragments),
            )

    member_source = (BACKEND_DIR / "services" / "members.py").read_text(
        encoding="utf-8",
    )
    required_service_fragments = (
        'self.list_members(include_inactive=True, tenant=tenant)',
        '"Member must belong to the request tenant."',
        '"Member was not found for this tenant."',
    )
    missing_service_fragments = [
        fragment for fragment in required_service_fragments
        if fragment not in member_source
    ]
    if missing_service_fragments:
        raise AssertionError(
            "Platform member service tenant boundary is incomplete: "
            + ", ".join(missing_service_fragments),
        )


def assert_platform_read_models_use_request_tenant() -> None:
    api_source = (BACKEND_DIR / "api" / "platform_admin.py").read_text(
        encoding="utf-8",
    )
    route_bounds = (
        (
            '@router.get("/enterprise/platform/status")',
            '@router.get("/enterprise/platform/connectors")',
            "status_request_context(\n                user_id=identity.user_id,\n                tenant=tenant_id,",
        ),
        (
            '@router.get("/enterprise/platform/connectors")',
            '@router.get("/enterprise/platform/governance")',
            "platform_connectors_response(\n                user_id=identity.user_id,\n                tenant=tenant_id,",
        ),
        (
            '@router.get("/enterprise/platform/governance")',
            '@router.get("/enterprise/platform/members")',
            "governance_request_payload(\n                user_id=identity.user_id,\n                tenant=tenant_id,",
        ),
    )
    for start, end, service_call in route_bounds:
        route = api_source[api_source.index(start):api_source.index(end)]
        required_fragments = (
            "identity = get_request_identity(request)",
            "tenant_id = _request_tenant(",
            "identity_user_id=identity.user_id",
            "identity_tenant_id=identity.tenant_id",
            "tenant=None",
            "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
            service_call,
        )
        missing_fragments = [
            fragment for fragment in required_fragments if fragment not in route
        ]
        if missing_fragments or route.count("_request_tenant(") != 1:
            raise AssertionError(
                f"Platform read route tenant boundary is incomplete for {start}: "
                + ", ".join(missing_fragments),
            )

    connector_source = (BACKEND_DIR / "services" / "connectors.py").read_text(
        encoding="utf-8",
    )
    required_connector_fragments = (
        "def platform_connectors_response(\n        self,\n        *,\n        user_id: str | None,\n        tenant: str,",
        "self.enterprise_runtime_context(\n            resolved_user_id,\n            tenant=tenant,",
        '"saved_configs": self.redacted_configs(tenant=tenant)',
        "runtime_tenant = tenant or self.runtime_tenant_for_user(user_id)",
    )
    missing_connector_fragments = [
        fragment
        for fragment in required_connector_fragments
        if fragment not in connector_source
    ]
    if missing_connector_fragments:
        raise AssertionError(
            "Platform connector read scope is incomplete: "
            + ", ".join(missing_connector_fragments),
        )


def assert_platform_status_and_governance_are_tenant_scoped() -> None:
    runtime_calls: list[dict[str, Any]] = []
    approval_calls: list[dict[str, Any]] = []
    audit_queries: list[dict[str, Any]] = []
    approvals = [
        {"approval_id": "approval_acme", "tenant": "acme", "user_id": "acme:alice"},
        {
            "approval_id": "approval_globex",
            "tenant": "globex",
            "user_id": "globex:bob",
        },
    ]
    audit_events = [
        {
            "event_id": "event_acme",
            "tenant": "acme",
            "user_id": "acme:alice",
            "timestamp": "2026-07-23T00:00:00+00:00",
        },
        {
            "event_id": "event_globex",
            "tenant": "globex",
            "user_id": "globex:bob",
            "timestamp": "2026-07-23T00:01:00+00:00",
        },
    ]

    def runtime_context(user_id: str, *, tenant: str | None = None) -> dict[str, Any]:
        runtime_calls.append({"user_id": user_id, "tenant": tenant})
        return {
            "tenant": tenant or tenant_for_user(user_id),
            "connector_label": "test",
            "connector_source": "global",
            "saved_config_enabled": False,
        }

    def list_approval_records(**kwargs: Any) -> list[dict[str, Any]]:
        approval_calls.append(dict(kwargs))
        tenant = kwargs.get("tenant")
        return [record for record in approvals if record["tenant"] == tenant]

    def query_audit_events(**kwargs: Any) -> list[dict[str, Any]]:
        audit_queries.append(dict(kwargs))
        tenant = kwargs.get("tenant")
        return [event for event in audit_events if event["tenant"] == tenant]

    service = PlatformStatusService(
        list_approval_records=list_approval_records,
        load_workflow_runs=lambda **_kwargs: [],
        load_workflow_templates=lambda **_kwargs: [],
        load_agents=lambda: [],
        load_memories=lambda **_kwargs: [],
        runtime_context=runtime_context,
        identity_metadata=lambda _user_id, tenant: [
            identity for identity in IDENTITIES if identity["tenant"] == tenant
        ],
        tenant_workspaces=lambda **kwargs: {
            kwargs["current_tenant"]: {"tenant": kwargs["current_tenant"]},
        },
        agent_run_repository=SimpleNamespace(),
        audit_logger=SimpleNamespace(
            query=query_audit_events,
            recent=lambda **_kwargs: list(audit_events),
        ),
        audit_event_reader=None,
        retrieval_event_reader=None,
        tool_policy=SimpleNamespace(),
        connector_health=lambda: {},
        runtime_provider_health=lambda: {},
        agent_readiness=lambda _agent: {},
        enterprise_tool_names=[],
        enterprise_tool_catalog={},
        approval_required_tools=set(),
        approval_required_workflows=set(),
    )

    context = service.status_request_context(
        user_id="acme:alice",
        tenant="globex",
    )
    if runtime_calls != [{"user_id": "acme:alice", "tenant": "globex"}]:
        raise AssertionError("Status runtime did not receive the request tenant.")
    if context["tenant"] != "globex" or {
        identity["tenant"] for identity in context["identities"]
    } != {"globex"}:
        raise AssertionError("Status context crossed the request tenant boundary.")

    payload = service.governance_request_payload(
        user_id="acme:alice",
        tenant="globex",
    )
    if [item["approval_id"] for item in payload["pending_approvals"]] != [
        "approval_globex"
    ]:
        raise AssertionError("Governance approvals crossed the request tenant boundary.")
    if [item["event_id"] for item in payload["recent_audit_events"]] != [
        "event_globex"
    ]:
        raise AssertionError("Governance audit events crossed the request tenant boundary.")
    if not approval_calls or approval_calls[-1].get("tenant") != "globex":
        raise AssertionError("Governance approval query omitted the request tenant.")
    if not audit_queries or {call.get("tenant") for call in audit_queries} != {
        "globex"
    }:
        raise AssertionError("Governance audit fallback omitted the request tenant.")


def main() -> None:
    assert_agent_list_is_tenant_scoped()
    assert_cross_tenant_runtime_access_is_denied()
    assert_access_scope_rejects_other_tenant_users()
    assert_pg_agent_catalog_requires_tenant_scope()
    assert_knowledge_api_rejects_tenant_mismatch()
    assert_agent_run_history_uses_request_tenant()
    assert_tool_audit_history_uses_request_tenant()
    assert_workflow_run_history_uses_request_tenant()
    assert_approval_history_uses_request_tenant()
    assert_tool_policy_query_uses_request_tenant()
    assert_tool_policy_update_uses_request_tenant()
    assert_connector_config_query_uses_request_tenant()
    assert_connector_config_update_uses_request_tenant()
    assert_connector_test_uses_request_tenant()
    assert_platform_config_export_uses_request_tenant()
    assert_platform_config_import_uses_request_tenant()
    assert_platform_member_operations_use_request_tenant()
    assert_platform_read_models_use_request_tenant()
    assert_platform_status_and_governance_are_tenant_scoped()
    print("Phase 6 tenant access boundary contract passed.")


if __name__ == "__main__":
    main()
