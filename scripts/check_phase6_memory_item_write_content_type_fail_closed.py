#!/usr/bin/env python3
"""Validate fail-closed content types for memory-item writes."""

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


def memory_record(**overrides: Any) -> MemoryItemRecord:
    values: dict[str, Any] = {
        "id": "memory-1",
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": None,
        "session_id": None,
        "content": "valid memory content",
        "source_run_id": None,
        "metadata": {},
        "expires_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    values.update(overrides)
    return MemoryItemRecord(**values)


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


def check_malformed_content_fails_before_write() -> list[str]:
    errors: list[str] = []
    cases = (
        ("None content", None),
        ("integer content", 7),
        ("list content", ["invalid"]),
        ("empty content", ""),
        ("blank content", " "),
    )
    expected_message = "Memory item write requires non-blank string content."
    for label, content in cases:
        record = memory_record(content=content)
        database = FakePostgresDatabase(memory_row(record))
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError as exc:
            if str(exc) != expected_message:
                errors.append(f"{label} must raise the stable repository error")
        except (AttributeError, TypeError):
            errors.append(f"{label} must be normalized to ValueError")
        else:
            errors.append(f"memory-item writes must reject {label}")
        if database.transaction_calls != 0:
            errors.append(f"{label} must fail before the write transaction")
    return errors


def check_non_blank_string_content_is_accepted() -> list[str]:
    record = memory_record()
    database = FakePostgresDatabase(memory_row(record))
    try:
        persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(
            record
        )
    except ValueError:
        return ["non-blank string content must remain accepted"]
    errors: list[str] = []
    if persisted != record:
        errors.append("content type validation must preserve the record")
    if database.transaction_calls != 1:
        errors.append("valid content must reach the write transaction")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_write_content(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    append_source = source.split(
        "    def append_memory_item(", maxsplit=1
    )[1].split("\n        return persisted", maxsplit=1)[0]
    if "isinstance(record.content, str)" not in validator_source:
        errors.append("memory-item write content must require strings")
    if "record.content.strip()" not in validator_source:
        errors.append("memory-item write content must reject blank strings")
    validator_call = "_validate_memory_item_write_content(record)"
    if validator_call not in append_source:
        errors.append("memory-item writes must validate content")
    elif append_source.index(validator_call) > append_source.index(
        "with self._database.transaction()"
    ):
        errors.append("memory-item content must be validated before the transaction")
    check_name = "check_phase6_memory_item_write_content_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the content-type check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_content_fails_before_write(),
        *check_non_blank_string_content_is_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-content-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-content-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
