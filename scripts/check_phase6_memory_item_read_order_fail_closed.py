#!/usr/bin/env python3
"""Validate fail-closed ordering for memory-item list reads."""

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


def memory_row(item_id: str, created_at: str) -> dict[str, Any]:
    return {
        "id": item_id,
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-1",
        "content": item_id,
        "source_run_id": "run-1",
        "metadata": {},
        "expires_at": None,
        "created_at": created_at,
    }


class FakeSQLiteResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def fetchall(self) -> list[dict[str, Any]]:
        return self._rows


class FakeSQLiteConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def __enter__(self) -> FakeSQLiteConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(
        self,
        _query: str,
        _parameters: list[Any],
    ) -> FakeSQLiteResult:
        return FakeSQLiteResult(self._rows)


class FakeSQLiteDatabase:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def connect(self) -> FakeSQLiteConnection:
        return FakeSQLiteConnection(self._rows)


class FakePostgresCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def __enter__(self) -> FakePostgresCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        return self._rows


class FakePostgresConnection:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def __enter__(self) -> FakePostgresConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakePostgresCursor:
        return FakePostgresCursor(self._rows)


class FakePostgresDatabase:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def connect(self) -> FakePostgresConnection:
        return FakePostgresConnection(self._rows)


def repository_factories() -> tuple[
    tuple[str, Callable[[list[dict[str, Any]]], Any]],
    ...,
]:
    return (
        (
            "SQLite",
            lambda rows: SQLiteMemoryItemReadRepository(FakeSQLiteDatabase(rows)),
        ),
        (
            "PostgreSQL",
            lambda rows: PostgresMemoryItemReadRepository(FakePostgresDatabase(rows)),
        ),
    )


def check_created_time_order_fail_closed() -> list[str]:
    errors: list[str] = []
    rows = [
        memory_row("item-old", "2026-07-22T00:00:00+00:00"),
        memory_row("item-new", "2026-07-23T00:00:00+00:00"),
    ]
    for backend, repository_factory in repository_factories():
        try:
            repository_factory(rows).list_memory_items(tenant_id="acme")
        except ValueError:
            continue
        errors.append(f"{backend} list must reject ascending creation times")
    return errors


def check_id_tiebreaker_fail_closed() -> list[str]:
    errors: list[str] = []
    created_at = "2026-07-23T00:00:00+00:00"
    rows = [memory_row("item-a", created_at), memory_row("item-b", created_at)]
    for backend, repository_factory in repository_factories():
        try:
            repository_factory(rows).list_memory_items(tenant_id="acme")
        except ValueError:
            continue
        errors.append(f"{backend} list must reject an ascending ID tiebreaker")
    return errors


def check_descending_order_accepted() -> list[str]:
    errors: list[str] = []
    tied_at = "2026-07-22T00:00:00+00:00"
    rows = [
        memory_row("item-new", "2026-07-23T00:00:00+00:00"),
        memory_row("item-b", tied_at),
        memory_row("item-a", tied_at),
    ]
    for backend, repository_factory in repository_factories():
        try:
            records = repository_factory(rows).list_memory_items(tenant_id="acme")
        except ValueError:
            errors.append(f"{backend} list must accept descending result order")
            continue
        if [record.id for record in records] != ["item-new", "item-b", "item-a"]:
            errors.append(f"{backend} list must preserve descending result order")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("_validate_memory_item_read_order(records)") != 2:
        errors.append("both memory-item list paths must validate result order")
    if "current_key >= previous_key" not in source:
        errors.append("memory-item result ordering must be strict")
    if "check_phase6_memory_item_read_order_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory-item order check")
    return errors


def main() -> int:
    errors = [
        *check_created_time_order_fail_closed(),
        *check_id_tiebreaker_fail_closed(),
        *check_descending_order_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-order] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-order] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
