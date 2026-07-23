#!/usr/bin/env python3
"""Validate fail-closed lifetime ordering for memory-item reads."""

from __future__ import annotations

import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable


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


def memory_row(
    *,
    item_id: str,
    created_at: str,
    expires_at: str | None,
) -> dict[str, Any]:
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
        "created_at": created_at,
    }


def create_sqlite_database(
    row: dict[str, Any],
) -> tuple[tempfile.TemporaryDirectory[str], SQLiteDatabase]:
    temp_dir = tempfile.TemporaryDirectory()
    database = SQLiteDatabase(
        database_url=f"sqlite:///{Path(temp_dir.name) / 'memory.db'}"
    )
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


def read_operations(row: dict[str, Any]) -> list[tuple[str, Callable[[], Any]]]:
    temp_dir, sqlite_database = create_sqlite_database(row)
    sqlite_repository = SQLiteMemoryItemReadRepository(sqlite_database)
    postgres_repository = PostgresMemoryItemReadRepository(
        FakePostgresDatabase(row)
    )
    return [
        (
            "SQLite list",
            lambda: sqlite_repository.list_memory_items(tenant_id="acme"),
        ),
        (
            "SQLite get",
            lambda: sqlite_repository.get_memory_item(
                tenant_id="acme",
                memory_item_id=row["id"],
            ),
        ),
        (
            "PostgreSQL list",
            lambda: postgres_repository.list_memory_items(tenant_id="acme"),
        ),
        (
            "PostgreSQL get",
            lambda: postgres_repository.get_memory_item(
                tenant_id="acme",
                memory_item_id=row["id"],
            ),
        ),
        ("cleanup", temp_dir.cleanup),
    ]


def check_valid_lifetime_reads() -> list[str]:
    errors: list[str] = []
    created_at = datetime.now(timezone.utc) + timedelta(hours=1)
    expiry = created_at + timedelta(days=1)
    offset = timezone(timedelta(hours=8))
    cases = (
        ("permanent", created_at.isoformat(), None),
        ("utc", created_at.isoformat(), expiry.isoformat()),
        (
            "offset",
            created_at.astimezone(offset).isoformat(),
            expiry.astimezone(offset).isoformat(),
        ),
        (
            "cross-offset",
            created_at.astimezone(offset).isoformat(),
            (created_at + timedelta(seconds=1)).isoformat(),
        ),
    )
    for label, created_value, expiry_value in cases:
        operations = read_operations(
            memory_row(
                item_id=label,
                created_at=created_value,
                expires_at=expiry_value,
            )
        )
        try:
            for operation_label, operation in operations[:-1]:
                try:
                    result = operation()
                except ValueError:
                    errors.append(
                        f"{operation_label} must accept {label} lifetime"
                    )
                    continue
                if result is None or result == []:
                    errors.append(
                        f"{operation_label} must return {label} lifetime"
                    )
        finally:
            operations[-1][1]()
    return errors


def check_invalid_lifetime_reads_fail_closed() -> list[str]:
    errors: list[str] = []
    created_at = datetime.now(timezone.utc) + timedelta(days=2)
    offset = timezone(timedelta(hours=8))
    alternate_offset = timezone(timedelta(hours=1))
    for label, created_value, expiry_value in (
        (
            "equal",
            created_at.isoformat(),
            created_at.astimezone(offset).isoformat(),
        ),
        (
            "expiry-before-created",
            created_at.isoformat(),
            (created_at - timedelta(seconds=1)).isoformat(),
        ),
        (
            "cross-offset-expiry-before-created",
            created_at.astimezone(offset).isoformat(),
            (created_at - timedelta(seconds=1))
            .astimezone(alternate_offset)
            .isoformat(),
        ),
    ):
        operations = read_operations(
            memory_row(
                item_id=label,
                created_at=created_value,
                expires_at=expiry_value,
            )
        )
        try:
            for operation_label, operation in operations[:-1]:
                try:
                    operation()
                except ValueError:
                    continue
                errors.append(
                    f"{operation_label} must reject {label} lifetime"
                )
        finally:
            operations[-1][1]()
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("if expires_at <= created_at:") != 2:
        errors.append("memory-item reads and writes must validate lifetime ordering")
    if "check_phase6_memory_item_read_lifetime_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the read lifetime check")
    return errors


def main() -> int:
    errors = [
        *check_valid_lifetime_reads(),
        *check_invalid_lifetime_reads_fail_closed(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(f"[phase6-memory-item-read-lifetime] {error}", file=sys.stderr)
        return 1
    print("[phase6-memory-item-read-lifetime] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
