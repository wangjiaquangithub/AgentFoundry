#!/usr/bin/env python3
"""Validate fail-closed metadata object types for memory-item writes."""

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


def memory_record(*, metadata: Any) -> MemoryItemRecord:
    return MemoryItemRecord(
        id="memory-1",
        tenant_id="acme",
        user_id="acme:alice",
        agent_id=None,
        session_id=None,
        content="metadata type validation",
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


def check_non_object_metadata_fails_before_write() -> list[str]:
    errors: list[str] = []
    cases: tuple[tuple[str, Any], ...] = (
        ("list", []),
        ("populated list", ["tag"]),
        ("string", "metadata"),
        ("integer", 123),
        ("null", None),
        ("boolean", True),
    )
    expected_message = (
        "Memory item memory-1 write requires metadata to be a JSON object."
    )
    for label, metadata in cases:
        record = memory_record(metadata=metadata)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError as exc:
            if str(exc) != expected_message:
                errors.append(f"{label} metadata must return the stable type error")
        else:
            errors.append(f"memory-item writes must reject {label} metadata")
        if database.transaction_calls != 0:
            errors.append(f"{label} metadata must fail before the transaction")
        if database.execute_parameters is not None:
            errors.append(f"{label} metadata must fail before cursor execution")
    return errors


def check_object_metadata_still_writes() -> list[str]:
    errors: list[str] = []
    for label, metadata in (
        ("empty object", {}),
        ("nested object", {"kind": "preference", "nested": {"enabled": True}}),
    ):
        record = memory_record(metadata=metadata)
        database = FakePostgresDatabase(memory_row(record))
        try:
            persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(
                record
            )
        except ValueError:
            errors.append(f"valid {label} metadata must be accepted")
            continue
        if persisted != record:
            errors.append(f"valid {label} metadata must preserve the record")
        if database.transaction_calls != 1:
            errors.append(f"valid {label} metadata must reach the transaction")
        if database.execute_parameters is None:
            errors.append(f"valid {label} metadata must reach cursor execution")
        else:
            serialized_metadata = database.execute_parameters[7]
            if not isinstance(serialized_metadata, str):
                errors.append(f"valid {label} metadata must be serialized")
            elif json.loads(serialized_metadata) != metadata:
                errors.append(f"valid {label} metadata must preserve its JSON value")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    type_check = "if not isinstance(record.metadata, dict):"
    serialization_call = "json.dumps(record.metadata"
    serializer_source = source.split(
        "def _serialize_memory_item_metadata(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    if type_check not in serializer_source:
        errors.append("memory-item writes must require metadata objects")
    elif serializer_source.index(type_check) > serializer_source.index(
        serialization_call
    ):
        errors.append("metadata object validation must precede serialization")
    check_name = "check_phase6_memory_item_write_metadata_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the metadata type check")
    return errors


def main() -> int:
    errors = [
        *check_non_object_metadata_fails_before_write(),
        *check_object_metadata_still_writes(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-write-metadata-type] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-write-metadata-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
