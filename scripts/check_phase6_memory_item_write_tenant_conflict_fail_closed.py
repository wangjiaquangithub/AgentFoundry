#!/usr/bin/env python3
"""Validate fail-closed tenant conflicts for memory-item writes."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MEMORY_ITEMS = ROOT / "backend" / "persistence" / "memory_items.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.memory_items import (  # noqa: E402
    MemoryItemRecord,
    PostgresMemoryItemWriteRepository,
)


def memory_record() -> MemoryItemRecord:
    return MemoryItemRecord(
        id="shared-item-id",
        tenant_id="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        content="tenant-scoped memory",
        source_run_id="run-1",
        metadata={"kind": "preference"},
        expires_at=None,
        created_at=datetime.now(timezone.utc).isoformat(),
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
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row
        self.query = ""

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, query: str, _parameters: tuple[Any, ...]) -> None:
        self.query = query

    def fetchone(self) -> dict[str, Any] | None:
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
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.cursor_instance = FakeCursor(row)

    def transaction(self) -> FakeConnection:
        return FakeConnection(self.cursor_instance)


def check_cross_tenant_conflict_fails_closed() -> list[str]:
    record = memory_record()
    database = FakePostgresDatabase(None)
    try:
        PostgresMemoryItemWriteRepository(database).append_memory_item(record)
    except ValueError as exc:
        if str(exc) != "Memory item upsert did not return a row.":
            return ["tenant conflict must report the missing upsert result"]
        return []
    return ["tenant conflict without a returned row must fail closed"]


def check_same_tenant_upsert_accepted() -> list[str]:
    record = memory_record()
    database = FakePostgresDatabase(memory_row(record))
    try:
        persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(record)
    except ValueError:
        return ["same-tenant upsert result must be accepted"]
    errors: list[str] = []
    if persisted != record:
        errors.append("same-tenant upsert must preserve the persisted record")
    query = " ".join(database.cursor_instance.query.split())
    if "WHERE memory_items.tenant_id = EXCLUDED.tenant_id" not in query:
        errors.append("memory-item upsert must guard conflicts by tenant")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    conflict_sql = source.split("ON CONFLICT (id) DO UPDATE SET", maxsplit=1)[1]
    update_sql, _returning_sql = conflict_sql.split("RETURNING", maxsplit=1)
    if "WHERE memory_items.tenant_id = EXCLUDED.tenant_id" not in update_sql:
        errors.append("memory-item upsert conflict must require the same tenant")
    set_sql, _where_sql = update_sql.split("WHERE", maxsplit=1)
    if "tenant_id = EXCLUDED.tenant_id" in set_sql:
        errors.append("memory-item upsert must not transfer tenant ownership")
    check_name = "check_phase6_memory_item_write_tenant_conflict_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the tenant-conflict check")
    return errors


def main() -> int:
    errors = [
        *check_cross_tenant_conflict_fails_closed(),
        *check_same_tenant_upsert_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-tenant-conflict] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-tenant-conflict] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
