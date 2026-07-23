#!/usr/bin/env python3
"""Validate Workflow Agent lookups against the authenticated request tenant."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.check_phase6_tenant_access_boundary import build_service  # noqa: E402


WORKFLOWS_API = BACKEND_DIR / "api" / "workflows.py"
PLATFORM_ACCESS = BACKEND_DIR / "platform_access.py"
AGENT_SERVICE = BACKEND_DIR / "services" / "agents.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def assert_workflow_route_passes_request_tenant() -> None:
    source = WORKFLOWS_API.read_text(encoding="utf-8")
    route_start = source.index(
        '    @router.post("/enterprise/platform/workflows/run")'
    )
    route = source[route_start : source.index("    return router", route_start)]
    lookup_start = route.index("deps.published_agent_tool_scope_for_user(")
    lookup_end = route.index("\n            )", lookup_start)
    lookup = route[lookup_start:lookup_end]

    assert route.index("request_tenant = _request_tenant(") < lookup_start
    assert "tenant=request_tenant," in lookup


def assert_access_helper_forwards_explicit_tenant() -> None:
    source = PLATFORM_ACCESS.read_text(encoding="utf-8")
    method_start = source.index("    def published_agent_tool_scope_for_user(")
    method = source[
        method_start : source.index("    def role_for_user(", method_start)
    ]

    assert "tenant: str | None = None" in method
    assert "tenant=tenant," in method


def assert_agent_lookup_uses_explicit_request_tenant() -> None:
    service = build_service()

    agent, tools = service.published_tool_scope_access_context(
        "agent_globex",
        user_id="acme:alice",
        tenant="globex",
    )
    assert agent["tenant"] == "globex"
    assert tools == {"enterprise_search"}


def assert_service_validates_access_with_explicit_tenant() -> None:
    source = AGENT_SERVICE.read_text(encoding="utf-8")
    context_start = source.index("    def published_tool_scope_access_context(")
    context = source[
        context_start : source.index("    def template_metadata(", context_start)
    ]
    access_start = source.index("    def assert_user_access(")
    access = source[
        access_start : source.index("    def access_summary(", access_start)
    ]

    assert 'request_tenant = (tenant or "").strip()' in context
    assert "tenant=request_tenant," in context
    assert 'runtime_tenant = (tenant or "").strip()' in access


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_workflow_agent_lookup_request_tenant.py" in source


def main() -> int:
    assert_workflow_route_passes_request_tenant()
    assert_access_helper_forwards_explicit_tenant()
    assert_agent_lookup_uses_explicit_request_tenant()
    assert_service_validates_access_with_explicit_tenant()
    assert_phase6_gate_includes_check()
    print("[phase6-workflow-agent-lookup-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
