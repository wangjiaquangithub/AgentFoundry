"""Audit event persistence repositories.

Audit events are tenant-scoped governance records. PostgreSQL is the
production system of record; SQLite remains an explicit local development
compatibility path during the data-layer migration.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


PRODUCTION_AUDIT_EVENT_SYSTEM_OF_RECORD = "PostgreSQL"
LOCAL_AUDIT_EVENT_COMPATIBILITY_PATH = "SQLite"


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


def _validate_audit_event_read_result(
    record: AuditEventRecord,
    *,
    tenant_id: str,
    audit_event_id: str | None = None,
    event_type: str | None = None,
    actor_user_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL audit event read returned another tenant.")
    if audit_event_id is not None and record.id != audit_event_id:
        raise ValueError("PostgreSQL audit event read returned another event.")
    if event_type is not None and record.event_type != event_type:
        raise ValueError("PostgreSQL audit event read returned another event type.")
    if actor_user_id is not None and record.actor_user_id != actor_user_id:
        raise ValueError("PostgreSQL audit event read returned another actor.")
    if target_type is not None and record.target_type != target_type:
        raise ValueError("PostgreSQL audit event read returned another target type.")
    if target_id is not None and record.target_id != target_id:
        raise ValueError("PostgreSQL audit event read returned another target.")


class JsonlAuditEventRepository:
    """Persist audit events locally when PostgreSQL is not configured."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.RLock()
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        with self._lock:
            existing = self._get_by_id(record.id)
            if existing is not None:
                _validate_write_result(record, existing)
                return existing
            with self._path.open("a", encoding="utf-8") as stream:
                stream.write(
                    json.dumps(
                        self._record_to_dict(record),
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    + "\n"
                )
        return record

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
        with self._lock:
            records = [
                record
                for record in self._read_records()
                if record.tenant_id == tenant_id
                and (event_type is None or record.event_type == event_type)
                and (
                    actor_user_id is None
                    or record.actor_user_id == actor_user_id
                )
                and (target_type is None or record.target_type == target_type)
                and (target_id is None or record.target_id == target_id)
            ]
        records.sort(key=lambda record: (record.created_at, record.id), reverse=True)
        return records[: self._clamp_limit(limit)]

    def get_audit_event(
        self,
        *,
        tenant_id: str,
        audit_event_id: str,
    ) -> AuditEventRecord | None:
        with self._lock:
            record = self._get_by_id(audit_event_id)
        if record is None or record.tenant_id != tenant_id:
            return None
        return record

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

    def _get_by_id(self, event_id: str) -> AuditEventRecord | None:
        for record in self._read_records():
            if record.id == event_id:
                return record
        return None

    def _read_records(self) -> list[AuditEventRecord]:
        if not self._path.exists():
            return []
        records: list[AuditEventRecord] = []
        with self._path.open("r", encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, start=1):
                if not line.strip():
                    continue
                try:
                    value = json.loads(line)
                    records.append(_audit_event_from_row(value))
                except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
                    raise ValueError(
                        f"Invalid audit event JSONL at line {line_number}."
                    ) from exc
        return records

    def _record_to_dict(self, record: AuditEventRecord) -> dict[str, Any]:
        return {
            "id": record.id,
            "tenant_id": record.tenant_id,
            "actor_user_id": record.actor_user_id,
            "event_type": record.event_type,
            "target_type": record.target_type,
            "target_id": record.target_id,
            "payload": record.payload,
            "created_at": record.created_at,
        }

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class SQLiteAuditEventReadRepository:
    """Read audit events from SQLite for local compatibility only."""

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
    """Read tenant-scoped audit events from the production system of record."""

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
                rows = cursor.fetchall()
        records = [_audit_event_from_row(dict(row)) for row in rows]
        for record in records:
            _validate_audit_event_read_result(
                record,
                tenant_id=tenant_id,
                event_type=event_type,
                actor_user_id=actor_user_id,
                target_type=target_type,
                target_id=target_id,
            )
        return records

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
        record = _audit_event_from_row(dict(row))
        _validate_audit_event_read_result(
            record,
            tenant_id=tenant_id,
            audit_event_id=audit_event_id,
        )
        return record

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
    """Write tenant-scoped audit events to the production system of record."""

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
                    ON CONFLICT (id) DO NOTHING
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
                    cursor.execute(
                        """
                        SELECT id, tenant_id, actor_user_id, event_type,
                          resource_type AS target_type,
                          resource_id AS target_id,
                          metadata AS payload,
                          created_at
                        FROM audit_events
                        WHERE id = %s
                        """,
                        (record.id,),
                    )
                    row = cursor.fetchone()
        if row is None:
            raise ValueError("PostgreSQL audit event append did not return a row.")
        persisted = _audit_event_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
