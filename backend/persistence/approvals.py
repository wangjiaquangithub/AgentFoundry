"""Approval persistence repositories.

Approval records are governance data and must always be queried and updated
through an explicit tenant boundary.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class ApprovalRecord:
    id: str
    tenant_id: str
    request_type: str
    target_type: str
    target_id: str
    status: str
    requested_by: str
    approved_by: str | None
    reason: str | None
    payload: dict[str, Any]
    created_at: str
    resolved_at: str | None


def _approval_from_row(row: dict[str, Any]) -> ApprovalRecord:
    payload = _object_from_json(row["payload"], row["id"], "payload")
    return ApprovalRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        request_type=row["request_type"],
        target_type=row["target_type"],
        target_id=row["target_id"],
        status=row["status"],
        requested_by=row["requested_by"],
        approved_by=row["approved_by"],
        reason=row["reason"],
        payload=payload,
        created_at=row["created_at"],
        resolved_at=row["resolved_at"],
    )


def _object_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> dict[str, Any]:
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Approval {record_id} has invalid {field_name} JSON.")
    return parsed


def _validate_write_result(
    requested: ApprovalRecord,
    persisted: ApprovalRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL approval write did not return an approval id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL approval write did not return a tenant id.")
    if not persisted.request_type:
        raise ValueError("PostgreSQL approval write did not return a request type.")
    if not persisted.target_type:
        raise ValueError("PostgreSQL approval write did not return a target type.")
    if not persisted.target_id:
        raise ValueError("PostgreSQL approval write did not return a target id.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL approval write returned another approval.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL approval write returned another tenant.")
    if persisted.request_type != requested.request_type:
        raise ValueError("PostgreSQL approval write returned another request type.")
    if persisted.target_type != requested.target_type:
        raise ValueError("PostgreSQL approval write returned another target type.")
    if persisted.target_id != requested.target_id:
        raise ValueError("PostgreSQL approval write returned another target.")
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL approval write returned another status.")
    if persisted.requested_by != requested.requested_by:
        raise ValueError("PostgreSQL approval write returned another requester.")
    if persisted.approved_by != requested.approved_by:
        raise ValueError("PostgreSQL approval write returned another approver.")
    if persisted.reason != requested.reason:
        raise ValueError("PostgreSQL approval write returned another reason.")
    if persisted.payload != requested.payload:
        raise ValueError("PostgreSQL approval write returned another payload.")
    if persisted.created_at != requested.created_at:
        raise ValueError("PostgreSQL approval write returned another created time.")
    if persisted.resolved_at != requested.resolved_at:
        raise ValueError("PostgreSQL approval write returned another resolved time.")


def _validate_decision_write_result(
    *,
    tenant_id: str,
    approval_id: str,
    status: str,
    approved_by: str,
    resolved_at: str,
    payload: dict[str, Any],
    persisted: ApprovalRecord,
) -> None:
    if persisted.id != approval_id:
        raise ValueError("PostgreSQL approval decision returned another approval.")
    if persisted.tenant_id != tenant_id:
        raise ValueError("PostgreSQL approval decision returned another tenant.")
    if persisted.status != status:
        raise ValueError("PostgreSQL approval decision returned another status.")
    if persisted.approved_by != approved_by:
        raise ValueError("PostgreSQL approval decision returned another approver.")
    if persisted.resolved_at != resolved_at:
        raise ValueError(
            "PostgreSQL approval decision returned another resolution time.",
        )
    if persisted.payload != payload:
        raise ValueError("PostgreSQL approval decision returned another payload.")


class SQLiteApprovalReadRepository:
    """Read tenant-scoped approval records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_approvals(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        request_type: str | None = None,
        limit: int = 20,
    ) -> list[ApprovalRecord]:
        query = """
            SELECT id, tenant_id, request_type, target_type, target_id, status,
              requested_by, approved_by, reason, payload, created_at, resolved_at
            FROM approvals
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        if request_type is not None:
            query += " AND request_type = ?"
            parameters.append(request_type)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_approval_from_row(dict(row)) for row in rows]

    def get_approval(
        self,
        *,
        tenant_id: str,
        approval_id: str,
    ) -> ApprovalRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, request_type, target_type, target_id, status,
                  requested_by, approved_by, reason, payload, created_at, resolved_at
                FROM approvals
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, approval_id),
            ).fetchone()
        if row is None:
            return None
        persisted = _approval_from_row(dict(row))
        _validate_decision_write_result(
            tenant_id=tenant_id,
            approval_id=approval_id,
            status=status,
            approved_by=approved_by,
            resolved_at=resolved_at,
            payload=payload,
            persisted=persisted,
        )
        return persisted

    def list_for_target(
        self,
        *,
        tenant_id: str,
        target_type: str,
        target_id: str,
        status: str | None = None,
        limit: int = 20,
    ) -> list[ApprovalRecord]:
        query = """
            SELECT id, tenant_id, request_type, target_type, target_id, status,
              requested_by, approved_by, reason, payload, created_at, resolved_at
            FROM approvals
            WHERE tenant_id = ? AND target_type = ? AND target_id = ?
        """
        parameters: list[Any] = [tenant_id, target_type, target_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_approval_from_row(dict(row)) for row in rows]

    def _approval_from_row(self, row: dict[str, Any]) -> ApprovalRecord:
        return _approval_from_row(row)

    def _object_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        return _object_from_json(value, record_id, field_name)

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresApprovalReadRepository:
    """Read tenant-scoped approval records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_approvals(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        request_type: str | None = None,
        limit: int = 20,
    ) -> list[ApprovalRecord]:
        query = """
            SELECT id, tenant_id, request_type, target_type, target_id, status,
              requested_by, approved_by, reason, payload, created_at, resolved_at
            FROM approvals
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        if request_type is not None:
            query += " AND request_type = %s"
            parameters.append(request_type)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_approval_from_row(dict(row)) for row in cursor.fetchall()]

    def get_approval(
        self,
        *,
        tenant_id: str,
        approval_id: str,
    ) -> ApprovalRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, request_type, target_type, target_id,
                      status, requested_by, approved_by, reason, payload, created_at,
                      resolved_at
                    FROM approvals
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, approval_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _approval_from_row(dict(row))

    def list_for_target(
        self,
        *,
        tenant_id: str,
        target_type: str,
        target_id: str,
        status: str | None = None,
        limit: int = 20,
    ) -> list[ApprovalRecord]:
        query = """
            SELECT id, tenant_id, request_type, target_type, target_id, status,
              requested_by, approved_by, reason, payload, created_at, resolved_at
            FROM approvals
            WHERE tenant_id = %s AND target_type = %s AND target_id = %s
        """
        parameters: list[Any] = [tenant_id, target_type, target_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_approval_from_row(dict(row)) for row in cursor.fetchall()]

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresApprovalWriteRepository:
    """Write tenant-scoped approval records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_approval(self, record: ApprovalRecord) -> ApprovalRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO approvals (
                      id, tenant_id, request_type, target_type, target_id, status,
                      requested_by, approved_by, reason, payload, created_at,
                      resolved_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s
                    )
                    RETURNING id, tenant_id, request_type, target_type, target_id,
                      status, requested_by, approved_by, reason, payload, created_at,
                      resolved_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.request_type,
                        record.target_type,
                        record.target_id,
                        record.status,
                        record.requested_by,
                        record.approved_by,
                        record.reason,
                        json.dumps(record.payload, ensure_ascii=False, default=str),
                        record.created_at,
                        record.resolved_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Approval insert did not return a row.")
        persisted = _approval_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted

    def update_approval_status(
        self,
        *,
        tenant_id: str,
        approval_id: str,
        status: str,
        approved_by: str,
        resolved_at: str,
        payload: dict[str, Any],
    ) -> ApprovalRecord | None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE approvals
                    SET status = %s,
                      approved_by = %s,
                      resolved_at = %s,
                      payload = %s
                    WHERE tenant_id = %s AND id = %s
                    RETURNING id, tenant_id, request_type, target_type, target_id,
                      status, requested_by, approved_by, reason, payload, created_at,
                      resolved_at
                    """,
                    (
                        status,
                        approved_by,
                        resolved_at,
                        json.dumps(payload, ensure_ascii=False, default=str),
                        tenant_id,
                        approval_id,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _approval_from_row(dict(row))
