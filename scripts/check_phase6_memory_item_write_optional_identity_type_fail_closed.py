#!/usr/bin/env python3
"""Validate fail-closed optional identity types for memory-item writes."""

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
        "content": "typed optional identity",
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


def check_malformed_optional_identity_fails_before_write() -> list[str]:
    errors: list[str] = []
    for field, label in (
        ("agent_id", "agent id"),
        ("session_id", "session id"),
        ("source_run_id", "source run id"),
    ):
        expected = (
            f"Memory item write requires a non-blank {label} when present."
        )
        for value_name, value in (
            ("integer", 7),
            ("list", ["invalid"]),
            ("blank string", " "),
        ):
            record = memory_record(**{field: value})
            database = FakePostgresDatabase(memory_row(record))
            try:
                PostgresMemoryItemWriteRepository(database).append_memory_item(record)
            except ValueError as exc:
                if str(exc) != expected:
                    errors.append(
                        f"{label} {value_name} must raise the stable repository error"
                    )
            except (AttributeError, TypeError):
                errors.append(
                    f"{label} {value_name} must be normalized to ValueError"
                )
            else:
                errors.append(f"memory-item writes must reject {label} {value_name}")
            if database.transaction_calls != 0:
                errors.append(
                    f"{label} {value_name} must fail before the write transaction"
                )
    return errors


def check_valid_optional_identities_are_accepted() -> list[str]:
    errors: list[str] = []
    records = (
        memory_record(),
        memory_record(
            agent_id="agent-1",
            session_id="session-1",
            source_run_id="run-1",
        ),
    )
    for record in records:
        database = FakePostgresDatabase(memory_row(record))
        try:
            persisted = PostgresMemoryItemWriteRepository(
                database
            ).append_memory_item(record)
        except ValueError:
            errors.append("valid optional identities must remain accepted")
            continue
        if persisted != record:
            errors.append("optional identity validation must preserve the record")
        if database.transaction_calls != 1:
            errors.append("valid optional identities must reach the write transaction")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_write_identity(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    for field in ("record.agent_id", "record.session_id", "record.source_run_id"):
        if field not in validator_source:
            errors.append(f"write identity validation must cover {field}")
    if "value is not None" not in validator_source:
        errors.append("optional write identities must remain nullable")
    if "isinstance(value, str)" not in validator_source:
        errors.append("present optional write identities must require strings")
    check_name = (
        "check_phase6_memory_item_write_optional_identity_type_fail_closed.py"
    )
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the optional identity check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_optional_identity_fails_before_write(),
        *check_valid_optional_identities_are_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-optional-identity-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-optional-identity-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
