#!/usr/bin/env python3
"""Validate fail-closed metadata parsing for memory-item reads."""

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


def memory_row(metadata: Any) -> dict[str, Any]:
    return {
        "id": "item-1",
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-1",
        "content": "Remember this",
        "source_run_id": "run-1",
        "metadata": metadata,
        "expires_at": None,
        "created_at": "2026-07-22T00:00:00+00:00",
    }


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


def check_invalid_metadata_fails_closed() -> list[str]:
    errors: list[str] = []
    invalid_values = ("{not-json", "[]", "null", None, 7)
    expected_message = "Memory item item-1 has invalid metadata JSON."
    for backend, repository_factory in repository_factories():
        for value in invalid_values:
            for operation, read in read_operations(
                repository_factory(memory_row(value))
            ):
                try:
                    read()
                except ValueError as exc:
                    if str(exc) != expected_message:
                        errors.append(
                            f"{backend} {operation} must normalize invalid metadata errors"
                        )
                    continue
                errors.append(f"{backend} {operation} must reject invalid metadata")
    return errors


def check_valid_metadata_accepted() -> list[str]:
    errors: list[str] = []
    for value in ({"source": "dict"}, '{"source": "json"}'):
        for backend, repository_factory in repository_factories():
            for operation, read in read_operations(
                repository_factory(memory_row(value))
            ):
                try:
                    result = read()
                except ValueError:
                    errors.append(f"{backend} {operation} must accept object metadata")
                    continue
                record = result[0] if operation == "list" else result
                if record.metadata.get("source") not in {"dict", "json"}:
                    errors.append(f"{backend} {operation} must preserve object metadata")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "except (json.JSONDecodeError, TypeError) as exc:" not in source:
        errors.append("memory-item metadata parsing must normalize decode and type errors")
    if 'raise ValueError(f"Memory item {item_id} has invalid metadata JSON.") from exc' not in source:
        errors.append("memory-item metadata parsing must raise a stable repository error")
    if "check_phase6_memory_item_read_metadata_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory-item metadata read check")
    return errors


def main() -> int:
    errors = [
        *check_invalid_metadata_fails_closed(),
        *check_valid_metadata_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-metadata] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-metadata] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
