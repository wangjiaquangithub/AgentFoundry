#!/usr/bin/env python3
"""Validate fail-closed Agent-run long-term-memory read audit persistence."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
AGENT_RUN_SERVICE = BACKEND_DIR / "services" / "agent_runs.py"
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
    def __init__(self, records: list[dict[str, Any]] | None = None) -> None:
        self.records = records or []
        self.list_calls = 0

    def list(self, **_: Any) -> list[dict[str, Any]]:
        self.list_calls += 1
        return list(self.records)


class AuditWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> Any:
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def build_context(
    service: PlatformMemoryService,
    *,
    enabled: bool = True,
) -> dict[str, Any]:
    return service.build_agent_run_context(
        enabled=enabled,
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        agent_run_id="run-memory-read-1",
        question="我刚才关注的工单是什么？",
        max_records=20,
        limit=5,
    )


def expect_service_error(service: PlatformMemoryService, label: str) -> list[str]:
    try:
        build_context(service)
    except PlatformMemoryServiceError as exc:
        errors: list[str] = []
        if exc.status_code != 500:
            errors.append(f"{label} must surface as HTTP 500")
        if exc.detail != "Agent-run memory read audit persistence is unavailable":
            errors.append(f"{label} must expose the stable service error detail")
        return errors
    return [f"{label} must fail closed"]


def check_success_contract() -> list[str]:
    repository = MemoryRepository(
        [
            {
                "id": "memory-1",
                "question": "关注 ACME-42",
                "facts": ["用户关注工单：ACME-42"],
                "keywords": ["刚才", "工单"],
            }
        ]
    )
    writer = AuditWriter()
    payload = build_context(
        PlatformMemoryService(repository=repository, audit_event_writer=writer)
    )
    errors: list[str] = []
    if len(payload["memory_hits"]) != 1 or len(writer.records) != 1:
        return ["enabled memory reads must return hits and append one audit"]

    event = writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:alice",
        "event_type": "memory_item.retrieved",
        "target_type": "agent_run",
        "target_id": "run-memory-read-1",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"memory read audit {field} must equal {expected!r}")
    expected_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-1",
        "agent_run_id": "run-memory-read-1",
        "hit_count": 1,
        "memory_item_ids": ["memory-1"],
    }
    if event.payload != expected_payload:
        errors.append("memory read audit payload must contain compact evidence only")
    for forbidden in ("question", "snippet", "facts", "answer"):
        if forbidden in event.payload:
            errors.append(f"memory read audit payload must not contain {forbidden}")
    return errors


def check_zero_hit_and_disabled_contract() -> list[str]:
    zero_repository = MemoryRepository()
    writer = AuditWriter()
    payload = build_context(
        PlatformMemoryService(repository=zero_repository, audit_event_writer=writer)
    )
    errors: list[str] = []
    if payload["memory_hits"] or len(writer.records) != 1:
        errors.append("enabled zero-hit memory reads must append one audit")
    elif writer.records[0].payload["hit_count"] != 0:
        errors.append("zero-hit memory read audit must record hit_count 0")

    disabled_repository = MemoryRepository()
    disabled_writer = AuditWriter()
    disabled_payload = build_context(
        PlatformMemoryService(
            repository=disabled_repository,
            audit_event_writer=disabled_writer,
        ),
        enabled=False,
    )
    if disabled_payload["memory_hits"]:
        errors.append("disabled memory must not return hits")
    if disabled_repository.list_calls or disabled_writer.records:
        errors.append("disabled memory must neither read nor append audit evidence")
    return errors


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        errors += expect_service_error(
            PlatformMemoryService(
                repository=MemoryRepository(),
                audit_event_writer=AuditWriter(failure=failure),
            ),
            "memory read audit persistence failure",
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
        "blank persisted memory read audit id",
    )
    errors += expect_service_error(
        PlatformMemoryService(repository=MemoryRepository()),
        "missing memory read audit writer",
    )
    return errors


def check_composition_and_gate() -> list[str]:
    api_source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    service_source = AGENT_RUN_SERVICE.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if api_source.count("except PlatformMemoryServiceError as exc:") != 3:
        errors.append("Agent runtime must map memory read audit failures to HTTP errors")
    for argument in ("session_id=", "agent_run_id="):
        if argument not in service_source:
            errors.append(f"Agent-run memory context must pass {argument[:-1]}")
    if "check_phase6_agent_run_memory_read_audit_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory read audit check")
    return errors


def main() -> int:
    errors = (
        check_success_contract()
        + check_zero_hit_and_disabled_contract()
        + check_failure_contract()
        + check_composition_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-memory-read-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-memory-read-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
