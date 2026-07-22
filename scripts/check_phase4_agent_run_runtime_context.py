#!/usr/bin/env python3
"""Validate agent-run runtime requests carry platform governance context."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))


class _UnusedAgentRunRepository:
    def list(self, **_filters: Any) -> list[dict[str, Any]]:
        raise AssertionError("repository should not be used by this contract check")


def _safe_path_part(value: str) -> str:
    return value.replace(":", "_").replace("/", "_")


def main() -> None:
    from backend.runtime import build_runtime_invocation_request_payload
    from backend.services.agent_runs import PlatformAgentRunService

    service = PlatformAgentRunService(repository=_UnusedAgentRunRepository())
    execution_context = service.build_execution_context(
        run_request={
            "question": "Summarize enterprise memory and knowledge policy.",
            "user_id": "acme:alice",
            "session_id": "session-phase-4-runtime-context",
        },
        agent={
            "id": "agent-enterprise-support",
        },
        agent_metadata={
            "agent_id": "agent-enterprise-support",
            "agent_name": "Enterprise Support",
            "configured_tools": ["crm_lookup", "knowledge_search"],
            "knowledge_base_ids": ["kb-enterprise-handbook", "kb-security-policy"],
            "memory_enabled": True,
        },
        runtime={
            "tenant": "acme",
            "connector_label": "agentfoundry-platform",
            "connector_source": "platform_control_plane",
        },
        runtime_adapter={
            "id": "agentscope-platform-adapter",
            "provider": "agentscope",
            "mode": "local-service",
        },
        build_runtime_invocation_request_payload=(
            build_runtime_invocation_request_payload
        ),
        default_tool_names={"knowledge_search"},
        safe_path_part=_safe_path_part,
    )

    request = execution_context["runtime_invocation_request"]
    runtime_invocation_id = execution_context["runtime_invocation_id"]

    assert request["context"]["tenant"] == "acme"
    assert request["context"]["user_id"] == "acme:alice"
    assert request["context"]["session_id"] == "session-phase-4-runtime-context"
    assert request["context"]["agent_id"] == "agent-enterprise-support"
    assert request["context"]["agent_name"] == "Enterprise Support"
    assert request["question"] == "Summarize enterprise memory and knowledge policy."
    assert request["tools"] == ["crm_lookup", "knowledge_search"]
    assert request["knowledge_base_ids"] == [
        "kb-enterprise-handbook",
        "kb-security-policy",
    ]
    assert request["memory_enabled"] is True
    assert request["metadata"]["source"] == "enterprise_agent_run"
    assert request["metadata"]["runtime_invocation_id"] == runtime_invocation_id
    assert request["context"]["metadata"]["source"] == "enterprise_agent_run"
    assert (
        request["context"]["metadata"]["runtime_invocation_id"]
        == runtime_invocation_id
    )
    assert execution_context["response_record_context"][
        "runtime_invocation_request"
    ] == request

    print("phase 4.x agent run runtime context checks passed")


if __name__ == "__main__":
    main()
