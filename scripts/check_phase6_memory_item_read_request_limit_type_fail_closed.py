#!/usr/bin/env python3
"""Validate fail-closed request limit types for memory-item list reads."""

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


class FakeSQLiteResult:
    def fetchall(self) -> list[dict[str, Any]]:
        return []


class FakeSQLiteConnection:
    def __enter__(self) -> FakeSQLiteConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: Any) -> FakeSQLiteResult:
        return FakeSQLiteResult()


class FakeSQLiteDatabase:
    def __init__(self) -> None:
        self.connect_calls = 0

    def connect(self) -> FakeSQLiteConnection:
        self.connect_calls += 1
        return FakeSQLiteConnection()


class FakePostgresCursor:
    def __enter__(self) -> FakePostgresCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        return []


class FakePostgresConnection:
    def __enter__(self) -> FakePostgresConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakePostgresCursor:
        return FakePostgresCursor()


class FakePostgresDatabase:
    def __init__(self) -> None:
        self.connect_calls = 0

    def connect(self) -> FakePostgresConnection:
        self.connect_calls += 1
        return FakePostgresConnection()


def database_factories() -> tuple[tuple[str, Callable[[], Any], type[Any]], ...]:
    return (
        ("SQLite", FakeSQLiteDatabase, SQLiteMemoryItemReadRepository),
        ("PostgreSQL", FakePostgresDatabase, PostgresMemoryItemReadRepository),
    )


def check_invalid_limit_types_fail_before_database_access() -> list[str]:
    errors: list[str] = []
    invalid_values = (None, True, False, 1.5, "10", [10])
    expected = "Memory item read requires an integer request limit."
    for backend, database_factory, repository_type in database_factories():
        for value in invalid_values:
            database = database_factory()
            repository = repository_type(database)
            try:
                repository.list_memory_items(tenant_id="acme", limit=value)
            except ValueError as exc:
                if str(exc) != expected:
                    errors.append(f"{backend} list must normalize invalid limit types")
            except TypeError:
                errors.append(f"{backend} list must normalize limit type errors")
            else:
                errors.append(f"{backend} list must reject invalid limit types")
            if database.connect_calls != 0:
                errors.append(f"{backend} invalid limit must fail before connect")
    return errors


def check_integer_limits_reach_database() -> list[str]:
    errors: list[str] = []
    for backend, database_factory, repository_type in database_factories():
        for value in (-1, 0, 1, 50, 100, 101):
            database = database_factory()
            repository = repository_type(database)
            try:
                result = repository.list_memory_items(
                    tenant_id="acme",
                    limit=value,
                )
            except ValueError:
                errors.append(f"{backend} list must accept integer limits")
                continue
            if result != []:
                errors.append(f"{backend} list must preserve an empty result")
            if database.connect_calls != 1:
                errors.append(f"{backend} integer limit must reach the database")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    helper = "_clamp_memory_item_read_request_limit("
    if source.count(helper) != 3:
        errors.append("the helper and both list paths must validate request limits")
    if "isinstance(limit, bool) or not isinstance(limit, int)" not in source:
        errors.append("request limit validation must reject bool and non-integers")
    check_name = "check_phase6_memory_item_read_request_limit_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the request limit type check")
    return errors


def main() -> int:
    errors = [
        *check_invalid_limit_types_fail_before_database_access(),
        *check_integer_limits_reach_database(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-request-limit-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-request-limit-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
