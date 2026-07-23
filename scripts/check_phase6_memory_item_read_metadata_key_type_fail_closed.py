#!/usr/bin/env python3
"""Validate fail-closed metadata object key types for memory-item reads."""

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
        "agent_id": None,
        "session_id": None,
        "content": "Remember this",
        "source_run_id": None,
        "metadata": metadata,
        "expires_at": None,
        "created_at": "2026-07-22T00:00:00+00:00",
    }


class FakeResult:
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

    def execute(self, _query: str, _parameters: Any) -> FakeResult:
        return FakeResult(self._row)


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


def check_non_string_keys_fail_closed() -> list[str]:
    errors: list[str] = []
    cases: tuple[tuple[str, dict[Any, Any]], ...] = (
        ("integer key", {1: "value"}),
        ("null key", {None: "value"}),
        ("boolean key", {True: "value"}),
        ("float key", {1.5: "value"}),
        ("tuple key", {("nested",): "value"}),
        ("nested object key", {"nested": {1: "value"}}),
        ("object key inside list", {"nested": [{None: "value"}]}),
        ("object key inside tuple", {"nested": ({False: "value"},)}),
    )
    expected = "Memory item item-1 has invalid metadata JSON."
    for backend, repository_factory in repository_factories():
        for label, metadata in cases:
            for operation, read in read_operations(
                repository_factory(memory_row(metadata))
            ):
                try:
                    read()
                except ValueError as exc:
                    if str(exc) != expected:
                        errors.append(
                            f"{backend} {operation} {label} must use the stable error"
                        )
                else:
                    errors.append(f"{backend} {operation} must reject {label}")
    return errors


def check_string_keys_are_preserved() -> list[str]:
    errors: list[str] = []
    valid_cases: tuple[tuple[str, dict[str, Any]], ...] = (
        ("empty object", {}),
        (
            "nested objects",
            {
                "kind": "preference",
                "nested": {"enabled": True},
                "items": [{"name": "primary"}],
                "tuple_items": ({"name": "secondary"},),
            },
        ),
    )
    for backend, repository_factory in repository_factories():
        for label, metadata in valid_cases:
            for operation, read in read_operations(
                repository_factory(memory_row(metadata))
            ):
                try:
                    result = read()
                except ValueError:
                    errors.append(
                        f"{backend} {operation} must accept valid {label} keys"
                    )
                    continue
                record = result[0] if operation == "list" else result
                if record.metadata != metadata:
                    errors.append(
                        f"{backend} {operation} must preserve valid {label} metadata"
                    )
    return errors


def check_key_validation_precedes_serialization() -> list[str]:
    errors: list[str] = []
    metadata = {1: {"invalid": object()}}
    expected = "Memory item item-1 has invalid metadata JSON."
    for backend, repository_factory in repository_factories():
        for operation, read in read_operations(
            repository_factory(memory_row(metadata))
        ):
            try:
                read()
            except ValueError as exc:
                if str(exc) != expected:
                    errors.append(
                        f"{backend} {operation} key validation must precede serialization"
                    )
            else:
                errors.append(
                    f"{backend} {operation} invalid keys must fail before serialization"
                )
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    parser_source = source.split("def _metadata_from_json(", maxsplit=1)[1].split(
        "\n\ndef ", maxsplit=1
    )[0]
    key_check = "if any(not isinstance(key, str) for key in current_value):"
    serialization_call = "json.dumps(parsed"
    if key_check not in parser_source:
        errors.append("memory-item reads must require string metadata object keys")
    elif parser_source.index(key_check) > parser_source.index(serialization_call):
        errors.append("metadata key validation must precede serialization")
    if "return parsed" not in parser_source:
        errors.append("validated metadata must still be returned")
    check_name = "check_phase6_memory_item_read_metadata_key_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the metadata key type check")
    return errors


def main() -> int:
    errors = [
        *check_non_string_keys_fail_closed(),
        *check_string_keys_are_preserved(),
        *check_key_validation_precedes_serialization(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-metadata-key-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-metadata-key-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
