#!/usr/bin/env python3
"""Validate routed Agent tool execution uses the request-validated tenant."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AGENT_RUN_SERVICE = ROOT / "backend" / "services" / "agent_runs.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def main() -> int:
    source = AGENT_RUN_SERVICE.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    method = source[
        source.index(
            "    def run_and_record_executed_routed_tool_call_from_context("
        ) : source.index("    def build_executed_routed_tool_call(")
    ]

    execution_context_index = method.index(
        "execution_context_view = self.execution_context_view(execution_context)"
    )
    tool_execution_index = method.index(
        "tool_response = run_authorized_enterprise_tool("
    )
    assert execution_context_index < tool_execution_index
    assert 'tenant=execution_context_view["tenant"],' in method
    assert 'user_id=response_record_context["user_id"],' in method
    assert method.count("run_authorized_enterprise_tool(") == 1

    assert (
        "scripts/check_phase6_agent_tool_execution_request_tenant.py"
        in gate_source
    )

    print("[phase6-agent-tool-execution-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
