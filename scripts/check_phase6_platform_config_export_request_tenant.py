#!/usr/bin/env python3
"""Validate platform config export Agent reads against the request tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLATFORM_ADMIN_API = ROOT / "backend" / "api" / "platform_admin.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def assert_export_helper_uses_explicit_tenant() -> None:
    source = PLATFORM_ADMIN_API.read_text(encoding="utf-8")
    helper = source[
        source.index("    def export_platform_config(") :
        source.index('    @router.get("/enterprise/platform/status")')
    ]
    assert "agents = deps.agent_service().list_agents(tenant=tenant)" in helper
    assert "list_agents_for_user(" not in helper


def assert_export_route_passes_authenticated_tenant() -> None:
    source = PLATFORM_ADMIN_API.read_text(encoding="utf-8")
    route = source[
        source.index('    @router.get("/enterprise/platform/config/export")') :
        source.index('    @router.post("/enterprise/platform/config/import")')
    ]
    required_fragments = (
        "identity = get_request_identity(request)",
        "tenant_id = _request_tenant(",
        "identity_user_id=identity.user_id",
        "identity_tenant_id=identity.tenant_id",
        "tenant=None",
        "tenant_hint_from_user_id=deps.tenant_hint_from_user_id",
        "export_platform_config(\n            actor_user_id=identity.user_id,\n            tenant=tenant_id,",
    )
    missing = [fragment for fragment in required_fragments if fragment not in route]
    if missing:
        raise AssertionError(
            "Platform config export request tenant boundary is incomplete: "
            + ", ".join(missing),
        )


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_platform_config_export_request_tenant.py" in source


def main() -> int:
    assert_export_helper_uses_explicit_tenant()
    assert_export_route_passes_authenticated_tenant()
    assert_phase6_gate_includes_check()
    print("[phase6-platform-config-export-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
