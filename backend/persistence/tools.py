"""Tool governance read repositories.

These repositories keep tool catalog and policy reads tenant-scoped while the
platform migrates away from development JSON as the system of record.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class ToolRecord:
    id: str
    tenant_id: str
    name: str
    description: str | None
    category: str | None
    schema: dict[str, Any]
    status: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ToolPolicyRecord:
    id: str
    tenant_id: str
    tool_id: str
    allowed_roles: list[str]
    approval_required: bool
    rate_limit: dict[str, Any] | str | None
    data_access_scope: str | None
    created_at: str
    updated_at: str


def _tool_from_row(row: dict[str, Any]) -> ToolRecord:
    schema = _object_from_json(row["schema"], row["id"], "schema")
    return ToolRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        description=row["description"],
        category=row["category"],
        schema=schema,
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _policy_from_row(row: dict[str, Any]) -> ToolPolicyRecord:
    return ToolPolicyRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        tool_id=row["tool_id"],
        allowed_roles=_string_list_from_json(
            row["allowed_roles"],
            row["id"],
            "allowed_roles",
        ),
        approval_required=bool(row["approval_required"]),
        rate_limit=_rate_limit_from_json(row["rate_limit"], row["id"]),
        data_access_scope=row["data_access_scope"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _object_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> dict[str, Any]:
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Tool {record_id} has invalid {field_name} JSON.")
    return parsed


def _string_list_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> list[str]:
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError(
            f"Tool policy {record_id} has invalid {field_name} JSON.",
        )
    return parsed


def _rate_limit_from_json(
    value: str | None,
    record_id: str,
) -> dict[str, Any] | str | None:
    if value is None:
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return value
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, str):
        return parsed
    raise ValueError(f"Tool policy {record_id} has invalid rate_limit JSON.")


class SQLiteToolGovernanceReadRepository:
    """Read tenant-scoped tool catalog and policy records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_tools(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
    ) -> list[ToolRecord]:
        query = """
            SELECT id, tenant_id, name, description, category, schema, status,
              created_at, updated_at
            FROM tools
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY name"

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_tool_from_row(dict(row)) for row in rows]

    def get_tool(self, *, tenant_id: str, tool_id: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, category, schema, status,
                  created_at, updated_at
                FROM tools
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, tool_id),
            ).fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def get_tool_by_name(self, *, tenant_id: str, name: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, category, schema, status,
                  created_at, updated_at
                FROM tools
                WHERE tenant_id = ? AND name = ?
                """,
                (tenant_id, name),
            ).fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def list_policies(self, *, tenant_id: str) -> list[ToolPolicyRecord]:
        with self._database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                  rate_limit, data_access_scope, created_at, updated_at
                FROM tool_policies
                WHERE tenant_id = ?
                ORDER BY tool_id
                """,
                (tenant_id,),
            ).fetchall()
        return [_policy_from_row(dict(row)) for row in rows]

    def get_policy_for_tool(
        self,
        *,
        tenant_id: str,
        tool_id: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                  rate_limit, data_access_scope, created_at, updated_at
                FROM tool_policies
                WHERE tenant_id = ? AND tool_id = ?
                """,
                (tenant_id, tool_id),
            ).fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def get_policy_for_tool_name(
        self,
        *,
        tenant_id: str,
        tool_name: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT tool_policies.id, tool_policies.tenant_id,
                  tool_policies.tool_id, tool_policies.allowed_roles,
                  tool_policies.approval_required, tool_policies.rate_limit,
                  tool_policies.data_access_scope, tool_policies.created_at,
                  tool_policies.updated_at
                FROM tool_policies
                INNER JOIN tools ON tools.id = tool_policies.tool_id
                WHERE tool_policies.tenant_id = ? AND tools.tenant_id = ?
                  AND tools.name = ?
                """,
                (tenant_id, tenant_id, tool_name),
            ).fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def _tool_from_row(self, row: dict[str, Any]) -> ToolRecord:
        return _tool_from_row(row)

    def _policy_from_row(self, row: dict[str, Any]) -> ToolPolicyRecord:
        return _policy_from_row(row)

    def _object_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        return _object_from_json(value, record_id, field_name)

    def _string_list_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> list[str]:
        return _string_list_from_json(value, record_id, field_name)

    def _rate_limit_from_json(
        self,
        value: str | None,
        record_id: str,
    ) -> dict[str, Any] | str | None:
        return _rate_limit_from_json(value, record_id)


class PostgresToolGovernanceReadRepository:
    """Read tenant-scoped tool catalog and policy records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_tools(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
    ) -> list[ToolRecord]:
        query = """
            SELECT id, tenant_id, name, description, category, schema, status,
              created_at, updated_at
            FROM tools
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY name"

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_tool_from_row(dict(row)) for row in cursor.fetchall()]

    def get_tool(self, *, tenant_id: str, tool_id: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, category, schema, status,
                      created_at, updated_at
                    FROM tools
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, tool_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def get_tool_by_name(self, *, tenant_id: str, name: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, category, schema, status,
                      created_at, updated_at
                    FROM tools
                    WHERE tenant_id = %s AND name = %s
                    """,
                    (tenant_id, name),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def list_policies(self, *, tenant_id: str) -> list[ToolPolicyRecord]:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                      rate_limit, data_access_scope, created_at, updated_at
                    FROM tool_policies
                    WHERE tenant_id = %s
                    ORDER BY tool_id
                    """,
                    (tenant_id,),
                )
                rows = cursor.fetchall()
        return [_policy_from_row(dict(row)) for row in rows]

    def get_policy_for_tool(
        self,
        *,
        tenant_id: str,
        tool_id: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                      rate_limit, data_access_scope, created_at, updated_at
                    FROM tool_policies
                    WHERE tenant_id = %s AND tool_id = %s
                    """,
                    (tenant_id, tool_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def get_policy_for_tool_name(
        self,
        *,
        tenant_id: str,
        tool_name: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tool_policies.id, tool_policies.tenant_id,
                      tool_policies.tool_id, tool_policies.allowed_roles,
                      tool_policies.approval_required, tool_policies.rate_limit,
                      tool_policies.data_access_scope, tool_policies.created_at,
                      tool_policies.updated_at
                    FROM tool_policies
                    INNER JOIN tools ON tools.id = tool_policies.tool_id
                    WHERE tool_policies.tenant_id = %s AND tools.tenant_id = %s
                      AND tools.name = %s
                    """,
                    (tenant_id, tenant_id, tool_name),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))
