#!/usr/bin/env python3
"""Validate fail-closed required identities for memory-item reads."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
MEMORY_ITEMS = ROOT / "backend" / "persistence" / "memory_items.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.memory_items import (  # noqa: E402
    PostgresMemoryItemReadRepository,
    SQLiteMemoryItemReadRepository,
)


def memory_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "id": "item-1",
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": None,
        "session_id": None,
        "content": "Remember this",
        "source_run_id": None,
        "metadata": {},
        "expires_at": None,
        "created_at": "2026-07-22T00:00:00+00:00",
    }
    row.update(overrides)
    return row


class FakeSQLiteResult:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def fetchall(self) -> list[dict[str, Any]]:
        return [self._row]

    def fetchone(self) -> dict[str, Any]:
        return self._row


class FakeSQLiteConnection:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def __enter__(self) -> FakeSQLiteConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: Any) -> FakeSQLiteResult:
        return FakeSQLiteResult(self._row)


class FakeSQLiteDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def connect(self) -> FakeSQLiteConnection:
        return FakeSQLiteConnection(self._row)


class FakePostgresCursor:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def __enter__(self) -> FakePostgresCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        return [self._row]

    def fetchone(self) -> dict[str, Any]:
        return self._row


class FakePostgresConnection:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def __enter__(self) -> FakePostgresConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakePostgresCursor:
        return FakePostgresCursor(self._row)


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def connect(self) -> FakePostgresConnection:
        return FakePostgresConnection(self._row)


def repository_factories() -> tuple[
    tuple[str, Callable[[dict[str, Any]], Any]],
    ...,
]:
    return (
        (
            "SQLite",
            lambda row: SQLiteMemoryItemReadRepository(FakeSQLiteDatabase(row)),
        ),
        (
            "PostgreSQL",
            lambda row: PostgresMemoryItemReadRepository(FakePostgresDatabase(row)),
        ),
    )


def read_operations(repository: Any) -> tuple[tuple[str, Callable[[], Any]], ...]:
    return (
        ("list", lambda: repository.list_memory_items(tenant_id="acme")),
        (
            "get",
            lambda: repository.get_memory_item(
                tenant_id="acme",
                memory_item_id="item-1",
            ),
        ),
    )


def check_required_identities_fail_closed() -> list[str]:
    errors: list[str] = []
    cases = (
        ("id", " ", "id"),
        ("tenant_id", " ", "tenant id"),
        ("user_id", " ", "user id"),
        ("user_id", None, "user id"),
    )
    for field, value, label in cases:
        expected = f"Memory item read requires a non-blank {label}."
        row = memory_row(**{field: value})
        for backend, repository_factory in repository_factories():
            for operation, read in read_operations(repository_factory(row)):
                try:
                    read()
                except ValueError as exc:
                    if str(exc) != expected:
                        errors.append(
                            f"{backend} {operation} must report invalid {label}"
                        )
                    continue
                errors.append(f"{backend} {operation} must reject invalid {label}")
    return errors


def check_valid_required_identities_accepted() -> list[str]:
    errors: list[str] = []
    for backend, repository_factory in repository_factories():
        for operation, read in read_operations(repository_factory(memory_row())):
            try:
                result = read()
            except ValueError:
                errors.append(f"{backend} {operation} must accept valid identities")
                continue
            record = result[0] if operation == "list" else result
            if record.user_id != "acme:alice":
                errors.append(f"{backend} {operation} must preserve valid identities")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("_validate_memory_item_read_identity(record)") != 4:
        errors.append("all memory-item read paths must validate required identities")
    if "if not isinstance(value, str) or not value.strip():" not in source:
        errors.append("memory-item reads must reject malformed or blank identities")
    if "check_phase6_memory_item_read_required_identity_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the required read identity check")
    return errors


def main() -> int:
    errors = [
        *check_required_identities_fail_closed(),
        *check_valid_required_identities_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-required-identity] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-required-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
