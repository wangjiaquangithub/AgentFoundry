"""Audit event read repositories.

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
            SELECT id, tenant_id, actor_user_id, event_type, target_type,
              target_id, payload, created_at
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
            query += " AND target_type = %s"
            parameters.append(target_type)
        if target_id is not None:
            query += " AND target_id = %s"
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
                      target_type, target_id, payload, created_at
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
