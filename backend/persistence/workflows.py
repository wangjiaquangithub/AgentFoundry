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


def _validate_workflow_run_write_result(
    requested: WorkflowRunRecord,
    persisted: WorkflowRunRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL workflow run write did not return a run id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL workflow run write did not return a tenant id.")
    if not persisted.workflow_template_id:
        raise ValueError(
            "PostgreSQL workflow run write did not return a workflow template id.",
        )
    if not persisted.user_id:
        raise ValueError("PostgreSQL workflow run write did not return a user id.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL workflow run write returned another run.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL workflow run write returned another tenant.")
    if persisted.workflow_template_id != requested.workflow_template_id:
        raise ValueError(
            "PostgreSQL workflow run write returned another workflow template.",
        )
    if persisted.user_id != requested.user_id:
        raise ValueError("PostgreSQL workflow run write returned another user.")
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL workflow run write returned another status.")
    if persisted.input != requested.input:
        raise ValueError("PostgreSQL workflow run write returned another input.")
    if persisted.output != requested.output:
        raise ValueError("PostgreSQL workflow run write returned another output.")
    if persisted.error != requested.error:
        raise ValueError("PostgreSQL workflow run write returned another error.")
    if persisted.created_at != requested.created_at:
        raise ValueError("PostgreSQL workflow run write returned another created time.")
    if persisted.completed_at != requested.completed_at:
        raise ValueError(
            "PostgreSQL workflow run write returned another completed time.",
        )


def _validate_workflow_template_write_result(
    requested: WorkflowTemplateRecord,
    persisted: WorkflowTemplateRecord,
) -> None:
    if not persisted.id:
        raise ValueError(
            "PostgreSQL workflow template write did not return a template id.",
        )
    if not persisted.tenant_id:
        raise ValueError(
            "PostgreSQL workflow template write did not return a tenant id.",
        )
    if not persisted.created_by:
        raise ValueError(
            "PostgreSQL workflow template write did not return a creator.",
        )
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL workflow template write returned another template.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL workflow template write returned another tenant.")
    if persisted.name != requested.name:
        raise ValueError("PostgreSQL workflow template write returned another name.")
    if persisted.description != requested.description:
        raise ValueError(
            "PostgreSQL workflow template write returned another description.",
        )
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL workflow template write returned another status.")
    if persisted.definition != requested.definition:
        raise ValueError(
            "PostgreSQL workflow template write returned another definition.",
        )
    if persisted.created_by != requested.created_by:
        raise ValueError("PostgreSQL workflow template write returned another creator.")
    if persisted.created_at != requested.created_at:
        raise ValueError(
            "PostgreSQL workflow template write returned another created time.",
        )
    if persisted.updated_at != requested.updated_at:
        raise ValueError(
            "PostgreSQL workflow template write returned another updated time.",
        )


def _validate_workflow_template_read_result(
    record: WorkflowTemplateRecord,
    *,
    tenant_id: str,
    workflow_template_id: str | None = None,
    status: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL workflow template read returned another tenant.")
    if workflow_template_id is not None and record.id != workflow_template_id:
        raise ValueError(
            "PostgreSQL workflow template read returned another template.",
        )
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL workflow template read returned another status.")


def _validate_workflow_run_read_result(
    record: WorkflowRunRecord,
    *,
    tenant_id: str,
    workflow_run_id: str | None = None,
    workflow_template_id: str | None = None,
    user_id: str | None = None,
    status: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL workflow run read returned another tenant.")
    if workflow_run_id is not None and record.id != workflow_run_id:
        raise ValueError("PostgreSQL workflow run read returned another run.")
    if (
        workflow_template_id is not None
        and record.workflow_template_id != workflow_template_id
    ):
        raise ValueError(
            "PostgreSQL workflow run read returned another workflow template.",
        )
    if user_id is not None and record.user_id != user_id:
        raise ValueError("PostgreSQL workflow run read returned another user.")
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL workflow run read returned another status.")


def _postgres_run_projection() -> str:
    return """
        id, tenant_id, workflow_template_id, triggered_by AS user_id, status,
        inputs AS input, outputs AS output, error, created_at, completed_at
    """


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
                records = [_template_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_workflow_template_read_result(
                record,
                tenant_id=tenant_id,
                status=status,
            )
        return records

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
        record = _template_from_row(dict(row))
        _validate_workflow_template_read_result(
            record,
            tenant_id=tenant_id,
            workflow_template_id=workflow_template_id,
        )
        return record

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
            SELECT
              id, tenant_id, workflow_template_id, triggered_by AS user_id,
              status, inputs AS input, outputs AS output, error, created_at,
              completed_at
            FROM workflow_runs
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if workflow_template_id is not None:
            query += " AND workflow_template_id = %s"
            parameters.append(workflow_template_id)
        if user_id is not None:
            query += " AND triggered_by = %s"
            parameters.append(user_id)
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                records = [_run_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_workflow_run_read_result(
                record,
                tenant_id=tenant_id,
                workflow_template_id=workflow_template_id,
                user_id=user_id,
                status=status,
            )
        return records

    def get_run(
        self,
        *,
        tenant_id: str,
        workflow_run_id: str,
    ) -> WorkflowRunRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {_postgres_run_projection()}
                    FROM workflow_runs
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, workflow_run_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        record = _run_from_row(dict(row))
        _validate_workflow_run_read_result(
            record,
            tenant_id=tenant_id,
            workflow_run_id=workflow_run_id,
        )
        return record

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresWorkflowWriteRepository:
    """Write tenant-scoped workflow records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def replace_templates(
        self,
        *,
        tenant_id: str,
        records: list[WorkflowTemplateRecord],
    ) -> list[WorkflowTemplateRecord]:
        for record in records:
            if record.tenant_id != tenant_id:
                raise ValueError(
                    "PostgreSQL workflow template replacement requires one tenant.",
                )

        persisted_records: list[WorkflowTemplateRecord] = []
        template_ids = [record.id for record in records]
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                if template_ids:
                    cursor.execute(
                        """
                        DELETE FROM workflow_templates
                        WHERE tenant_id = %s AND NOT (id = ANY(%s))
                        """,
                        (tenant_id, template_ids),
                    )
                else:
                    cursor.execute(
                        "DELETE FROM workflow_templates WHERE tenant_id = %s",
                        (tenant_id,),
                    )

                for record in records:
                    cursor.execute(
                        """
                        INSERT INTO workflow_templates (
                          id, tenant_id, name, description, status, definition,
                          created_by, created_at, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                          name = EXCLUDED.name,
                          description = EXCLUDED.description,
                          status = EXCLUDED.status,
                          definition = EXCLUDED.definition,
                          created_by = EXCLUDED.created_by,
                          created_at = EXCLUDED.created_at,
                          updated_at = EXCLUDED.updated_at
                        WHERE workflow_templates.tenant_id = EXCLUDED.tenant_id
                        RETURNING id, tenant_id, name, description, status,
                          definition, created_by, created_at, updated_at
                        """,
                        (
                            record.id,
                            record.tenant_id,
                            record.name,
                            record.description,
                            record.status,
                            json.dumps(record.definition, ensure_ascii=False, default=str),
                            record.created_by,
                            record.created_at,
                            record.updated_at,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise ValueError(
                            "Workflow template id already belongs to another tenant.",
                        )
                    persisted = _template_from_row(dict(row))
                    _validate_workflow_template_write_result(record, persisted)
                    persisted_records.append(persisted)
        return persisted_records

    def append_run(self, record: WorkflowRunRecord) -> WorkflowRunRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO workflow_runs (
                      id, tenant_id, workflow_template_id, user_id,
                      triggered_by, status, input, inputs, output, outputs,
                      error, created_at, completed_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      tenant_id = EXCLUDED.tenant_id,
                      workflow_template_id = EXCLUDED.workflow_template_id,
                      user_id = EXCLUDED.user_id,
                      triggered_by = EXCLUDED.triggered_by,
                      status = EXCLUDED.status,
                      input = EXCLUDED.input,
                      inputs = EXCLUDED.inputs,
                      output = EXCLUDED.output,
                      outputs = EXCLUDED.outputs,
                      error = EXCLUDED.error,
                      created_at = EXCLUDED.created_at,
                      completed_at = EXCLUDED.completed_at
                    RETURNING id, tenant_id, workflow_template_id, user_id,
                      triggered_by, status, input, inputs, output, outputs,
                      error, created_at, completed_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.workflow_template_id,
                        record.user_id,
                        record.user_id,
                        record.status,
                        json.dumps(record.input, ensure_ascii=False, default=str),
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
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Workflow run upsert did not return a row.")
        persisted = _run_from_row(dict(row))
        _validate_workflow_run_write_result(record, persisted)
        return persisted
