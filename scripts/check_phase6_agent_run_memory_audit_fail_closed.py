#!/usr/bin/env python3
"""Validate fail-closed Agent-run long-term-memory audit persistence."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
MAIN = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.memories import (  # noqa: E402
    PlatformMemoryService,
    PlatformMemoryServiceError,
)


class MemoryRepository:
    def __init__(self) -> None:
        self.records: list[dict[str, Any]] = []

    def append_capped(self, **kwargs: Any) -> dict[str, Any]:
        record = dict(kwargs["record"])
        self.records.append(record)
        return record


class AuditWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> Any:
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def append_turn(
    service: PlatformMemoryService,
    *,
    question: str = "记住 ACME-42",
) -> bool:
    return service.append_agent_turn_if_enabled(
        enabled=True,
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        question=question,
        answer="Recorded.",
        tool_calls=[{"tool_name": "enterprise_get_ticket_status", "result": {}}],
        knowledge_base_ids=["kb-support"],
        max_records=20,
    )


def expect_service_error(service: PlatformMemoryService, label: str) -> list[str]:
    try:
        append_turn(service)
    except PlatformMemoryServiceError as exc:
        errors: list[str] = []
        if exc.status_code != 500:
            errors.append(f"{label} must surface as HTTP 500")
        if exc.detail != "Agent-run memory audit persistence is unavailable":
            errors.append(f"{label} must expose the stable service error detail")
        return errors
    return [f"{label} must fail closed"]


def check_success_contract() -> list[str]:
    repository = MemoryRepository()
    writer = AuditWriter()
    service = PlatformMemoryService(repository=repository, audit_event_writer=writer)
    memory_saved = append_turn(service)
    errors: list[str] = []
    if not memory_saved or len(repository.records) != 1:
        errors.append("successful Agent-run memory persistence must report saved")
    if len(writer.records) != 1:
        return errors + ["successful Agent-run memory persistence must append one audit"]

    record = repository.records[0]
    event = writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:alice",
        "event_type": "memory_item.created",
        "target_type": "memory_item",
        "target_id": record["id"],
        "created_at": record["created_at"],
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"memory audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-1",
        "fact_count": len(record["facts"]),
        "tool_names": record["tool_names"],
        "knowledge_base_ids": record["knowledge_base_ids"],
        "keywords": record["keywords"],
    }
    if event.payload != expected_payload:
        errors.append("memory audit payload must contain the stable evidence contract")
    return errors


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        errors += expect_service_error(
            PlatformMemoryService(
                repository=MemoryRepository(),
                audit_event_writer=AuditWriter(failure=failure),
            ),
            "Agent-run memory audit persistence failure",
        )

    blank_writer = AuditWriter()
    original_append = blank_writer.append_audit_event

    def append_without_id(record: Any) -> Any:
        return replace(original_append(record), id="")

    blank_writer.append_audit_event = append_without_id
    errors += expect_service_error(
        PlatformMemoryService(
            repository=MemoryRepository(),
            audit_event_writer=blank_writer,
        ),
        "blank persisted Agent-run memory audit id",
    )
    errors += expect_service_error(
        PlatformMemoryService(repository=MemoryRepository()),
        "missing Agent-run memory audit writer",
    )
    return errors


def check_no_write_contract() -> list[str]:
    repository = MemoryRepository()
    service = PlatformMemoryService(repository=repository)
    errors: list[str] = []
    disabled_saved = service.append_agent_turn_if_enabled(
        enabled=False,
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        question="Remember ACME-42",
        answer="Not recorded.",
        tool_calls=[],
        knowledge_base_ids=[],
        max_records=20,
    )
    lookup_saved = append_turn(service, question="我刚才记录的工单是什么？")
    if disabled_saved or lookup_saved:
        errors.append("disabled or lookup-only memory turns must not report saved")
    if repository.records:
        errors.append("disabled or lookup-only memory turns must not persist memory")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if (
        "from services.memories import PlatformMemoryService, PlatformMemoryServiceError"
        not in api_source
    ):
        errors.append("Agent runtime route must import the memory service error")
    if api_source.count("except PlatformMemoryServiceError as exc:") != 3:
        errors.append(
            "memory reads plus routed and unrouted Agent runs must map audit failures"
        )
    if "audit_event_writer=audit_event_write_repository" not in main_source:
        errors.append("production memory composition must inject the audit writer")
    if "check_phase6_agent_run_memory_audit_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory audit fail-closed check")
    return errors


def main() -> int:
    errors = (
        check_success_contract()
        + check_failure_contract()
        + check_no_write_contract()
        + check_route_composition_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-memory-audit-fail-closed] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-memory-audit-fail-closed] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
