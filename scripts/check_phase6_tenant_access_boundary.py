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


def main() -> None:
    assert_agent_list_is_tenant_scoped()
    assert_cross_tenant_runtime_access_is_denied()
    assert_access_scope_rejects_other_tenant_users()
    assert_pg_agent_catalog_requires_tenant_scope()
    print("Phase 6 tenant access boundary contract passed.")


if __name__ == "__main__":
    main()
