#!/usr/bin/env python3
"""Validate fail-closed expiry-time types for memory-item writes."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
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


def memory_record(*, expires_at: Any) -> MemoryItemRecord:
    return MemoryItemRecord(
        id="memory-1",
        tenant_id="acme",
        user_id="acme:alice",
        agent_id=None,
        session_id=None,
        content="typed expiry time",
        source_run_id=None,
        metadata={},
        expires_at=expires_at,
        created_at="2026-07-23T00:00:00+00:00",
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


def check_malformed_expiry_type_fails_before_write() -> list[str]:
    errors: list[str] = []
    for label, expires_at in (("integer", 7), ("list", [])):
        record = memory_record(expires_at=expires_at)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError as exc:
            if str(exc) != "Memory item memory-1 has an invalid expiry time.":
                errors.append(f"{label} expiry time must raise the stable error")
        except TypeError:
            errors.append(f"{label} expiry time must be normalized to ValueError")
        else:
            errors.append(f"memory-item writes must reject {label} expiry time")
        if database.transaction_calls != 0:
            errors.append(f"{label} expiry time must fail before the transaction")
    return errors


def check_supported_expiry_types_are_accepted() -> list[str]:
    errors: list[str] = []
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    for label, expires_at in (("permanent", None), ("string", future)):
        record = memory_record(expires_at=expires_at)
        database = FakePostgresDatabase(memory_row(record))
        try:
            persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(
                record
            )
        except ValueError:
            errors.append(f"{label} expiry types must remain accepted")
            continue
        if persisted != record:
            errors.append(f"expiry-type validation must preserve {label} records")
        if database.transaction_calls != 1:
            errors.append(f"valid {label} expiry types must reach the transaction")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_write_expiry(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    if "except (TypeError, ValueError)" not in validator_source:
        errors.append("expiry-time validation must normalize non-string values")
    check_name = "check_phase6_memory_item_write_expiry_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the expiry-time type check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_expiry_type_fails_before_write(),
        *check_supported_expiry_types_are_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-expiry-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-expiry-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
