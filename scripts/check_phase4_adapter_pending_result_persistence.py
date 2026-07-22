#!/usr/bin/env python3
"""Validate phase 4.6 adapter pending result persistence."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    RuntimeContext,
    RuntimeInvocationRequest,
    get_runtime_adapter,
)
from backend.services.agent_runs import PlatformAgentRunService  # noqa: E402


class RuntimeInvocationWriter:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_invocation(self, record: Any) -> Any:
        self.records.append(record)
        return record


async def assert_adapter_pending_result_persists() -> None:
    adapter = get_runtime_adapter()
    writer = RuntimeInvocationWriter()
    service = PlatformAgentRunService(
        repository=object(),
        runtime_invocation_writer=writer,
    )
    runtime_invocation_id = "runtime-invocation-pending-persist-1"
    request = RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-pending-persist-1",
            agent_id="agent-support",
            agent_name="Support Agent",
        ),
        question="Summarize the runtime boundary.",
        tools=("knowledge.search",),
        knowledge_base_ids=("kb-handbook",),
        memory_enabled=True,
        metadata={"runtime_invocation_id": runtime_invocation_id},
    )

    result_payload = (await adapter.invoke(request)).to_dict()
    service.append_runtime_invocation_record_from_context(
        response_trace={
            "turn_id": "agent-run-pending-persist-1",
            "created_at": "2026-07-22T00:00:00+00:00",
        },
        context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-pending-persist-1",
            "agent_id": "agent-support",
            "agent_name": "Support Agent",
            "question": "Summarize the runtime boundary.",
            "runtime_invocation_id": runtime_invocation_id,
            "runtime_invocation_request": request.to_dict(),
            "runtime_adapter": adapter.describe(
                {"agent_id": "agent-support", "agent_name": "Support Agent"},
            ),
        },
        runtime_invocation_result=result_payload,
    )

    assert len(writer.records) == 1
    record = writer.records[0]
    assert record.id == runtime_invocation_id
    assert record.tenant_id == "acme"
    assert record.provider_id == adapter.id
    assert record.agent_run_id == "agent-run-pending-persist-1"
    assert record.error
    assert "pending" in record.error.lower()
    assert record.request_summary["metadata"]["runtime_invocation_id"] == (
        runtime_invocation_id
    )
    assert record.request_summary["context"]["tenant"] == "acme"
    assert record.response_summary["status"] == "failed"
    assert record.response_summary["runtime_invocation_id"] == runtime_invocation_id
    assert record.response_summary["raw"]["runtime_error"]["message"] == record.error
    runtime_bridge = record.response_summary["raw"]["runtime_bridge"]
    assert runtime_bridge["type"] == "agentscope_adapter_invocation_pending"
    assert runtime_bridge["provider_invocation_wired"] is False
    assert runtime_bridge["adapter_id"] == adapter.id


def main() -> None:
    asyncio.run(assert_adapter_pending_result_persists())
    print("phase 4.6 adapter pending result persistence ok")


if __name__ == "__main__":
    main()
