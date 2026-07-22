#!/usr/bin/env python3
"""Validate runtime invocation persistence rejects mismatched request context."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.services.agent_runs import PlatformAgentRunService  # noqa: E402


class RuntimeInvocationWriter:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_invocation(self, record: Any) -> Any:
        self.records.append(record)
        return record


def assert_mismatched_context_is_not_persisted() -> None:
    writer = RuntimeInvocationWriter()
    service = PlatformAgentRunService(
        repository=object(),
        runtime_invocation_writer=writer,
    )
    runtime_invocation_result = {
        "answer": "",
        "status": "failed",
        "runtime_invocation_id": "runtime-invocation-context-guard",
        "provider_id": "agentscope-platform-adapter",
        "provider": "agentscope",
        "mode": "local-service",
        "evidence": {},
        "raw": {},
        "error": "pending",
    }

    service.append_runtime_invocation_record_from_context(
        response_trace={
            "turn_id": "agent-run-context-guard",
            "created_at": "2026-07-22T00:00:00+00:00",
        },
        context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-context-guard",
            "agent_id": "agent-support",
            "agent_name": "Support Agent",
            "question": "Check runtime persistence context.",
            "runtime_invocation_id": "runtime-invocation-context-guard",
            "runtime_invocation_request": {
                "context": {
                    "tenant": "other-tenant",
                    "user_id": "acme:alice",
                    "session_id": "session-context-guard",
                    "agent_id": "agent-support",
                },
                "question": "Check runtime persistence context.",
                "metadata": {
                    "runtime_invocation_id": "runtime-invocation-context-guard",
                },
            },
            "runtime_adapter": {
                "id": "agentscope-platform-adapter",
                "provider": "agentscope",
                "mode": "local-service",
            },
        },
        runtime_invocation_result=runtime_invocation_result,
    )
    assert writer.records == []


def assert_matching_context_is_persisted() -> None:
    writer = RuntimeInvocationWriter()
    service = PlatformAgentRunService(
        repository=object(),
        runtime_invocation_writer=writer,
    )
    runtime_invocation_result = {
        "answer": "",
        "status": "failed",
        "runtime_invocation_id": "runtime-invocation-context-guard",
        "provider_id": "agentscope-platform-adapter",
        "provider": "agentscope",
        "mode": "local-service",
        "evidence": {},
        "raw": {},
        "error": "pending",
    }

    service.append_runtime_invocation_record_from_context(
        response_trace={
            "turn_id": "agent-run-context-guard",
            "created_at": "2026-07-22T00:00:00+00:00",
        },
        context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-context-guard",
            "agent_id": "agent-support",
            "agent_name": "Support Agent",
            "question": "Check runtime persistence context.",
            "runtime_invocation_id": "runtime-invocation-context-guard",
            "runtime_invocation_request": {
                "context": {
                    "tenant": "acme",
                    "user_id": "acme:alice",
                    "session_id": "session-context-guard",
                    "agent_id": "agent-support",
                },
                "question": "Check runtime persistence context.",
                "metadata": {
                    "runtime_invocation_id": "runtime-invocation-context-guard",
                },
            },
            "runtime_adapter": {
                "id": "agentscope-platform-adapter",
                "provider": "agentscope",
                "mode": "local-service",
            },
        },
        runtime_invocation_result=runtime_invocation_result,
    )
    assert len(writer.records) == 1
    assert writer.records[0].tenant_id == "acme"
    assert writer.records[0].request_summary["context"]["tenant"] == "acme"


def main() -> None:
    assert_mismatched_context_is_not_persisted()
    assert_matching_context_is_persisted()
    print("phase 4.x runtime invocation context persistence guard checks passed")


if __name__ == "__main__":
    main()
