#!/usr/bin/env python3
"""Validate fail-closed created-time handling for memory-item reads."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MEMORY_ITEMS = BACKEND_DIR / "persistence" / "memory_items.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.database import SQLiteDatabase  # noqa: E402
from backend.persistence.memory_items import (  # noqa: E402
    PostgresMemoryItemReadRepository,
    SQLiteMemoryItemReadRepository,
)


def memory_row(*, item_id: str, created_at: str) -> dict[str, Any]:
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


def create_sqlite_database(created_at: str) -> tuple[tempfile.TemporaryDirectory[str], SQLiteDatabase]:
    temp_dir = tempfile.TemporaryDirectory()
    database = SQLiteDatabase(
        database_url=f"sqlite:///{Path(temp_dir.name) / 'memory.db'}"
    )
    row = memory_row(item_id="item-1", created_at=created_at)
    with database.connect() as connection:
        connection.execute(
            """
            CREATE TABLE memory_items (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              agent_id TEXT,
              session_id TEXT,
              content TEXT NOT NULL,
              source_run_id TEXT,
              metadata TEXT NOT NULL,
              expires_at TEXT,
              created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            INSERT INTO memory_items (
              id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["tenant_id"],
                row["user_id"],
                row["agent_id"],
                row["session_id"],
                row["content"],
                row["source_run_id"],
                "{}",
                row["expires_at"],
                row["created_at"],
            ),
        )
    return temp_dir, database


class FakeCursor:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        return [self._row]

    def fetchone(self) -> dict[str, Any]:
        return self._row


class FakeConnection:
    def __init__(self, row: dict[str, Any]) -> None:
        self._cursor = FakeCursor(row)

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self._cursor


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def connect(self) -> FakeConnection:
        return FakeConnection(self._row)


def read_all_paths(created_at: str) -> None:
    temp_dir, sqlite_database = create_sqlite_database(created_at)
    try:
        sqlite_repository = SQLiteMemoryItemReadRepository(sqlite_database)
        sqlite_repository.list_memory_items(tenant_id="acme")
        sqlite_repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="item-1",
        )
    finally:
        temp_dir.cleanup()

    postgres_repository = PostgresMemoryItemReadRepository(
        FakePostgresDatabase(memory_row(item_id="item-1", created_at=created_at))
    )
    postgres_repository.list_memory_items(tenant_id="acme")
    postgres_repository.get_memory_item(
        tenant_id="acme",
        memory_item_id="item-1",
    )


def check_timezone_aware_created_at_reads() -> list[str]:
    errors: list[str] = []
    for label, created_at in (
        ("UTC", "2026-07-23T00:00:00+00:00"),
        ("offset", "2026-07-23T08:00:00+08:00"),
    ):
        try:
            read_all_paths(created_at)
        except ValueError:
            errors.append(f"memory-item reads must accept {label} created times")
    return errors


def check_invalid_created_at_reads_fail_closed() -> list[str]:
    errors: list[str] = []
    for label, created_at in (
        ("malformed", "not-a-timestamp"),
        ("timezone-naive", "2026-07-23T00:00:00"),
    ):
        temp_dir, sqlite_database = create_sqlite_database(created_at)
        try:
            sqlite_repository = SQLiteMemoryItemReadRepository(sqlite_database)
            for operation in (
                lambda: sqlite_repository.list_memory_items(tenant_id="acme"),
                lambda: sqlite_repository.get_memory_item(
                    tenant_id="acme", memory_item_id="item-1"
                ),
            ):
                try:
                    operation()
                except ValueError:
                    continue
                errors.append(f"SQLite reads must reject {label} created times")
        finally:
            temp_dir.cleanup()

        postgres_repository = PostgresMemoryItemReadRepository(
            FakePostgresDatabase(
                memory_row(item_id="item-1", created_at=created_at)
            )
        )
        for operation in (
            lambda: postgres_repository.list_memory_items(tenant_id="acme"),
            lambda: postgres_repository.get_memory_item(
                tenant_id="acme", memory_item_id="item-1"
            ),
        ):
            try:
                operation()
            except ValueError:
                continue
            errors.append(f"PostgreSQL reads must reject {label} created times")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("_validate_memory_item_read_created_at(record)") != 4:
        errors.append("all memory-item read paths must validate created time")
    if "check_phase6_memory_item_read_created_at_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the created-time read check")
    return errors


def main() -> int:
    errors = [
        *check_timezone_aware_created_at_reads(),
        *check_invalid_created_at_reads_fail_closed(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-created-at] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-created-at] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
