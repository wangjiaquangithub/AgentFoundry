#!/usr/bin/env python3
"""Validate fail-closed created-time handling for memory-item writes."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MEMORY_ITEMS = BACKEND_DIR / "persistence" / "memory_items.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.memory_items import (  # noqa: E402
    MemoryItemRecord,
    PostgresMemoryItemWriteRepository,
)


def memory_record(*, item_id: str, created_at: str) -> MemoryItemRecord:
    return MemoryItemRecord(
        id=item_id,
        tenant_id="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        content=item_id,
        source_run_id="run-1",
        metadata={"kind": "preference"},
        expires_at=None,
        created_at=created_at,
    )


def memory_row(record: MemoryItemRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "user_id": record.user_id,
        "agent_id": record.agent_id,
        "session_id": record.session_id,
        "content": record.content,
        "source_run_id": record.source_run_id,
        "metadata": record.metadata,
        "expires_at": record.expires_at,
        "created_at": record.created_at,
    }


class FakeCursor:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, parameters: tuple[Any, ...]) -> None:
        self.parameters = parameters

    def fetchone(self) -> dict[str, Any]:
        return self._row


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self._cursor


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self.cursor_instance = FakeCursor(row)
        self.transaction_calls = 0

    def transaction(self) -> FakeConnection:
        self.transaction_calls += 1
        return FakeConnection(self.cursor_instance)


def check_timezone_aware_created_at_writes() -> list[str]:
    errors: list[str] = []
    for label, created_at in (
        ("utc", "2026-07-23T00:00:00+00:00"),
        ("offset", "2026-07-23T08:00:00+08:00"),
    ):
        record = memory_record(item_id=label, created_at=created_at)
        database = FakePostgresDatabase(memory_row(record))
        persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(
            record
        )
        if persisted != record:
            errors.append(f"PostgreSQL write must preserve {label} created time")
        if database.transaction_calls != 1:
            errors.append(f"PostgreSQL write must persist {label} created time")
        if database.cursor_instance.parameters[9] != created_at:
            errors.append(f"PostgreSQL write must preserve {label} created value")
    return errors


def check_invalid_created_at_fails_before_write() -> list[str]:
    errors: list[str] = []
    for label, created_at in (
        ("malformed", "not-a-timestamp"),
        ("timezone-naive", "2026-07-23T00:00:00"),
    ):
        record = memory_record(item_id=label, created_at=created_at)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError:
            pass
        else:
            errors.append(f"PostgreSQL write must reject {label} created time")
        if database.transaction_calls != 0:
            errors.append(
                f"PostgreSQL write must reject {label} created time before a transaction"
            )
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validation_call = "_validate_memory_item_write_created_at(record, as_of=as_of)"
    transaction_call = "with self._database.transaction() as connection:"
    append_source = source.split("def append_memory_item(", maxsplit=1)[1]
    if validation_call not in append_source:
        errors.append("memory-item writes must validate created time")
    elif append_source.index(validation_call) > append_source.index(transaction_call):
        errors.append("created-time validation must precede the write transaction")
    if "check_phase6_memory_item_write_created_at_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the created-time write check")
    return errors


def main() -> int:
    errors = [
        *check_timezone_aware_created_at_writes(),
        *check_invalid_created_at_fails_before_write(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-write-created-at] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-write-created-at] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
