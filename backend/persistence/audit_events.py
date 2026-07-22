"""Audit event persistence repositories.

Audit events are tenant-scoped governance records. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class AuditEventRecord:
    id: str
    tenant_id: str | None
    actor_user_id: str | None
    event_type: str
    target_type: str | None
    target_id: str | None
    payload: dict[str, Any]
    created_at: str


def _audit_event_from_row(row: dict[str, Any]) -> AuditEventRecord:
    return AuditEventRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        actor_user_id=row["actor_user_id"],
        event_type=row["event_type"],
        target_type=row["target_type"],
        target_id=row["target_id"],
        payload=_payload_from_json(row["payload"], row["id"]),
        created_at=row["created_at"],
    )


def _payload_from_json(value: dict[str, Any] | str, event_id: str) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Audit event {event_id} has invalid payload JSON.")
    return parsed


def _validate_write_result(
    requested: AuditEventRecord,
    persisted: AuditEventRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL audit event write did not return an event id.")
    if not persisted.event_type:
        raise ValueError("PostgreSQL audit event write did not return an event type.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL audit event write returned another event.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL audit event write returned another tenant.")
    if persisted.actor_user_id != requested.actor_user_id:
        raise ValueError("PostgreSQL audit event write returned another actor.")
    if persisted.event_type != requested.event_type:
        raise ValueError("PostgreSQL audit event write returned another event type.")
    if persisted.target_type != requested.target_type:
        raise ValueError("PostgreSQL audit event write returned another target type.")
    if persisted.target_id != requested.target_id:
        raise ValueError("PostgreSQL audit event write returned another target.")
    if persisted.payload != requested.payload:
        raise ValueError("PostgreSQL audit event write returned another payload.")


class SQLiteAuditEventReadRepository:
    """Read tenant-scoped audit events from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_audit_events(
        self,
        *,
        tenant_id: str,
        event_type: str | None = None,
        actor_user_id: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 50,
    ) -> list[AuditEventRecord]:
        query = """
            SELECT id, tenant_id, actor_user_id, event_type, target_type,
              target_id, payload, created_at
            FROM audit_events
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if event_type is not None:
            query += " AND event_type = ?"
            parameters.append(event_type)
        if actor_user_id is not None:
            query += " AND actor_user_id = ?"
            parameters.append(actor_user_id)
        if target_type is not None:
            query += " AND target_type = ?"
            parameters.append(target_type)
        if target_id is not None:
            query += " AND target_id = ?"
            parameters.append(target_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_audit_event_from_row(dict(row)) for row in rows]

    def get_audit_event(
        self,
        *,
        tenant_id: str,
        audit_event_id: str,
    ) -> AuditEventRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, actor_user_id, event_type, target_type,
                  target_id, payload, created_at
                FROM audit_events
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, audit_event_id),
            ).fetchone()
        if row is None:
            return None
        return _audit_event_from_row(dict(row))

    def list_for_target(
        self,
        *,
        tenant_id: str,
        target_type: str,
        target_id: str,
        limit: int = 50,
    ) -> list[AuditEventRecord]:
        return self.list_audit_events(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=target_id,
            limit=limit,
        )

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresAuditEventReadRepository:
    """Read tenant-scoped audit events from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_audit_events(
        self,
        *,
        tenant_id: str,
        event_type: str | None = None,
        actor_user_id: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 50,
    ) -> list[AuditEventRecord]:
        query = """
            SELECT id, tenant_id, actor_user_id, event_type,
              resource_type AS target_type,
              resource_id AS target_id,
              metadata AS payload,
              created_at
            FROM audit_events
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if event_type is not None:
            query += " AND event_type = %s"
            parameters.append(event_type)
        if actor_user_id is not None:
            query += " AND actor_user_id = %s"
            parameters.append(actor_user_id)
        if target_type is not None:
            query += " AND resource_type = %s"
            parameters.append(target_type)
        if target_id is not None:
            query += " AND resource_id = %s"
            parameters.append(target_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_audit_event_from_row(dict(row)) for row in cursor.fetchall()]

    def get_audit_event(
        self,
        *,
        tenant_id: str,
        audit_event_id: str,
    ) -> AuditEventRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, actor_user_id, event_type,
                      resource_type AS target_type,
                      resource_id AS target_id,
                      metadata AS payload,
                      created_at
                    FROM audit_events
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, audit_event_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _audit_event_from_row(dict(row))

    def list_for_target(
        self,
        *,
        tenant_id: str,
        target_type: str,
        target_id: str,
        limit: int = 50,
    ) -> list[AuditEventRecord]:
        return self.list_audit_events(
            tenant_id=tenant_id,
            target_type=target_type,
            target_id=target_id,
            limit=limit,
        )

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresAuditEventWriteRepository:
    """Write tenant-scoped audit events to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO audit_events (
                      id, tenant_id, actor_user_id, event_type, target_type,
                      target_id, payload, resource_type, resource_id, metadata,
                      created_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      tenant_id = EXCLUDED.tenant_id,
                      actor_user_id = EXCLUDED.actor_user_id,
                      event_type = EXCLUDED.event_type,
                      target_type = EXCLUDED.target_type,
                      target_id = EXCLUDED.target_id,
                      payload = EXCLUDED.payload,
                      resource_type = EXCLUDED.resource_type,
                      resource_id = EXCLUDED.resource_id,
                      metadata = EXCLUDED.metadata,
                      created_at = EXCLUDED.created_at
                    RETURNING id, tenant_id, actor_user_id, event_type,
                      resource_type AS target_type,
                      resource_id AS target_id,
                      metadata AS payload,
                      created_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.actor_user_id,
                        record.event_type,
                        record.target_type,
                        record.target_id,
                        json.dumps(record.payload, ensure_ascii=False),
                        record.target_type,
                        record.target_id,
                        json.dumps(record.payload, ensure_ascii=False),
                        record.created_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Audit event upsert did not return a row.")
        persisted = _audit_event_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
