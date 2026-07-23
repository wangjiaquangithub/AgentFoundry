#!/usr/bin/env python3
"""Validate immutable completion audit events for Phase 6 agent runs."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "backend" / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from backend.services.agent_runs import (  # noqa: E402
    PlatformAgentRunService,
    PlatformAgentRunServiceError,
)


class AgentRunRepository:
    def __init__(self) -> None:
        self.records: list[dict] = []

    def append(self, record: dict) -> dict:
        self.records.append(record)
        return record


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def response_trace() -> dict:
    return {
        "turn_id": "turn-1",
        "created_at": "2026-07-23T00:00:00+00:00",
        "evidence": {
            "tool_call_count": 2,
            "knowledge_hit_count": 3,
            "memory_hit_count": 1,
            "memory_saved": True,
        },
    }


def run_context() -> dict:
    return {
        "session_id": "session-1",
        "agent_id": "agent-1",
        "agent_name": "Support Agent",
        "tenant": "acme",
        "user_id": "acme:alice",
        "question": "This content must not enter the audit payload.",
        "runtime_adapter": {"provider": "agentscope"},
        "runtime_invocation_id": "runtime-1",
    }


def check_completed_audit_event() -> list[str]:
    repository = AgentRunRepository()
    writer = AuditEventWriter()
    service = PlatformAgentRunService(
        repository=repository,
        audit_event_writer=writer,
    )
    persisted = service.append_response_record_from_context(
        response_trace=response_trace(),
        context=run_context(),
        answer="This answer must not enter the audit payload.",
        response={"status": "completed"},
    )

    errors: list[str] = []
    if repository.records != [persisted]:
        errors.append("completed run must be persisted before the audit event")
    if len(writer.records) != 1:
        return errors + ["completed run must append exactly one audit event"]

    event = writer.records[0]
    expected_fields = {
        "event_type": "agent_run.completed",
        "target_type": "agent_run",
        "target_id": "turn-1",
        "tenant_id": "acme",
        "actor_user_id": "acme:alice",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "turn_id": "turn-1",
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-1",
        "session_id": "session-1",
        "runtime_invocation_id": "runtime-1",
        "tool_call_count": 2,
        "knowledge_hit_count": 3,
        "memory_hit_count": 1,
        "memory_saved": True,
    }
    if event.payload != expected_payload:
        errors.append(
            "audit payload must contain only the completion evidence contract"
        )
    if {"question", "answer"} & set(event.payload):
        errors.append("audit payload must not include question or answer content")
    return errors


def check_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = PlatformAgentRunService(
        repository=AgentRunRepository(),
        audit_event_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.append_response_record_from_context(
            response_trace=response_trace(),
            context=run_context(),
            answer="Done.",
            response={"status": "completed"},
        )
    except PlatformAgentRunServiceError as exc:
        if exc.status_code != 500:
            errors.append("audit persistence failure must surface as HTTP 500")
    else:
        errors.append("audit persistence failure must fail closed")

    blank_id_writer = AuditEventWriter()
    original_append = blank_id_writer.append_audit_event

    def append_without_id(record):
        return replace(original_append(record), id="")

    blank_id_writer.append_audit_event = append_without_id
    blank_id_service = PlatformAgentRunService(
        repository=AgentRunRepository(),
        audit_event_writer=blank_id_writer,
    )
    try:
        blank_id_service.append_response_record_from_context(
            response_trace=response_trace(),
            context=run_context(),
            answer="Done.",
            response={"status": "completed"},
        )
    except PlatformAgentRunServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_composition_and_gate() -> list[str]:
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    service_start = main_source.index("def _platform_agent_run_service()")
    service_end = main_source.index(
        "def _raise_platform_agent_run_service_error",
        service_start,
    )
    service_source = main_source[service_start:service_end]
    if "audit_event_writer=audit_event_write_repository" not in service_source:
        errors.append("backend composition must inject the production audit writer")
    if "scripts/check_phase6_agent_run_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the agent run audit check")
    return errors


def main() -> int:
    errors = (
        check_completed_audit_event()
        + check_fail_closed()
        + check_composition_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
