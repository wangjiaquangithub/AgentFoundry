#!/usr/bin/env python3
"""Validate fail-closed Agent-run long-term-memory expiry reads."""

from __future__ import annotations

import sqlite3
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
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.persistence.database import SQLiteDatabase  # noqa: E402
from backend.persistence.memory_items import (  # noqa: E402
    PostgresMemoryItemReadRepository,
    SQLiteMemoryItemReadRepository,
)
from services.memories import (  # noqa: E402
    PlatformMemoryService,
    PlatformMemoryServiceError,
)


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
    with database.connect() as connection:
        connection.execute(
            """
            INSERT INTO memory_items (
              id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                "acme",
                "acme:alice",
                "agent-support",
                "session-1",
                item_id,
                "run-1",
                "{}",
                expires_at,
                "2026-07-23T00:00:00+00:00",
            ),
        )


def check_sqlite_expiry_boundary() -> list[str]:
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
        records = SQLiteMemoryItemReadRepository(database).list_memory_items(
            tenant_id="acme",
            user_id="acme:alice",
            agent_id="agent-support",
        )
    ids = {record.id for record in records}
    errors: list[str] = []
    if ids != {"permanent", "future"}:
        errors.append("SQLite reads must return only unexpired memory items")
    return errors


class FakeCursor:
    def __init__(self) -> None:
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...]) -> None:
        self.query = query
        self.parameters = parameters

    def fetchall(self) -> list[dict[str, Any]]:
        return []


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
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()

    def connect(self) -> FakeConnection:
        return FakeConnection(self.cursor_instance)


def check_postgres_expiry_boundary() -> list[str]:
    database = FakePostgresDatabase()
    PostgresMemoryItemReadRepository(database).list_memory_items(
        tenant_id="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        limit=5,
    )
    cursor = database.cursor_instance
    errors: list[str] = []
    if "AND (expires_at IS NULL OR expires_at > %s)" not in cursor.query:
        errors.append("PostgreSQL reads must enforce the expiry predicate")
    if len(cursor.parameters) != 5:
        errors.append("PostgreSQL expiry cutoff must be parameterized")
    else:
        try:
            cutoff = datetime.fromisoformat(str(cursor.parameters[1]))
        except ValueError:
            errors.append("PostgreSQL expiry cutoff must be an ISO timestamp")
        else:
            if cutoff.tzinfo is None:
                errors.append("PostgreSQL expiry cutoff must be timezone-aware")
    return errors


class FailingMemoryRepository:
    def list(self, **_: Any) -> list[dict[str, Any]]:
        raise ValueError("Memory item bad-expiry has an invalid expiry time.")


class AuditWriter:
    def append_audit_event(self, record: Any) -> Any:
        return record


def check_agent_run_failure_mapping() -> list[str]:
    service = PlatformMemoryService(
        repository=FailingMemoryRepository(),
        audit_event_writer=AuditWriter(),
    )
    try:
        service.build_agent_run_context(
            enabled=True,
            tenant="acme",
            user_id="acme:alice",
            agent_id="agent-support",
            session_id="session-1",
            agent_run_id="run-1",
            question="我之前关注什么？",
            max_records=20,
            limit=5,
        )
    except PlatformMemoryServiceError as exc:
        errors: list[str] = []
        if exc.status_code != 500:
            errors.append("expiry read failures must surface as HTTP 500")
        if exc.detail != "Agent-run memory retrieval is unavailable":
            errors.append("expiry read failures must expose stable error detail")
        return errors
    return ["expiry validation failures must fail Agent-run memory reads closed"]


def check_malformed_expiry_fails_closed() -> list[str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        database = SQLiteDatabase(
            database_url=f"sqlite:///{Path(temp_dir) / 'memory.db'}"
        )
        create_memory_table(database)
        insert_memory(database, item_id="malformed", expires_at="not-a-timestamp")
        try:
            SQLiteMemoryItemReadRepository(database).list_memory_items(
                tenant_id="acme"
            )
        except ValueError:
            return []
    return ["malformed memory expiry values must fail closed"]


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if source.count("_validate_memory_item_not_expired(record, as_of=as_of)") != 2:
        errors.append("SQLite and PostgreSQL reads must validate returned expiry evidence")
    if "check_phase6_agent_run_memory_expiry_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the memory expiry check")
    return errors


def main() -> int:
    errors = (
        check_sqlite_expiry_boundary()
        + check_postgres_expiry_boundary()
        + check_agent_run_failure_mapping()
        + check_malformed_expiry_fails_closed()
        + check_source_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-memory-expiry] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-memory-expiry] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
