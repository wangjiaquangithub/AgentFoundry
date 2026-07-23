#!/usr/bin/env python3
"""Validate fail-closed optional request identity for memory-item lists."""

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


def check_invalid_optional_identity_fails_before_database_access() -> list[str]:
    errors: list[str] = []
    invalid_values = (7, ["invalid"], "", " ")
    fields = (
        ("user_id", "user id"),
        ("agent_id", "agent id"),
        ("session_id", "session id"),
        ("source_run_id", "source run id"),
    )
    for backend, database_factory, repository_type in database_factories():
        for parameter_name, field_name in fields:
            expected = (
                "Memory item read requires a non-blank request "
                f"{field_name} when present."
            )
            for value in invalid_values:
                database = database_factory()
                repository = repository_type(database)
                try:
                    repository.list_memory_items(
                        tenant_id="acme",
                        **{parameter_name: value},
                    )
                except ValueError as exc:
                    if str(exc) != expected:
                        errors.append(
                            f"{backend} list must normalize invalid {field_name} values"
                        )
                except (AttributeError, TypeError):
                    errors.append(
                        f"{backend} list must normalize {field_name} type errors"
                    )
                else:
                    errors.append(
                        f"{backend} list must reject invalid {field_name} values"
                    )
                if database.connect_calls != 0:
                    errors.append(
                        f"{backend} invalid {field_name} must fail before connect"
                    )
    return errors


def check_omitted_and_valid_optional_identity_reach_database() -> list[str]:
    errors: list[str] = []
    valid_cases = (
        {},
        {
            "user_id": "acme:alice",
            "agent_id": "agent-1",
            "session_id": "session-1",
            "source_run_id": "run-1",
        },
    )
    for backend, database_factory, repository_type in database_factories():
        for parameters in valid_cases:
            database = database_factory()
            repository = repository_type(database)
            try:
                result = repository.list_memory_items(
                    tenant_id="acme",
                    **parameters,
                )
            except ValueError:
                errors.append(
                    f"{backend} list must accept omitted and valid optional identity"
                )
                continue
            if result != []:
                errors.append(f"{backend} list must preserve an empty result")
            if database.connect_calls != 1:
                errors.append(
                    f"{backend} valid optional identity must reach the database"
                )
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator = "_validate_memory_item_read_optional_request_identity("
    if source.count(validator) != 3:
        errors.append(
            "the validator and both list paths must validate optional request identity"
        )
    validation_block = """for field_name, value in (
            ("user id", user_id),
            ("agent id", agent_id),
            ("session id", session_id),
            ("source run id", source_run_id),
        ):
            _validate_memory_item_read_optional_request_identity(field_name, value)"""
    if source.count(validation_block) != 2:
        errors.append("both list paths must validate all optional request identity")
    check_name = (
        "check_phase6_memory_item_read_request_optional_identity_fail_closed.py"
    )
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the optional request identity check")
    return errors


def main() -> int:
    errors = [
        *check_invalid_optional_identity_fails_before_database_access(),
        *check_omitted_and_valid_optional_identity_reach_database(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-request-optional-identity] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-request-optional-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
