#!/usr/bin/env python3
"""Validate enterprise tool execution lookup uses the request tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS_API = ROOT / "backend" / "api" / "tools.py"
TOOLS_SERVICE = ROOT / "backend" / "services" / "tools.py"
ENTERPRISE_TOOLS = ROOT / "backend" / "enterprise_tools.py"
MAIN = ROOT / "backend" / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def source_between(source: str, start: str, end: str) -> str:
    return source[source.index(start) : source.index(end)]


def main() -> int:
    api_source = TOOLS_API.read_text(encoding="utf-8")
    service_source = TOOLS_SERVICE.read_text(encoding="utf-8")
    runtime_source = ENTERPRISE_TOOLS.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    run_route = source_between(
        api_source,
        '@router.post("/enterprise/platform/tools/run")',
        "    return router",
    )
    assert "tenant=tenant," in source_between(
        run_route,
        "response = tool_policy_service.run_platform_tool_from_context(",
        "return tool_policy_service.tool_run_response(",
    )

    service_method = source_between(
        service_source,
        "    def run_platform_tool_from_context(",
        "    def normalize_policy_tools(",
    )
    assert "tenant: str," in service_method
    assert "tenant=tenant," in service_method

    runtime_method = source_between(
        runtime_source,
        "    def run_authorized_tool(",
        "        tool_policy_service = self.tool_policy_service()",
    )
    assert "tenant: str | None = None," in runtime_method
    assert "self.runtime_context(user_id, tenant=tenant)" in runtime_method
    assert "else self.runtime_context(user_id)" in runtime_method

    runtime_callback = source_between(
        main_source,
        "def _enterprise_runtime_context(",
        "enterprise_tool_runtime = EnterpriseToolRuntimeFactory(",
    )
    assert "tenant: str | None = None," in runtime_callback
    assert "tenant=tenant," in runtime_callback

    execution_helper = source_between(
        main_source,
        "def _run_authorized_enterprise_tool(",
        "app = create_app(",
    )
    assert "tenant: str | None = None," in execution_helper
    assert "tenant=tenant," in execution_helper

    assert (
        "scripts/check_phase6_enterprise_tool_execution_request_tenant.py"
        in gate_source
    )

    print("[phase6-enterprise-tool-execution-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
