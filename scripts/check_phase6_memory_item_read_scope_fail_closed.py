#!/usr/bin/env python3
"""Validate fail-closed scope handling for memory-item reads."""

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
        "agent_id": "agent-support",
        "session_id": "session-1",
        "content": "remember this",
        "source_run_id": "run-1",
        "metadata": {},
        "expires_at": None,
        "created_at": "2026-07-23T00:00:00+00:00",
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

    def execute(
        self,
        _query: str,
        _parameters: list[Any] | tuple[Any, ...],
    ) -> FakeSQLiteResult:
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


def rejects(operation: Callable[[], object]) -> bool:
    try:
        operation()
    except ValueError:
        return True
    return False


def check_list_scope_fail_closed() -> list[str]:
    errors: list[str] = []
    mismatches = (
        ("tenant", {"tenant_id": "other"}),
        ("user", {"user_id": "acme:bob"}),
        ("agent", {"agent_id": "agent-other"}),
        ("session", {"session_id": "session-other"}),
        ("source run", {"source_run_id": "run-other"}),
    )
    for backend, repository_factory in (
        (
            "SQLite",
            lambda row: SQLiteMemoryItemReadRepository(FakeSQLiteDatabase(row)),
        ),
        (
            "PostgreSQL",
            lambda row: PostgresMemoryItemReadRepository(FakePostgresDatabase(row)),
        ),
    ):
        for label, overrides in mismatches:
            repository = repository_factory(memory_row(**overrides))
            if not rejects(
                lambda repository=repository: repository.list_memory_items(
                    tenant_id="acme",
                    user_id="acme:alice",
                    agent_id="agent-support",
                    session_id="session-1",
                    source_run_id="run-1",
                )
            ):
                errors.append(f"{backend} list must reject another {label}")
    return errors


def check_get_scope_fail_closed() -> list[str]:
    errors: list[str] = []
    mismatches = (
        ("tenant", {"tenant_id": "other"}),
        ("item", {"id": "item-other"}),
    )
    for backend, repository_factory in (
        (
            "SQLite",
            lambda row: SQLiteMemoryItemReadRepository(FakeSQLiteDatabase(row)),
        ),
        (
            "PostgreSQL",
            lambda row: PostgresMemoryItemReadRepository(FakePostgresDatabase(row)),
        ),
    ):
        for label, overrides in mismatches:
            repository = repository_factory(memory_row(**overrides))
            if not rejects(
                lambda repository=repository: repository.get_memory_item(
                    tenant_id="acme",
                    memory_item_id="item-1",
                )
            ):
                errors.append(f"{backend} get must reject another {label}")
    return errors


def check_matching_scope_accepted() -> list[str]:
    errors: list[str] = []
    for backend, repository in (
        (
            "SQLite",
            SQLiteMemoryItemReadRepository(FakeSQLiteDatabase(memory_row())),
        ),
        (
            "PostgreSQL",
            PostgresMemoryItemReadRepository(FakePostgresDatabase(memory_row())),
        ),
    ):
        try:
            repository.list_memory_items(
                tenant_id="acme",
                user_id="acme:alice",
                agent_id="agent-support",
                session_id="session-1",
                source_run_id="run-1",
            )
            repository.get_memory_item(tenant_id="acme", memory_item_id="item-1")
        except ValueError:
            errors.append(f"{backend} reads must accept matching scope")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("_validate_memory_item_read_result(") != 5:
        errors.append("the shared validator and all memory-item read paths are required")
    if "PostgreSQL memory item read returned another" in source:
        errors.append("the shared read validator must use backend-neutral errors")
    if "check_phase6_memory_item_read_scope_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory-item scope check")
    return errors


def main() -> int:
    errors = [
        *check_list_scope_fail_closed(),
        *check_get_scope_fail_closed(),
        *check_matching_scope_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-scope] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-scope] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
