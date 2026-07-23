#!/usr/bin/env python3
"""Validate fail-closed content types for memory-item reads."""

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


def check_malformed_content_fails_closed() -> list[str]:
    errors: list[str] = []
    cases = (None, 7, ["invalid"], "", " ")
    expected = "Memory item read requires non-blank string content."
    for value in cases:
        for backend, repository_factory in repository_factories():
            for operation, read in read_operations(
                repository_factory(memory_row(content=value))
            ):
                try:
                    read()
                except ValueError as exc:
                    if str(exc) != expected:
                        errors.append(
                            f"{backend} {operation} must normalize invalid content"
                        )
                    continue
                except (AttributeError, TypeError):
                    errors.append(
                        f"{backend} {operation} must normalize content type errors"
                    )
                    continue
                errors.append(f"{backend} {operation} must reject invalid content")
    return errors


def check_non_blank_string_content_is_accepted() -> list[str]:
    errors: list[str] = []
    for backend, repository_factory in repository_factories():
        for operation, read in read_operations(repository_factory(memory_row())):
            try:
                result = read()
            except ValueError:
                errors.append(f"{backend} {operation} must accept valid content")
                continue
            record = result[0] if operation == "list" else result
            if record.content != "Remember this":
                errors.append(f"{backend} {operation} must preserve valid content")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_read_content(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    if "isinstance(record.content, str)" not in validator_source:
        errors.append("memory-item read content must require strings")
    if "record.content.strip()" not in validator_source:
        errors.append("memory-item read content must reject blank strings")
    if source.count("_validate_memory_item_read_content(record)") != 4:
        errors.append("all memory-item read paths must validate content")
    check_name = "check_phase6_memory_item_read_content_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the read content-type check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_content_fails_closed(),
        *check_non_blank_string_content_is_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-content-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-content-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
