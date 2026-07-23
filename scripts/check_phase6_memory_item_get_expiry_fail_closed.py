#!/usr/bin/env python3
"""Validate fail-closed expiry handling for single memory-item reads."""

from __future__ import annotations

import sys
import tempfile
from datetime import datetime, timedelta, timezone
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


def memory_row(*, item_id: str, expires_at: str | None) -> dict[str, Any]:
    return {
        "id": item_id,
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-1",
        "content": item_id,
        "source_run_id": "run-1",
        "metadata": {},
        "expires_at": expires_at,
        "created_at": "2026-07-23T00:00:00+00:00",
    }


def create_memory_table(database: SQLiteDatabase) -> None:
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


def insert_memory(
    database: SQLiteDatabase,
    *,
    item_id: str,
    expires_at: str | None,
) -> None:
    row = memory_row(item_id=item_id, expires_at=expires_at)
    with database.connect() as connection:
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


def check_sqlite_get_expiry_boundary() -> list[str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        database = SQLiteDatabase(
            database_url=f"sqlite:///{Path(temp_dir) / 'memory.db'}"
        )
        create_memory_table(database)
        now = datetime.now(timezone.utc)
        insert_memory(database, item_id="permanent", expires_at=None)
        insert_memory(
            database,
            item_id="future",
            expires_at=(now + timedelta(days=1)).isoformat(),
        )
        insert_memory(
            database,
            item_id="expired",
            expires_at=(now - timedelta(days=1)).isoformat(),
        )
        repository = SQLiteMemoryItemReadRepository(database)
        permanent = repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="permanent",
        )
        future = repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="future",
        )
        expired = repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="expired",
        )
    errors: list[str] = []
    if permanent is None or permanent.id != "permanent":
        errors.append("SQLite get must return permanent memory items")
    if future is None or future.id != "future":
        errors.append("SQLite get must return unexpired memory items")
    if expired is not None:
        errors.append("SQLite get must hide expired memory items")
    return errors


def check_sqlite_invalid_expiry_fails_closed() -> list[str]:
    errors: list[str] = []
    for item_id, expires_at in (
        ("malformed", "not-a-timestamp"),
        ("timezone-naive", "2999-01-01T00:00:00"),
    ):
        with tempfile.TemporaryDirectory() as temp_dir:
            database = SQLiteDatabase(
                database_url=f"sqlite:///{Path(temp_dir) / 'memory.db'}"
            )
            create_memory_table(database)
            insert_memory(database, item_id=item_id, expires_at=expires_at)
            try:
                SQLiteMemoryItemReadRepository(database).get_memory_item(
                    tenant_id="acme",
                    memory_item_id=item_id,
                )
            except ValueError:
                continue
        errors.append(f"SQLite get must fail closed on {item_id} expiry values")
    return errors


class FakeCursor:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...]) -> None:
        self.query = query
        self.parameters = parameters

    def fetchone(self) -> dict[str, Any] | None:
        return self._row


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self._cursor


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.cursor_instance = FakeCursor(row)

    def connect(self) -> FakeConnection:
        return FakeConnection(self.cursor_instance)


def postgres_get(row: dict[str, Any] | None) -> tuple[Any, FakeCursor]:
    database = FakePostgresDatabase(row)
    result = PostgresMemoryItemReadRepository(database).get_memory_item(
        tenant_id="acme",
        memory_item_id="item-1",
    )
    return result, database.cursor_instance


def check_postgres_get_expiry_boundary() -> list[str]:
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    result, cursor = postgres_get(memory_row(item_id="item-1", expires_at=future))
    errors: list[str] = []
    if result is None or result.id != "item-1":
        errors.append("PostgreSQL get must return unexpired memory items")
    if "AND (expires_at IS NULL OR expires_at > %s)" not in cursor.query:
        errors.append("PostgreSQL get must enforce the expiry predicate")
    if len(cursor.parameters) != 3:
        errors.append("PostgreSQL get expiry cutoff must be parameterized")
    else:
        try:
            cutoff = datetime.fromisoformat(str(cursor.parameters[2]))
        except ValueError:
            errors.append("PostgreSQL get expiry cutoff must be an ISO timestamp")
        else:
            if cutoff.tzinfo is None:
                errors.append(
                    "PostgreSQL get expiry cutoff must be timezone-aware"
                )
    return errors


def check_postgres_returned_expiry_fails_closed() -> list[str]:
    errors: list[str] = []
    expired = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    for label, expires_at in (
        ("expired", expired),
        ("malformed", "not-a-timestamp"),
        ("timezone-naive", "2999-01-01T00:00:00"),
    ):
        try:
            postgres_get(memory_row(item_id="item-1", expires_at=expires_at))
        except ValueError:
            continue
        errors.append(f"PostgreSQL get must fail closed on {label} returned expiry")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("AND (expires_at IS NULL OR expires_at >") != 4:
        errors.append("all memory-item reads must enforce expiry in SQL")
    if source.count("_validate_memory_item_not_expired(") != 5:
        errors.append("all memory-item read paths must validate returned expiry")
    if "check_phase6_memory_item_get_expiry_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory-item get expiry check")
    return errors


def main() -> int:
    errors = (
        check_sqlite_get_expiry_boundary()
        + check_sqlite_invalid_expiry_fails_closed()
        + check_postgres_get_expiry_boundary()
        + check_postgres_returned_expiry_fails_closed()
        + check_source_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-get-expiry] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-get-expiry] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
