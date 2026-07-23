#!/usr/bin/env python3
"""Validate Workflow runtime lookups are bound to the request tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_API = ROOT / "backend" / "api" / "workflows.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def main() -> int:
    source = WORKFLOWS_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    helper = source[
        source.index("def _runtime_tenant_for_user(") : source.index(
            "\ndef _workflow_step("
        )
    ]

    request_tenant_index = helper.index("request_tenant = _request_tenant(")
    runtime_lookup_index = helper.index("enterprise_runtime_context(")
    runtime_validation_index = helper.index(
        'tenant=runtime_selection["tenant"],'
    )

    assert request_tenant_index < runtime_lookup_index < runtime_validation_index
    assert "tenant=None," in helper[request_tenant_index:runtime_lookup_index]
    assert helper.count("enterprise_runtime_context(") == 1
    assert helper.count("tenant=request_tenant,") == 1
    assert "scripts/check_phase6_workflow_runtime_lookup_request_tenant.py" in (
        gate_source
    )

    print("[phase6-workflow-runtime-lookup-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
