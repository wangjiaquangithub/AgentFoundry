"""Memory item read repositories.

Memory items are tenant-scoped long-term memory records. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class MemoryItemRecord:
    id: str
    tenant_id: str
    user_id: str
    agent_id: str | None
    session_id: str | None
    content: str
    source_run_id: str | None
    metadata: dict[str, Any]
    expires_at: str | None
    created_at: str


def _memory_item_from_row(row: dict[str, Any]) -> MemoryItemRecord:
    return MemoryItemRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        user_id=row["user_id"],
        agent_id=row["agent_id"],
        session_id=row["session_id"],
        content=row["content"],
        source_run_id=row["source_run_id"],
        metadata=_metadata_from_json(row["metadata"], row["id"]),
        expires_at=row["expires_at"],
        created_at=row["created_at"],
    )


def _metadata_from_json(value: dict[str, Any] | str, item_id: str) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Memory item {item_id} has invalid metadata JSON.")
    return parsed


class SQLiteMemoryItemReadRepository:
    """Read tenant-scoped memory items from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_memory_items(
        self,
        *,
        tenant_id: str,
        user_id: str | None = None,
        agent_id: str | None = None,
        session_id: str | None = None,
        source_run_id: str | None = None,
        limit: int = 50,
    ) -> list[MemoryItemRecord]:
        query = """
            SELECT id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            FROM memory_items
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if user_id is not None:
            query += " AND user_id = ?"
            parameters.append(user_id)
        if agent_id is not None:
            query += " AND agent_id = ?"
            parameters.append(agent_id)
        if session_id is not None:
            query += " AND session_id = ?"
            parameters.append(session_id)
        if source_run_id is not None:
            query += " AND source_run_id = ?"
            parameters.append(source_run_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_memory_item_from_row(dict(row)) for row in rows]

    def get_memory_item(
        self,
        *,
        tenant_id: str,
        memory_item_id: str,
    ) -> MemoryItemRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, user_id, agent_id, session_id, content,
                  source_run_id, metadata, expires_at, created_at
                FROM memory_items
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, memory_item_id),
            ).fetchone()
        if row is None:
            return None
        return _memory_item_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresMemoryItemReadRepository:
    """Read tenant-scoped memory items from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_memory_items(
        self,
        *,
        tenant_id: str,
        user_id: str | None = None,
        agent_id: str | None = None,
        session_id: str | None = None,
        source_run_id: str | None = None,
        limit: int = 50,
    ) -> list[MemoryItemRecord]:
        query = """
            SELECT id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            FROM memory_items
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if user_id is not None:
            query += " AND user_id = %s"
            parameters.append(user_id)
        if agent_id is not None:
            query += " AND agent_id = %s"
            parameters.append(agent_id)
        if session_id is not None:
            query += " AND session_id = %s"
            parameters.append(session_id)
        if source_run_id is not None:
            query += " AND source_run_id = %s"
            parameters.append(source_run_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_memory_item_from_row(dict(row)) for row in cursor.fetchall()]

    def get_memory_item(
        self,
        *,
        tenant_id: str,
        memory_item_id: str,
    ) -> MemoryItemRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, user_id, agent_id, session_id,
                      content, source_run_id, metadata, expires_at, created_at
                    FROM memory_items
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, memory_item_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _memory_item_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresMemoryItemWriteRepository:
    """Write tenant-scoped memory items to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_memory_item(self, record: MemoryItemRecord) -> MemoryItemRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO memory_items (
                      id, tenant_id, user_id, agent_id, session_id, content,
                      source_run_id, metadata, expires_at, created_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      tenant_id = EXCLUDED.tenant_id,
                      user_id = EXCLUDED.user_id,
                      agent_id = EXCLUDED.agent_id,
                      session_id = EXCLUDED.session_id,
                      content = EXCLUDED.content,
                      source_run_id = EXCLUDED.source_run_id,
                      metadata = EXCLUDED.metadata,
                      expires_at = EXCLUDED.expires_at,
                      created_at = EXCLUDED.created_at
                    RETURNING id, tenant_id, user_id, agent_id, session_id,
                      content, source_run_id, metadata, expires_at, created_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.user_id,
                        record.agent_id,
                        record.session_id,
                        record.content,
                        record.source_run_id,
                        json.dumps(record.metadata, ensure_ascii=False),
                        record.expires_at,
                        record.created_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Memory item upsert did not return a row.")
        return _memory_item_from_row(dict(row))
