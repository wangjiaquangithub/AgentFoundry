#!/usr/bin/env python3
"""Validate Tool runtime lookups are bound to the request tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOOLS_API = ROOT / "backend" / "api" / "tools.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def route_source(source: str, start: str, end: str) -> str:
    return source[source.index(start) : source.index(end)]


def assert_lookup_is_scoped(route: str, *, lookup_count: int) -> None:
    request_tenant_index = route.index("request_tenant = _request_tenant(")
    first_lookup_index = route.index("enterprise_runtime_context(")
    assert request_tenant_index < first_lookup_index
    assert "tenant=None," in route[request_tenant_index:first_lookup_index]
    assert route.count("enterprise_runtime_context(") == lookup_count
    assert route.count("tenant=request_tenant,") == lookup_count


def main() -> int:
    source = TOOLS_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    catalog_route = route_source(
        source,
        '@router.get("/enterprise/platform/tools")',
        '@router.get("/enterprise/platform/audit")',
    )
    run_route = route_source(
        source,
        '@router.post("/enterprise/platform/tools/run")',
        "    return router",
    )

    assert_lookup_is_scoped(catalog_route, lookup_count=1)
    assert_lookup_is_scoped(run_route, lookup_count=2)
    assert "scripts/check_phase6_tool_runtime_lookup_request_tenant.py" in (
        gate_source
    )

    print("[phase6-tool-runtime-lookup-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
