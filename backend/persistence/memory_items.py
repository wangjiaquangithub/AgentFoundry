"""Memory item read repositories.

Memory items are tenant-scoped long-term memory records. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
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


def _validate_write_result(
    requested: MemoryItemRecord,
    persisted: MemoryItemRecord,
) -> None:
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL memory item write returned another item.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL memory item write returned another tenant.")
    if persisted.user_id != requested.user_id:
        raise ValueError("PostgreSQL memory item write returned another user.")
    if persisted.agent_id != requested.agent_id:
        raise ValueError("PostgreSQL memory item write returned another agent.")
    if persisted.session_id != requested.session_id:
        raise ValueError("PostgreSQL memory item write returned another session.")
    if persisted.content != requested.content:
        raise ValueError("PostgreSQL memory item write returned another content.")
    if persisted.source_run_id != requested.source_run_id:
        raise ValueError("PostgreSQL memory item write returned another source run.")
    if persisted.metadata != requested.metadata:
        raise ValueError("PostgreSQL memory item write returned another metadata.")
    if persisted.expires_at != requested.expires_at:
        raise ValueError("PostgreSQL memory item write returned another expiry time.")
    if persisted.created_at != requested.created_at:
        raise ValueError("PostgreSQL memory item write returned another created time.")


def _validate_memory_item_read_result(
    record: MemoryItemRecord,
    *,
    tenant_id: str,
    user_id: str | None = None,
    agent_id: str | None = None,
    session_id: str | None = None,
    source_run_id: str | None = None,
    memory_item_id: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL memory item read returned another tenant.")
    if user_id is not None and record.user_id != user_id:
        raise ValueError("PostgreSQL memory item read returned another user.")
    if agent_id is not None and record.agent_id != agent_id:
        raise ValueError("PostgreSQL memory item read returned another agent.")
    if session_id is not None and record.session_id != session_id:
        raise ValueError("PostgreSQL memory item read returned another session.")
    if source_run_id is not None and record.source_run_id != source_run_id:
        raise ValueError("PostgreSQL memory item read returned another source run.")
    if memory_item_id is not None and record.id != memory_item_id:
        raise ValueError("PostgreSQL memory item read returned another item.")


def _validate_memory_item_not_expired(
    record: MemoryItemRecord,
    *,
    as_of: datetime,
) -> None:
    if record.expires_at is None:
        return
    try:
        expires_at = datetime.fromisoformat(record.expires_at)
    except ValueError as exc:
        raise ValueError(
            f"Memory item {record.id} has an invalid expiry time."
        ) from exc
    if expires_at.tzinfo is None:
        raise ValueError(f"Memory item {record.id} has a timezone-naive expiry time.")
    created_at = datetime.fromisoformat(record.created_at)
    if expires_at <= created_at:
        raise ValueError(
            f"Memory item {record.id} expiry time must be after its created time."
        )
    if expires_at <= as_of:
        raise ValueError(f"Memory item {record.id} read returned an expired item.")


def _validate_memory_item_write_expiry(
    record: MemoryItemRecord,
    *,
    as_of: datetime,
) -> None:
    if record.expires_at is None:
        return
    try:
        expires_at = datetime.fromisoformat(record.expires_at)
    except ValueError as exc:
        raise ValueError(
            f"Memory item {record.id} has an invalid expiry time."
        ) from exc
    if expires_at.utcoffset() is None:
        raise ValueError(f"Memory item {record.id} has a timezone-naive expiry time.")
    created_at = datetime.fromisoformat(record.created_at)
    if expires_at <= created_at:
        raise ValueError(
            f"Memory item {record.id} expiry time must be after its created time."
        )
    if expires_at <= as_of:
        raise ValueError(f"Memory item {record.id} write rejected an expired item.")


def _validate_memory_item_write_created_at(
    record: MemoryItemRecord,
    *,
    as_of: datetime,
) -> None:
    try:
        created_at = datetime.fromisoformat(record.created_at)
    except ValueError as exc:
        raise ValueError(
            f"Memory item {record.id} has an invalid created time."
        ) from exc
    if created_at.utcoffset() is None:
        raise ValueError(f"Memory item {record.id} has a timezone-naive created time.")
    if created_at > as_of:
        raise ValueError(f"Memory item {record.id} write rejected a future created time.")


def _validate_memory_item_read_created_at(
    record: MemoryItemRecord,
    *,
    as_of: datetime,
) -> None:
    try:
        created_at = datetime.fromisoformat(record.created_at)
    except ValueError as exc:
        raise ValueError(
            f"Memory item {record.id} has an invalid created time."
        ) from exc
    if created_at.utcoffset() is None:
        raise ValueError(f"Memory item {record.id} has a timezone-naive created time.")
    if created_at > as_of:
        raise ValueError(f"Memory item {record.id} read returned a future created time.")


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
        as_of = datetime.now(timezone.utc)
        query = """
            SELECT id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            FROM memory_items
            WHERE tenant_id = ?
              AND (expires_at IS NULL OR expires_at > ?)
        """
        parameters: list[Any] = [tenant_id, as_of.isoformat()]
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
        records = [_memory_item_from_row(dict(row)) for row in rows]
        for record in records:
            _validate_memory_item_read_created_at(record, as_of=as_of)
            _validate_memory_item_not_expired(record, as_of=as_of)
        return records

    def get_memory_item(
        self,
        *,
        tenant_id: str,
        memory_item_id: str,
    ) -> MemoryItemRecord | None:
        as_of = datetime.now(timezone.utc)
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, user_id, agent_id, session_id, content,
                  source_run_id, metadata, expires_at, created_at
                FROM memory_items
                WHERE tenant_id = ? AND id = ?
                  AND (expires_at IS NULL OR expires_at > ?)
                """,
                (tenant_id, memory_item_id, as_of.isoformat()),
            ).fetchone()
        if row is None:
            return None
        record = _memory_item_from_row(dict(row))
        _validate_memory_item_read_created_at(record, as_of=as_of)
        _validate_memory_item_not_expired(
            record,
            as_of=as_of,
        )
        return record

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
        as_of = datetime.now(timezone.utc)
        query = """
            SELECT id, tenant_id, user_id, agent_id, session_id, content,
              source_run_id, metadata, expires_at, created_at
            FROM memory_items
            WHERE tenant_id = %s
              AND (expires_at IS NULL OR expires_at > %s)
        """
        parameters: list[Any] = [tenant_id, as_of.isoformat()]
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
                records = [_memory_item_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_memory_item_read_result(
                record,
                tenant_id=tenant_id,
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
                source_run_id=source_run_id,
            )
            _validate_memory_item_read_created_at(record, as_of=as_of)
            _validate_memory_item_not_expired(record, as_of=as_of)
        return records

    def get_memory_item(
        self,
        *,
        tenant_id: str,
        memory_item_id: str,
    ) -> MemoryItemRecord | None:
        as_of = datetime.now(timezone.utc)
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, user_id, agent_id, session_id,
                      content, source_run_id, metadata, expires_at, created_at
                    FROM memory_items
                    WHERE tenant_id = %s AND id = %s
                      AND (expires_at IS NULL OR expires_at > %s)
                    """,
                    (tenant_id, memory_item_id, as_of.isoformat()),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        record = _memory_item_from_row(dict(row))
        _validate_memory_item_read_result(
            record,
            tenant_id=tenant_id,
            memory_item_id=memory_item_id,
        )
        _validate_memory_item_read_created_at(record, as_of=as_of)
        _validate_memory_item_not_expired(
            record,
            as_of=as_of,
        )
        return record

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresMemoryItemWriteRepository:
    """Write tenant-scoped memory items to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_memory_item(self, record: MemoryItemRecord) -> MemoryItemRecord:
        as_of = datetime.now(timezone.utc)
        _validate_memory_item_write_created_at(record, as_of=as_of)
        _validate_memory_item_write_expiry(
            record,
            as_of=as_of,
        )
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
        persisted = _memory_item_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
