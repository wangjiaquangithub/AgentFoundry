#!/usr/bin/env python3
"""Validate fail-closed future created-time handling for memory-item writes."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
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

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

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
        self._cursor = FakeCursor(row)
        self.transaction_calls = 0

    def transaction(self) -> FakeConnection:
        self.transaction_calls += 1
        return FakeConnection(self._cursor)


def check_past_created_at_writes() -> list[str]:
    errors: list[str] = []
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    offset = timezone(timedelta(hours=8))
    for label, created_at in (
        ("utc-past", past.isoformat()),
        ("offset-past", past.astimezone(offset).isoformat()),
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
    return errors


def check_future_created_at_fails_before_write() -> list[str]:
    errors: list[str] = []
    future = datetime.now(timezone.utc) + timedelta(days=1)
    offset = timezone(timedelta(hours=8))
    for label, created_at in (
        ("utc-future", future.isoformat()),
        ("offset-future", future.astimezone(offset).isoformat()),
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
    if "if created_at > as_of:" not in source:
        errors.append("memory-item writes must reject future created times")
    if "_validate_memory_item_write_created_at(record, as_of=as_of)" not in source:
        errors.append("memory-item writes must use their captured validation time")
    if (
        "check_phase6_memory_item_write_future_created_at_fail_closed.py"
        not in gate_source
    ):
        errors.append("Phase 6 backend gate must run the future created-time check")
    return errors


def main() -> int:
    errors = [
        *check_past_created_at_writes(),
        *check_future_created_at_fails_before_write(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-future-created-at] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-future-created-at] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
