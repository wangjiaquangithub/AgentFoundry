#!/usr/bin/env python3
"""Validate phase 4.4 runtime invocation error result contract."""

from __future__ import annotations

import ast
import logging
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    build_runtime_invocation_error_result_payload,
    build_runtime_invocation_request_payload,
    describe_runtime_adapter,
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


def assert_error_result_contract() -> None:
    runtime_adapter = describe_runtime_adapter(
        {"agent_id": "agent-1", "agent_name": "Support Agent"},
    )
    payload = build_runtime_invocation_error_result_payload(
        error="Provider timed out.",
        evidence={
            "tenant": "acme",
            "user_id": "acme:alice",
            "agent_id": "agent-1",
            "session_id": "session-1",
        },
        runtime_adapter=runtime_adapter,
        runtime_invocation_id="runtime-invocation-error-1",
        agent_run_id="agent-run-error-1",
        completed_at="2026-07-22T00:00:00+00:00",
        latency_ms=1250,
        raw={"retryable": True},
    )

    assert payload["status"] == "failed"
    assert payload["answer"] == ""
    assert payload["error"] == "Provider timed out."
    assert payload["provider_id"] == runtime_adapter["id"]
    assert payload["provider"] == "agentscope"
    assert payload["mode"] == "local-service"
    assert payload["runtime_invocation_id"] == "runtime-invocation-error-1"
    assert payload["raw"]["retryable"] is True
    assert payload["raw"]["runtime_error"] == {
        "message": "Provider timed out.",
        "status": "failed",
    }


def assert_failure_result_requires_error_evidence() -> None:
    runtime_adapter = describe_runtime_adapter({"agent_id": "agent-1"})
    valid_payload = build_runtime_invocation_error_result_payload(
        error="Provider timed out.",
        evidence={"tenant": "acme", "agent_id": "agent-1"},
        runtime_adapter=runtime_adapter,
        runtime_invocation_id="runtime-invocation-error-1",
    )

    missing_error = {
        **valid_payload,
        "error": "",
        "raw": {"runtime_error": {"message": "", "status": "failed"}},
    }
    try:
        normalize_runtime_invocation_result(missing_error, runtime_adapter)
    except ValueError as exc:
        assert "non-empty error" in str(exc)
    else:
        raise AssertionError("failed runtime result without error should fail")

    missing_raw_error = {**valid_payload, "raw": {}}
    try:
        normalize_runtime_invocation_result(missing_raw_error, runtime_adapter)
    except ValueError as exc:
        assert "raw.runtime_error" in str(exc)
    else:
        raise AssertionError("failed runtime result without raw.runtime_error should fail")

    mismatched_raw_error = {
        **valid_payload,
        "raw": {
            "runtime_error": {
                "message": "Different error.",
                "status": "failed",
            },
        },
    }
    try:
        normalize_runtime_invocation_result(mismatched_raw_error, runtime_adapter)
    except ValueError as exc:
        assert "must match error" in str(exc)
    else:
        raise AssertionError("failed runtime result with mismatched error should fail")


def assert_error_result_persists_to_runtime_invocation_record() -> None:
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
        metadata={"runtime_invocation_id": "runtime-invocation-error-1"},
    )
    result_payload = build_runtime_invocation_error_result_payload(
        error="Provider timed out.",
        evidence={"tenant": "acme", "agent_id": "agent-1"},
        runtime_adapter=describe_runtime_adapter({"agent_id": "agent-1"}),
        runtime_invocation_id="runtime-invocation-error-1",
        agent_run_id="agent-run-error-1",
        completed_at="2026-07-22T00:00:00+00:00",
    )

    service.append_runtime_invocation_record_from_context(
        response_trace={
            "turn_id": "agent-run-error-1",
            "created_at": "2026-07-22T00:00:00+00:00",
        },
        context={
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-1",
            "agent_id": "agent-1",
            "question": "Summarize the contract.",
            "runtime_invocation_id": "runtime-invocation-error-1",
            "runtime_invocation_request": request_payload,
        },
        runtime_invocation_result=result_payload,
    )

    assert len(writer.records) == 1
    record = writer.records[0]
    assert record.id == "runtime-invocation-error-1"
    assert record.error == "Provider timed out."
    assert record.response_summary["status"] == "failed"
    assert (
        record.response_summary["raw"]["runtime_error"]["message"]
        == "Provider timed out."
    )

    mismatched_result = {
        **result_payload,
        "runtime_invocation_id": "runtime-invocation-error-2",
    }
    previous_logger_disabled = agent_runs_logger.disabled
    agent_runs_logger.disabled = True
    try:
        service.append_runtime_invocation_record_from_context(
            response_trace={
                "turn_id": "agent-run-error-2",
                "created_at": "2026-07-22T00:01:00+00:00",
            },
            context={
                "tenant": "acme",
                "user_id": "acme:alice",
                "session_id": "session-1",
                "agent_id": "agent-1",
                "question": "Summarize the contract.",
                "runtime_invocation_id": "runtime-invocation-error-1",
                "runtime_invocation_request": request_payload,
            },
            runtime_invocation_result=mismatched_result,
        )
    finally:
        agent_runs_logger.disabled = previous_logger_disabled
    assert len(writer.records) == 1


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
    assert_error_result_contract()
    assert_failure_result_requires_error_evidence()
    assert_error_result_persists_to_runtime_invocation_record()
    assert_no_direct_agentscope_dependency()
    print("phase 4.4 runtime invocation error contract ok")


if __name__ == "__main__":
    main()
