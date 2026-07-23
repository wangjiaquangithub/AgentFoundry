#!/usr/bin/env python3
"""Validate Agent Catalog CRUD against the authenticated request tenant."""

from __future__ import annotations

from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep this contract gate runnable without the optional web stack.
fastapi_module = ModuleType("fastapi")


class StubHTTPException(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class StubAPIRouter:
    def get(self, *_args: Any, **_kwargs: Any) -> Any:
        return lambda fn: fn

    post = get
    patch = get
    delete = get


fastapi_module.APIRouter = StubAPIRouter
fastapi_module.HTTPException = StubHTTPException
fastapi_module.Request = Any
sys.modules.setdefault("fastapi", fastapi_module)

from api.agents import _request_tenant  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from scripts.check_phase6_tenant_access_boundary import build_service  # noqa: E402
from services.agents import PlatformAgentServiceError  # noqa: E402


AGENTS_API = BACKEND_DIR / "api" / "agents.py"
MAIN_MODULE = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


class UpdatePayload:
    tenant = None
    model_config_id = None
    knowledge_base_ids = None
    name = "Globex Request Tenant Agent"

    def model_dump(self, *, exclude_unset: bool = False) -> dict[str, Any]:
        del exclude_unset
        return {"name": self.name}


def publish_payload(*, tenant: str) -> SimpleNamespace:
    return SimpleNamespace(
        template_id="knowledge-assistant",
        tenant=tenant,
        name="Request Tenant Agent",
        description="",
        tools=["enterprise_search"],
        model_config_id="model_primary",
        knowledge_base_ids=["kb_support"],
        memory_enabled=True,
        workflow_enabled=True,
        allowed_user_ids=[],
        allowed_roles=[],
    )


def assert_request_identity_tenant_is_authoritative() -> None:
    tenant = _request_tenant(
        identity_user_id="acme:alice",
        identity_tenant_id="globex",
        tenant=None,
        tenant_hint_from_user_id=lambda user_id: user_id.split(":", 1)[0],
    )
    assert tenant == "globex"

    try:
        _request_tenant(
            identity_user_id="acme:alice",
            identity_tenant_id="globex",
            tenant="acme",
            tenant_hint_from_user_id=lambda user_id: user_id.split(":", 1)[0],
        )
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-tenant Agent Catalog payload must be rejected")


def assert_catalog_crud_uses_explicit_request_tenant() -> None:
    service = build_service()

    registry = service.registry_response(tenant="globex")
    assert [agent["id"] for agent in registry["agents"]] == ["agent_globex"]

    update_request = service.update_request_payload(
        "agent_globex",
        UpdatePayload(),
        header_user_id="acme:alice",
        tenant="globex",
    )
    assert update_request["user_id"] == "acme:alice"

    updated = service.update_agent_response_payload(
        "agent_globex",
        UpdatePayload(),
        "acme:alice",
        tenant="globex",
    )
    assert updated["agent"]["tenant"] == "globex"
    assert updated["agent"]["name"] == UpdatePayload.name

    archived = service.archive_agent_response_payload(
        "agent_globex",
        user_id="acme:alice",
        tenant="globex",
    )
    assert archived["agent"]["tenant"] == "globex"
    assert archived["agent"]["status"] == "archived"

    published = service.publish_agent_response_payload(
        publish_payload(tenant="globex"),
        "acme:alice",
        tenant="globex",
    )
    assert published["agent"]["tenant"] == "globex"
    assert {agent["tenant"] for agent in published["agents"]} == {"globex"}

    try:
        service.publish_agent_response_payload(
            publish_payload(tenant="acme"),
            "acme:alice",
            tenant="globex",
        )
    except PlatformAgentServiceError as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("service must reject a payload outside request tenant")


def assert_route_wiring_passes_request_tenant() -> None:
    source = AGENTS_API.read_text(encoding="utf-8")
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    assert "tenant_hint_from_user_id: Callable[[str], str | None]" in source
    assert "registry_response(tenant=tenant)" in source
    assert source.count("tenant=tenant,") >= 4
    assert "tenant_hint_from_user_id=tenant_hint_from_user_id" in main_source
    assert "scripts/check_phase6_agent_catalog_request_tenant.py" in gate_source


def main() -> int:
    assert_request_identity_tenant_is_authoritative()
    assert_catalog_crud_uses_explicit_request_tenant()
    assert_route_wiring_passes_request_tenant()
    print("[phase6-agent-catalog-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
