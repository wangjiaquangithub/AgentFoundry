#!/usr/bin/env python3
"""Validate Workflow tool execution uses the request-validated tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_API = ROOT / "backend" / "api" / "workflows.py"
WORKFLOWS_SERVICE = ROOT / "backend" / "services" / "workflows.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def source_between(source: str, start: str, end: str) -> str:
    return source[source.index(start) : source.index(end)]


def main() -> int:
    api_source = WORKFLOWS_API.read_text(encoding="utf-8")
    service_source = WORKFLOWS_SERVICE.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    workflow_step = source_between(
        api_source,
        "def _workflow_step(",
        "\ndef create_workflow_governance_router(",
    )
    assert "tenant: str," in workflow_step
    assert "tenant=tenant," in source_between(
        workflow_step,
        "tool_response = workflow_run_service.run_step_tool_from_context(",
        "return workflow_run_service.executed_step_record_from_context(",
    )

    run_route = source_between(
        api_source,
        '@router.post("/enterprise/platform/workflows/run")',
        "    return router",
    )
    workflow_step_call = source_between(
        run_route,
        "step_result = _workflow_step(",
        "workflow_run_service.append_step_result(",
    )
    assert "tenant=tenant," in workflow_step_call

    service_method = source_between(
        service_source,
        "    def run_step_tool_from_context(",
        "    def build_tool_result_answer_context(",
    )
    assert "tenant: str," in service_method
    assert "tenant=tenant," in service_method

    assert (
        "scripts/check_phase6_workflow_tool_execution_request_tenant.py"
        in gate_source
    )

    print("[phase6-workflow-tool-execution-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
