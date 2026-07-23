#!/usr/bin/env python3
"""Validate platform config Agent imports against the request tenant."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.check_phase6_tenant_access_boundary import (  # noqa: E402
    build_agent,
    build_service,
)
from services.agents import PlatformAgentServiceError  # noqa: E402


PLATFORM_ADMIN_API = BACKEND_DIR / "api" / "platform_admin.py"
AGENT_SERVICE = BACKEND_DIR / "services" / "agents.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def assert_import_route_passes_authenticated_tenant() -> None:
    source = PLATFORM_ADMIN_API.read_text(encoding="utf-8")
    route = source[
        source.index('    @router.post("/enterprise/platform/config/import")') :
        source.index("    return router", source.index(
            '    @router.post("/enterprise/platform/config/import")'
        ))
    ]
    required_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "import_agents_payload(",
        "tenant=tenant_id",
    )
    missing = [fragment for fragment in required_fragments if fragment not in route]
    if missing:
        raise AssertionError(
            "Platform config Agent import request tenant boundary is incomplete: "
            + ", ".join(missing),
        )

    agent_import_call = route[
        route.index("deps.agent_service().import_agents_payload(") :
        route.index(
            "            except PlatformAgentServiceError",
            route.index("deps.agent_service().import_agents_payload("),
        )
    ]
    assert "tenant=tenant_id" in agent_import_call


def assert_agent_service_requires_explicit_tenant() -> None:
    source = AGENT_SERVICE.read_text(encoding="utf-8")
    method = source[
        source.index("    def import_agents_payload(") :
        source.index("    def normalize_import_agents(")
    ]
    required_fragments = (
        "tenant: str",
        "normalize_import_agents(value, tenant=tenant)",
        "self.list_agents(tenant=tenant)",
        "self.save_tenant_agents(tenant=tenant, agents=agents)",
    )
    missing = [fragment for fragment in required_fragments if fragment not in method]
    if missing:
        raise AssertionError(
            "Agent config import must use the explicit request tenant: "
            + ", ".join(missing),
        )
    assert "self._tenant_for_user(" not in method


def assert_replace_and_merge_preserve_other_tenants() -> None:
    replacement = build_agent("agent_globex_replacement", "globex")
    replace_service = build_service()
    replace_service.import_agents_payload(
        [replacement],
        mode="replace",
        actor="acme:alice",
        tenant="globex",
    )
    assert [agent["id"] for agent in replace_service.list_agents(tenant="acme")] == [
        "agent_acme",
    ]
    assert [
        agent["id"] for agent in replace_service.list_agents(tenant="globex")
    ] == ["agent_globex_replacement"]

    merged = build_agent("agent_globex_merged", "globex")
    merge_service = build_service()
    merge_service.import_agents_payload(
        [merged],
        mode="merge",
        actor="acme:alice",
        tenant="globex",
    )
    assert [agent["id"] for agent in merge_service.list_agents(tenant="acme")] == [
        "agent_acme",
    ]
    assert {
        agent["id"] for agent in merge_service.list_agents(tenant="globex")
    } == {"agent_globex", "agent_globex_merged"}


def assert_cross_tenant_import_is_rejected() -> None:
    service = build_service()
    try:
        service.import_agents_payload(
            [build_agent("agent_acme_import", "acme")],
            mode="replace",
            actor="acme:alice",
            tenant="globex",
        )
    except PlatformAgentServiceError as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-tenant Agent config import must be rejected")

    assert [agent["id"] for agent in service.list_agents(tenant="acme")] == [
        "agent_acme",
    ]
    assert [agent["id"] for agent in service.list_agents(tenant="globex")] == [
        "agent_globex",
    ]


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_platform_config_agent_import_request_tenant.py" in source


def main() -> int:
    assert_import_route_passes_authenticated_tenant()
    assert_agent_service_requires_explicit_tenant()
    assert_replace_and_merge_preserve_other_tenants()
    assert_cross_tenant_import_is_rejected()
    assert_phase6_gate_includes_check()
    print("[phase6-platform-config-agent-import-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
