#!/usr/bin/env python3
"""Validate fail-closed Agent-run long-term-memory persistence evidence."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
MEMORY_REPOSITORY = BACKEND_DIR / "repositories" / "memories.py"
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
    def __init__(
        self,
        *,
        failure: Exception | None = None,
        persisted_id: str | None = None,
        return_none: bool = False,
    ) -> None:
        self.failure = failure
        self.persisted_id = persisted_id
        self.return_none = return_none
        self.records: list[dict[str, Any]] = []

    def append_capped(self, **kwargs: Any) -> dict[str, Any] | None:
        if self.failure is not None:
            raise self.failure
        record = dict(kwargs["record"])
        self.records.append(record)
        if self.return_none:
            return None
        if self.persisted_id is not None:
            record["id"] = self.persisted_id
        return record


class AuditWriter:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> Any:
        self.records.append(record)
        return record


def append_turn(service: PlatformMemoryService) -> bool:
    return service.append_agent_turn_if_enabled(
        enabled=True,
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        question="记住 ACME-42",
        answer="Recorded.",
        tool_calls=[],
        knowledge_base_ids=["kb-support"],
        max_records=20,
    )


def expect_service_error(
    repository: MemoryRepository,
    label: str,
) -> list[str]:
    audit_writer = AuditWriter()
    service = PlatformMemoryService(
        repository=repository,
        audit_event_writer=audit_writer,
    )
    try:
        append_turn(service)
    except PlatformMemoryServiceError as exc:
        errors: list[str] = []
        if exc.status_code != 500:
            errors.append(f"{label} must surface as HTTP 500")
        if exc.detail != "Agent-run memory persistence is unavailable":
            errors.append(f"{label} must expose the stable service error detail")
        if audit_writer.records:
            errors.append(f"{label} must not append a success audit event")
        return errors
    return [f"{label} must fail closed"]


def check_success_contract() -> list[str]:
    repository = MemoryRepository()
    audit_writer = AuditWriter()
    service = PlatformMemoryService(
        repository=repository,
        audit_event_writer=audit_writer,
    )
    memory_saved = append_turn(service)
    errors: list[str] = []
    if not memory_saved or len(repository.records) != 1:
        errors.append("successful Agent-run memory persistence must report saved")
    if len(audit_writer.records) != 1:
        errors.append("successful memory persistence must append one audit event")
    return errors


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    for failure in (
        RuntimeError("memory unavailable"),
        ValueError("memory rejected"),
    ):
        errors += expect_service_error(
            MemoryRepository(failure=failure),
            "Agent-run memory persistence failure",
        )
    errors += expect_service_error(
        MemoryRepository(persisted_id=""),
        "blank persisted Agent-run memory id",
    )
    errors += expect_service_error(
        MemoryRepository(persisted_id="another-memory-id"),
        "mismatched persisted Agent-run memory id",
    )
    errors += expect_service_error(
        MemoryRepository(return_none=True),
        "missing persisted Agent-run memory evidence",
    )
    return errors


def check_composition_and_gate() -> list[str]:
    api_source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    repository_source = MEMORY_REPOSITORY.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if api_source.count("except PlatformMemoryServiceError as exc:") != 2:
        errors.append("routed and unrouted Agent runs must map memory failures")
    if "return _platform_memory_from_memory_item(persisted)" not in repository_source:
        errors.append("production memory repository must return persisted evidence")
    if "check_phase6_agent_run_memory_persistence_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory persistence check")
    return errors


def main() -> int:
    errors = (
        check_success_contract()
        + check_failure_contract()
        + check_composition_and_gate()
    )
    if errors:
        for error in errors:
            print(
                f"[phase6-agent-run-memory-persistence-fail-closed] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-agent-run-memory-persistence-fail-closed] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
