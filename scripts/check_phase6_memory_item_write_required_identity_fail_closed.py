#!/usr/bin/env python3
"""Validate fail-closed required identity fields for memory-item writes."""

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


def memory_record(
    *,
    item_id: str = "memory-1",
    tenant_id: str = "acme",
    user_id: str = "acme:alice",
) -> MemoryItemRecord:
    return MemoryItemRecord(
        id=item_id,
        tenant_id=tenant_id,
        user_id=user_id,
        agent_id=None,
        session_id=None,
        content="required identity",
        source_run_id=None,
        metadata={},
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
        self.cursor_instance = FakeCursor(row)
        self.transaction_calls = 0

    def transaction(self) -> FakeConnection:
        self.transaction_calls += 1
        return FakeConnection(self.cursor_instance)


def check_blank_required_identity_fails_before_write() -> list[str]:
    errors: list[str] = []
    cases = (
        ("item id", {"item_id": " "}),
        ("tenant id", {"tenant_id": "\t"}),
        ("user id", {"user_id": ""}),
    )
    for label, overrides in cases:
        record = memory_record(**overrides)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError:
            pass
        else:
            errors.append(f"memory-item writes must reject a blank {label}")
        if database.transaction_calls != 0:
            errors.append(f"blank {label} must fail before the write transaction")
    return errors


def check_non_blank_required_identity_is_accepted() -> list[str]:
    record = memory_record()
    database = FakePostgresDatabase(memory_row(record))
    try:
        persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(
            record
        )
    except ValueError:
        return ["non-blank required identity must be accepted"]
    errors: list[str] = []
    if persisted != record:
        errors.append("required identity validation must preserve the record")
    if database.transaction_calls != 1:
        errors.append("valid required identity must reach the write transaction")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validation_call = "_validate_memory_item_write_identity(record)"
    transaction_call = "with self._database.transaction() as connection:"
    append_source = source.split("def append_memory_item(", maxsplit=1)[1]
    if validation_call not in append_source:
        errors.append("memory-item writes must validate required identity")
    elif append_source.index(validation_call) > append_source.index(transaction_call):
        errors.append("required identity validation must precede the transaction")
    for field in ("record.id", "record.tenant_id", "record.user_id"):
        if field not in source:
            errors.append(f"required identity validation must cover {field}")
    check_name = "check_phase6_memory_item_write_required_identity_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the required-identity check")
    return errors


def main() -> int:
    errors = [
        *check_blank_required_identity_fails_before_write(),
        *check_non_blank_required_identity_is_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-required-identity] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-required-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
