"""Workflow read repositories.

Workflow templates and runs are tenant-scoped platform records. PostgreSQL is
the production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class WorkflowTemplateRecord:
    id: str
    tenant_id: str
    name: str
    description: str | None
    status: str
    definition: dict[str, Any]
    created_by: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class WorkflowRunRecord:
    id: str
    tenant_id: str
    workflow_template_id: str
    user_id: str
    status: str
    input: dict[str, Any]
    output: dict[str, Any] | None
    error: str | None
    created_at: str
    completed_at: str | None


def _template_from_row(row: dict[str, Any]) -> WorkflowTemplateRecord:
    return WorkflowTemplateRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        definition=_object_from_json(row["definition"], row["id"], "definition"),
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _run_from_row(row: dict[str, Any]) -> WorkflowRunRecord:
    return WorkflowRunRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        workflow_template_id=row["workflow_template_id"],
        user_id=row["user_id"],
        status=row["status"],
        input=_object_from_json(row["input"], row["id"], "input"),
        output=_optional_object_from_json(row["output"], row["id"], "output"),
        error=row["error"],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
    )


def _object_from_json(
    value: dict[str, Any] | str,
    record_id: str,
    field_name: str,
) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Workflow {record_id} has invalid {field_name} JSON.")
    return parsed


def _optional_object_from_json(
    value: dict[str, Any] | str | None,
    record_id: str,
    field_name: str,
) -> dict[str, Any] | None:
    if value is None:
        return None
    return _object_from_json(value, record_id, field_name)


class SQLiteWorkflowReadRepository:
    """Read tenant-scoped workflow records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_templates(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        limit: int = 50,
    ) -> list[WorkflowTemplateRecord]:
        query = """
            SELECT id, tenant_id, name, description, status, definition,
              created_by, created_at, updated_at
            FROM workflow_templates
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY updated_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_template_from_row(dict(row)) for row in rows]

    def get_template(
        self,
        *,
        tenant_id: str,
        workflow_template_id: str,
    ) -> WorkflowTemplateRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, status, definition,
                  created_by, created_at, updated_at
                FROM workflow_templates
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, workflow_template_id),
            ).fetchone()
        if row is None:
            return None
        return _template_from_row(dict(row))

    def list_runs(
        self,
        *,
        tenant_id: str,
        workflow_template_id: str | None = None,
        user_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[WorkflowRunRecord]:
        query = """
            SELECT id, tenant_id, workflow_template_id, user_id, status, input,
              output, error, created_at, completed_at
            FROM workflow_runs
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if workflow_template_id is not None:
            query += " AND workflow_template_id = ?"
            parameters.append(workflow_template_id)
        if user_id is not None:
            query += " AND user_id = ?"
            parameters.append(user_id)
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_run_from_row(dict(row)) for row in rows]

    def get_run(
        self,
        *,
        tenant_id: str,
        workflow_run_id: str,
    ) -> WorkflowRunRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, workflow_template_id, user_id, status,
                  input, output, error, created_at, completed_at
                FROM workflow_runs
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, workflow_run_id),
            ).fetchone()
        if row is None:
            return None
        return _run_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresWorkflowReadRepository:
    """Read tenant-scoped workflow records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_templates(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        limit: int = 50,
    ) -> list[WorkflowTemplateRecord]:
        query = """
            SELECT id, tenant_id, name, description, status, definition,
              created_by, created_at, updated_at
            FROM workflow_templates
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY updated_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_template_from_row(dict(row)) for row in cursor.fetchall()]

    def get_template(
        self,
        *,
        tenant_id: str,
        workflow_template_id: str,
    ) -> WorkflowTemplateRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, status,
                      definition, created_by, created_at, updated_at
                    FROM workflow_templates
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, workflow_template_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _template_from_row(dict(row))

    def list_runs(
        self,
        *,
        tenant_id: str,
        workflow_template_id: str | None = None,
        user_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[WorkflowRunRecord]:
        query = """
            SELECT id, tenant_id, workflow_template_id, user_id, status, input,
              output, error, created_at, completed_at
            FROM workflow_runs
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if workflow_template_id is not None:
            query += " AND workflow_template_id = %s"
            parameters.append(workflow_template_id)
        if user_id is not None:
            query += " AND user_id = %s"
            parameters.append(user_id)
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_run_from_row(dict(row)) for row in cursor.fetchall()]

    def get_run(
        self,
        *,
        tenant_id: str,
        workflow_run_id: str,
    ) -> WorkflowRunRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, workflow_template_id, user_id,
                      status, input, output, error, created_at, completed_at
                    FROM workflow_runs
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, workflow_run_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _run_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresWorkflowWriteRepository:
    """Write tenant-scoped workflow run records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_run(self, record: WorkflowRunRecord) -> None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO workflow_runs (
                      id, tenant_id, workflow_template_id, user_id, status,
                      input, output, error, created_at, completed_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s
                    )
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.workflow_template_id,
                        record.user_id,
                        record.status,
                        json.dumps(record.input, ensure_ascii=False, default=str),
                        (
                            None
                            if record.output is None
                            else json.dumps(
                                record.output,
                                ensure_ascii=False,
                                default=str,
                            )
                        ),
                        record.error,
                        record.created_at,
                        record.completed_at,
                    ),
                )
