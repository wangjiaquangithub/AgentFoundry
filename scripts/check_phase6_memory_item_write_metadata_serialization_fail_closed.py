#!/usr/bin/env python3
"""Validate fail-closed metadata serialization for memory-item writes."""

from __future__ import annotations

import json
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


def memory_record(*, metadata: dict[str, Any]) -> MemoryItemRecord:
    return MemoryItemRecord(
        id="memory-1",
        tenant_id="acme",
        user_id="acme:alice",
        agent_id=None,
        session_id=None,
        content="metadata serialization",
        source_run_id=None,
        metadata=metadata,
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
    def __init__(self, database: FakePostgresDatabase) -> None:
        self._database = database

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, parameters: tuple[Any, ...]) -> None:
        self._database.execute_parameters = parameters

    def fetchone(self) -> dict[str, Any]:
        return self._database.row


class FakeConnection:
    def __init__(self, database: FakePostgresDatabase) -> None:
        self._database = database

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return FakeCursor(self._database)


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self.row = row
        self.transaction_calls = 0
        self.execute_parameters: tuple[Any, ...] | None = None

    def transaction(self) -> FakeConnection:
        self.transaction_calls += 1
        return FakeConnection(self)


def check_invalid_metadata_fails_before_write() -> list[str]:
    errors: list[str] = []
    cases = (
        ("unsupported value", {"value": object()}),
        ("NaN", {"value": float("nan")}),
        ("positive infinity", {"value": float("inf")}),
        ("negative infinity", {"value": float("-inf")}),
    )
    for label, metadata in cases:
        record = memory_record(metadata=metadata)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError:
            pass
        else:
            errors.append(f"memory-item writes must reject metadata with {label}")
        if database.transaction_calls != 0:
            errors.append(f"metadata with {label} must fail before the transaction")
    return errors


def check_valid_metadata_is_serialized_once_before_write() -> list[str]:
    metadata = {"kind": "preference", "nested": {"enabled": True}}
    record = memory_record(metadata=metadata)
    database = FakePostgresDatabase(memory_row(record))
    try:
        persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(record)
    except ValueError:
        return ["valid JSON metadata must be accepted"]
    errors: list[str] = []
    if persisted != record:
        errors.append("metadata serialization must preserve the persisted record")
    if database.transaction_calls != 1:
        errors.append("valid metadata must reach the write transaction")
    if database.execute_parameters is None:
        errors.append("valid metadata must reach the write statement")
    else:
        serialized_metadata = database.execute_parameters[7]
        if not isinstance(serialized_metadata, str):
            errors.append("metadata must be serialized before cursor execution")
        elif json.loads(serialized_metadata) != metadata:
            errors.append("serialized metadata must preserve the JSON value")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    serialization_call = "serialized_metadata = _serialize_memory_item_metadata(record)"
    transaction_call = "with self._database.transaction() as connection:"
    append_source = source.split("def append_memory_item(", maxsplit=1)[1]
    if serialization_call not in append_source:
        errors.append("memory-item writes must serialize metadata before persistence")
    elif append_source.index(serialization_call) > append_source.index(transaction_call):
        errors.append("metadata serialization must precede the transaction")
    if "allow_nan=False" not in source:
        errors.append("metadata serialization must reject non-finite JSON numbers")
    check_name = "check_phase6_memory_item_write_metadata_serialization_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the metadata serialization check")
    return errors


def main() -> int:
    errors = [
        *check_invalid_metadata_fails_before_write(),
        *check_valid_metadata_is_serialized_once_before_write(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-metadata-serialization] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-metadata-serialization] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
