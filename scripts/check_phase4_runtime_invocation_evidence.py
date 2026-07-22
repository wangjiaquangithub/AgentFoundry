#!/usr/bin/env python3
"""Validate phase 4.1 runtime invocation evidence contract."""

from __future__ import annotations

import ast
import logging
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    describe_runtime_adapter,
    build_runtime_invocation_request_payload,
    build_runtime_invocation_result_payload,
    normalize_runtime_invocation_result,
)
from backend.services.agent_runs import PlatformAgentRunService  # noqa: E402

agent_runs_logger = logging.getLogger("backend.services.agent_runs")


class RuntimeInvocationWriter:
    def __init__(self) -> None:
        self.records = []

    def append_invocation(self, record):
        self.records.append(record)
        return record


class AgentRunRepository:
    def __init__(self) -> None:
        self.records = []

    def append(self, record):
        self.records.append(record)
        return record


def assert_runtime_request_contract() -> None:
    payload = build_runtime_invocation_request_payload(
        tenant="acme",
        user_id="acme:alice",
        session_id="session-1",
        agent_id="agent-1",
        agent_name="Support Agent",
        question="Summarize the contract.",
        tools=("knowledge_search",),
        knowledge_base_ids=("kb-1",),
        memory_enabled=True,
        metadata={
            "source": "enterprise_agent_run",
            "runtime_invocation_id": "runtime-invocation-1",
        },
    )

    assert payload["context"]["tenant"] == "acme"
    assert payload["context"]["user_id"] == "acme:alice"
    assert payload["context"]["session_id"] == "session-1"
    assert payload["context"]["agent_id"] == "agent-1"
    assert payload["metadata"]["runtime_invocation_id"] == "runtime-invocation-1"
    assert payload["tools"] == ["knowledge_search"]
    assert payload["knowledge_base_ids"] == ["kb-1"]
    assert payload["memory_enabled"] is True


def assert_runtime_result_contract() -> None:
    runtime_adapter = describe_runtime_adapter(
        {"agent_id": "agent-1", "agent_name": "Support Agent"},
    )
    payload = build_runtime_invocation_result_payload(
        answer="Done.",
        status="completed",
        evidence={
            "tenant": "acme",
            "user_id": "acme:alice",
            "agent_id": "agent-1",
            "session_id": "session-1",
        },
        runtime_adapter=runtime_adapter,
        runtime_invocation_id="runtime-invocation-1",
        agent_run_id="agent-run-1",
        provider_run_id="provider-run-1",
        completed_at="2026-07-21T00:00:00+00:00",
        token_usage={"input_tokens": 12, "output_tokens": 4},
        raw={"routed": True, "tool_call_count": 1},
    )

    assert payload["provider_id"] == runtime_adapter["id"]
    assert payload["provider"] == "agentscope"
    assert payload["mode"] == "local-service"
    assert payload["runtime_invocation_id"] == "runtime-invocation-1"
    assert payload["agent_run_id"] == "agent-run-1"
    assert payload["provider_run_id"] == "provider-run-1"
    assert payload["completed_at"] == "2026-07-21T00:00:00+00:00"
    assert payload["status"] == "completed"
    assert payload["token_usage"]["input_tokens"] == 12
    assert payload["raw"]["tool_call_count"] == 1

    try:
        build_runtime_invocation_result_payload(
            answer="Done.",
            status="completed",
            evidence={"tenant": "acme"},
        )
    except ValueError as exc:
        assert "missing fields" in str(exc)
    else:
        raise AssertionError("runtime result without adapter metadata should fail")

    mismatched_result = {
        **payload,
        "provider": "unexpected-runtime",
    }
    try:
        normalize_runtime_invocation_result(mismatched_result, runtime_adapter)
    except ValueError as exc:
        assert "does not match adapter metadata" in str(exc)
    else:
        raise AssertionError("runtime result provider mismatch should fail")

    invalid_latency_result = {
        **payload,
        "latency_ms": -1,
    }
    try:
        normalize_runtime_invocation_result(invalid_latency_result, runtime_adapter)
    except ValueError as exc:
        assert "latency_ms" in str(exc)
    else:
        raise AssertionError("runtime result with invalid latency should fail")


def assert_runtime_persistence_evidence_link() -> None:
    writer = RuntimeInvocationWriter()
    service = PlatformAgentRunService(
        repository=object(),
        runtime_invocation_writer=writer,
    )
    request_payload = build_runtime_invocation_request_payload(
        tenant="acme",
        user_id="acme:alice",
        session_id="session-1",
        agent_id="agent-1",
        question="Summarize the contract.",
        metadata={"runtime_invocation_id": "runtime-invocation-1"},
    )
    result_payload = build_runtime_invocation_result_payload(
        answer="Done.",
        status="completed",
        evidence={"tenant": "acme", "agent_id": "agent-1"},
        runtime_adapter=describe_runtime_adapter({"agent_id": "agent-1"}),
        runtime_invocation_id="runtime-invocation-1",
        agent_run_id="agent-run-1",
        provider_run_id="provider-run-1",
        latency_ms=125,
        token_usage={"input_tokens": 12, "output_tokens": 4},
        completed_at="2026-07-21T00:00:00+00:00",
    )
    service.append_runtime_invocation_record_from_context(
        response_trace={
            "turn_id": "agent-run-1",
            "created_at": "2026-07-21T00:00:00+00:00",
        },
        context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-1",
            "agent_id": "agent-1",
            "question": "Summarize the contract.",
            "runtime_invocation_id": "runtime-invocation-1",
            "runtime_invocation_request": request_payload,
        },
        runtime_invocation_result=result_payload,
    )

    assert len(writer.records) == 1
    record = writer.records[0]
    assert record.id == "runtime-invocation-1"
    assert record.provider_id == result_payload["provider_id"]
    assert record.provider_run_id == "provider-run-1"
    assert record.agent_run_id == "agent-run-1"
    assert record.latency_ms == 125
    assert record.token_usage == {"input_tokens": 12, "output_tokens": 4}
    assert record.completed_at == "2026-07-21T00:00:00+00:00"
    assert (
        record.request_summary["metadata"]["runtime_invocation_id"]
        == record.response_summary["runtime_invocation_id"]
    )
    assert record.response_summary["provider_id"] == result_payload["provider_id"]
    assert record.response_summary["provider"] == result_payload["provider"]
    assert record.response_summary["mode"] == result_payload["mode"]
    assert record.response_summary["agent_run_id"] == "agent-run-1"
    assert record.response_summary["provider_run_id"] == "provider-run-1"
    assert record.response_summary["latency_ms"] == 125
    assert record.response_summary["token_usage"]["output_tokens"] == 4

    mismatched_result = {
        **result_payload,
        "runtime_invocation_id": "runtime-invocation-2",
    }
    previous_logger_disabled = agent_runs_logger.disabled
    agent_runs_logger.disabled = True
    try:
        service.append_runtime_invocation_record_from_context(
            response_trace={
                "turn_id": "agent-run-2",
                "created_at": "2026-07-21T00:01:00+00:00",
            },
            context={
                "tenant": "acme",
                "user_id": "acme:alice",
                "session_id": "session-1",
                "agent_id": "agent-1",
                "question": "Summarize the contract.",
                "runtime_invocation_id": "runtime-invocation-1",
                "runtime_invocation_request": request_payload,
            },
            runtime_invocation_result=mismatched_result,
        )
    finally:
        agent_runs_logger.disabled = previous_logger_disabled
    assert len(writer.records) == 1


def assert_finalize_preserves_provider_runtime_metadata() -> None:
    repository = AgentRunRepository()
    writer = RuntimeInvocationWriter()
    service = PlatformAgentRunService(
        repository=repository,
        runtime_invocation_writer=writer,
    )
    runtime_adapter = describe_runtime_adapter(
        {"agent_id": "agent-1", "agent_name": "Support Agent"},
    )
    request_payload = build_runtime_invocation_request_payload(
        tenant="acme",
        user_id="acme:alice",
        session_id="session-1",
        agent_id="agent-1",
        agent_name="Support Agent",
        question="Summarize the contract.",
        metadata={"runtime_invocation_id": "runtime-invocation-provider-native-1"},
    )
    runtime_boundary_result = {
        "answer": "Done.",
        "status": "completed",
        "evidence": {"tenant": "acme", "provider_trace_id": "trace-1"},
        "provider_id": runtime_adapter["id"],
        "provider": runtime_adapter["provider"],
        "mode": runtime_adapter["mode"],
        "runtime_invocation_id": "runtime-invocation-provider-native-1",
        "provider_run_id": "agentscope-provider-run-1",
        "completed_at": "2026-07-21T00:00:03+00:00",
        "latency_ms": 42,
        "token_usage": {"input_tokens": 10, "output_tokens": 12},
        "raw": {"provider_response": {"trace_id": "trace-1"}},
    }

    response = service.finalize_unrouted_response(
        build_runtime_invocation_result_payload=build_runtime_invocation_result_payload,
        response_record_context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-1",
            "agent_id": "agent-1",
            "agent_name": "Support Agent",
            "question": "Summarize the contract.",
            "runtime_adapter": runtime_adapter,
            "runtime_invocation_id": "runtime-invocation-provider-native-1",
            "runtime_invocation_request": request_payload,
        },
        answer="Done.",
        session_id="session-1",
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent-1",
        connector="knowledge_search",
        connector_source="runtime",
        routing_mode="runtime",
        routing_source="runtime_adapter",
        routing_reason="Provider-native runtime completed the request.",
        routing_error=None,
        agent_metadata={"agent_id": "agent-1", "agent_name": "Support Agent"},
        runtime_adapter=runtime_adapter,
        knowledge_hits=[],
        memory_hits=[],
        knowledge_payload={"hits": []},
        memory_payload={"hits": []},
        memory_saved=False,
        decision={"source": "runtime_adapter"},
        run_identity={
            "turn_id": "platform-agent-run-1",
            "created_at": "2026-07-21T00:00:00+00:00",
        },
        runtime_boundary_result=runtime_boundary_result,
    )

    assert response["turn_id"] == "platform-agent-run-1"
    assert len(repository.records) == 1
    persisted_result = repository.records[0]["runtime_invocation_result"]
    assert persisted_result["agent_run_id"] == "platform-agent-run-1"
    assert persisted_result["provider_run_id"] == "agentscope-provider-run-1"
    assert persisted_result["completed_at"] == "2026-07-21T00:00:03+00:00"
    assert persisted_result["latency_ms"] == 42
    assert persisted_result["token_usage"]["output_tokens"] == 12
    assert (
        persisted_result["raw"]["runtime_boundary_result"]["provider_run_id"]
        == "agentscope-provider-run-1"
    )

    assert len(writer.records) == 1
    record = writer.records[0]
    assert record.agent_run_id == "platform-agent-run-1"
    assert record.provider_run_id == "agentscope-provider-run-1"
    assert record.completed_at == "2026-07-21T00:00:03+00:00"
    assert record.latency_ms == 42
    assert record.token_usage == {"input_tokens": 10, "output_tokens": 12}
    assert record.response_summary["provider_run_id"] == "agentscope-provider-run-1"
    assert record.response_summary["latency_ms"] == 42


def assert_no_direct_agentscope_dependency() -> None:
    checked_files = (
        REPO_ROOT / "backend" / "runtime.py",
        REPO_ROOT / "backend" / "services" / "agent_runs.py",
    )
    for path in checked_files:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                imported = [node.module or ""]
            else:
                continue
            assert not any(
                name == "agentscope" or name.startswith("agentscope.")
                for name in imported
            ), f"{path} imports AgentScope directly: {imported}"


def main() -> None:
    assert_runtime_request_contract()
    assert_runtime_result_contract()
    assert_runtime_persistence_evidence_link()
    assert_finalize_preserves_provider_runtime_metadata()
    assert_no_direct_agentscope_dependency()
    print("phase 4.1 runtime invocation evidence contract ok")


if __name__ == "__main__":
    main()
