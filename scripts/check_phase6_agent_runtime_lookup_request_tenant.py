#!/usr/bin/env python3
"""Validate Agent runtime lookup is bound to the request tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AGENT_RUNTIME_API = ROOT / "backend" / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def main() -> int:
    source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    execution_route = source[
        source.index('@router.post("/enterprise/platform/agent/run")') :
        source.index('@router.get("/enterprise/platform/agent/runs")')
    ]

    request_tenant_index = execution_route.index(
        "request_tenant = _request_tenant("
    )
    runtime_lookup_index = execution_route.index(
        "runtime = agent_run_service.resolve_runtime_context("
    )
    assert request_tenant_index < runtime_lookup_index
    assert "tenant=None," in execution_route[
        request_tenant_index:runtime_lookup_index
    ]
    assert "load_runtime_context=lambda runtime_user_id:" in execution_route
    assert "enterprise_runtime_context(\n" in execution_route
    assert "runtime_user_id,\n                    tenant=request_tenant," in (
        execution_route
    )
    assert "scripts/check_phase6_agent_runtime_lookup_request_tenant.py" in (
        gate_source
    )

    print("[phase6-agent-runtime-lookup-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
