"""SQLite approval read repository.

Approval records are governance data and must always be queried through an
explicit tenant boundary. This repository is read-only while write paths remain
on the existing development storage during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import SQLiteDatabase


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
        return [self._approval_from_row(dict(row)) for row in rows]

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
        return self._approval_from_row(dict(row))

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
        return [self._approval_from_row(dict(row)) for row in rows]

    def _approval_from_row(self, row: dict[str, Any]) -> ApprovalRecord:
        payload = self._object_from_json(row["payload"], row["id"], "payload")
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
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise ValueError(f"Approval {record_id} has invalid {field_name} JSON.")
        return parsed

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
