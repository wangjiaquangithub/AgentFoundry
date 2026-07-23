#!/usr/bin/env python3
"""Validate fail-closed required request identity for memory-item reads."""

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

    def fetchone(self) -> None:
        return None


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

    def fetchone(self) -> None:
        return None


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


def check_invalid_tenant_fails_before_database_access() -> list[str]:
    errors: list[str] = []
    invalid_values = (None, 7, ["invalid"], "", " ")
    expected = "Memory item read requires a non-blank request tenant id."
    for backend, database_factory, repository_type in database_factories():
        for value in invalid_values:
            for operation in ("list", "get"):
                database = database_factory()
                repository = repository_type(database)
                try:
                    if operation == "list":
                        repository.list_memory_items(tenant_id=value)
                    else:
                        repository.get_memory_item(
                            tenant_id=value,
                            memory_item_id="item-1",
                        )
                except ValueError as exc:
                    if str(exc) != expected:
                        errors.append(
                            f"{backend} {operation} must normalize invalid tenant ids"
                        )
                except (AttributeError, TypeError):
                    errors.append(
                        f"{backend} {operation} must normalize tenant id type errors"
                    )
                else:
                    errors.append(
                        f"{backend} {operation} must reject invalid tenant ids"
                    )
                if database.connect_calls != 0:
                    errors.append(
                        f"{backend} {operation} invalid tenant ids must fail before connect"
                    )
    return errors


def check_invalid_item_id_fails_before_database_access() -> list[str]:
    errors: list[str] = []
    invalid_values = (None, 7, ["invalid"], "", " ")
    expected = "Memory item read requires a non-blank request item id."
    for backend, database_factory, repository_type in database_factories():
        for value in invalid_values:
            database = database_factory()
            repository = repository_type(database)
            try:
                repository.get_memory_item(
                    tenant_id="acme",
                    memory_item_id=value,
                )
            except ValueError as exc:
                if str(exc) != expected:
                    errors.append(f"{backend} get must normalize invalid item ids")
            except (AttributeError, TypeError):
                errors.append(f"{backend} get must normalize item id type errors")
            else:
                errors.append(f"{backend} get must reject invalid item ids")
            if database.connect_calls != 0:
                errors.append(
                    f"{backend} get invalid item ids must fail before connect"
                )
    return errors


def check_valid_required_identity_reaches_database() -> list[str]:
    errors: list[str] = []
    for backend, database_factory, repository_type in database_factories():
        for operation in ("list", "get"):
            database = database_factory()
            repository = repository_type(database)
            try:
                if operation == "list":
                    result = repository.list_memory_items(tenant_id="acme")
                else:
                    result = repository.get_memory_item(
                        tenant_id="acme",
                        memory_item_id="item-1",
                    )
            except ValueError:
                errors.append(
                    f"{backend} {operation} must accept valid required identity"
                )
                continue
            if result not in ([], None):
                errors.append(f"{backend} {operation} must preserve empty results")
            if database.connect_calls != 1:
                errors.append(
                    f"{backend} {operation} valid identity must reach the database"
                )
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator = "_validate_memory_item_read_request_identity("
    if source.count(validator) != 7:
        errors.append(
            "the validator and all memory-item read paths must validate required request identity"
        )
    if source.count(
        '_validate_memory_item_read_request_identity("tenant id", tenant_id)'
    ) != 4:
        errors.append("all memory-item read paths must validate the request tenant")
    if source.count(
        '_validate_memory_item_read_request_identity("item id", memory_item_id)'
    ) != 2:
        errors.append("both memory-item get paths must validate the request item id")
    check_name = (
        "check_phase6_memory_item_read_request_required_identity_fail_closed.py"
    )
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the request identity check")
    return errors


def main() -> int:
    errors = [
        *check_invalid_tenant_fails_before_database_access(),
        *check_invalid_item_id_fails_before_database_access(),
        *check_valid_required_identity_reaches_database(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-request-required-identity] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-request-required-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
