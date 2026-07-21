"""Tool call read repositories.

Tool call records are execution evidence and must always be read through an
explicit tenant boundary. This repository is read-only while AgentFoundry moves
tool execution history from development JSONL files into the production data
layer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class ToolCallRecord:
    id: str
    tenant_id: str
    agent_run_id: str | None
    tool_id: str | None
    inputs: dict[str, Any]
    result: dict[str, Any] | list[Any] | str | int | float | bool | None
    allowed: bool
    approval_id: str | None
    created_at: str
    completed_at: str | None


def _tool_call_from_row(row: dict[str, Any]) -> ToolCallRecord:
    return ToolCallRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        agent_run_id=row["agent_run_id"],
        tool_id=row["tool_id"],
        inputs=_object_from_json(row["inputs"], row["id"], "inputs"),
        result=_result_from_json(row["result"], row["id"]),
        allowed=bool(row["allowed"]),
        approval_id=row["approval_id"],
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
        raise ValueError(f"Tool call {record_id} has invalid {field_name} JSON.")
    return parsed


def _result_from_json(
    value: dict[str, Any] | list[Any] | str | int | float | bool | None,
    record_id: str,
) -> dict[str, Any] | list[Any] | str | int | float | bool | None:
    if value is None:
        return None
    if isinstance(value, (dict, list, int, float, bool)):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


class SQLiteToolCallReadRepository:
    """Read tenant-scoped tool call records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_tool_calls(
        self,
        *,
        tenant_id: str,
        agent_run_id: str | None = None,
        tool_id: str | None = None,
        allowed: bool | None = None,
        approval_id: str | None = None,
        limit: int = 20,
    ) -> list[ToolCallRecord]:
        query = """
            SELECT id, tenant_id, agent_run_id, tool_id, inputs, result, allowed,
              approval_id, created_at, completed_at
            FROM tool_calls
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if agent_run_id is not None:
            query += " AND agent_run_id = ?"
            parameters.append(agent_run_id)
        if tool_id is not None:
            query += " AND tool_id = ?"
            parameters.append(tool_id)
        if allowed is not None:
            query += " AND allowed = ?"
            parameters.append(1 if allowed else 0)
        if approval_id is not None:
            query += " AND approval_id = ?"
            parameters.append(approval_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_tool_call_from_row(dict(row)) for row in rows]

    def get_tool_call(
        self,
        *,
        tenant_id: str,
        tool_call_id: str,
    ) -> ToolCallRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, agent_run_id, tool_id, inputs, result, allowed,
                  approval_id, created_at, completed_at
                FROM tool_calls
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, tool_call_id),
            ).fetchone()
        if row is None:
            return None
        return _tool_call_from_row(dict(row))

    def _tool_call_from_row(self, row: dict[str, Any]) -> ToolCallRecord:
        return _tool_call_from_row(row)

    def _object_from_json(
        self,
        value: dict[str, Any] | str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        return _object_from_json(value, record_id, field_name)

    def _result_from_json(
        self,
        value: dict[str, Any] | list[Any] | str | int | float | bool | None,
        record_id: str,
    ) -> dict[str, Any] | list[Any] | str | int | float | bool | None:
        return _result_from_json(value, record_id)

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresToolCallReadRepository:
    """Read tenant-scoped tool call records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_tool_calls(
        self,
        *,
        tenant_id: str,
        agent_run_id: str | None = None,
        tool_id: str | None = None,
        allowed: bool | None = None,
        approval_id: str | None = None,
        limit: int = 20,
    ) -> list[ToolCallRecord]:
        query = """
            SELECT id, tenant_id, agent_run_id, tool_id, inputs, result, allowed,
              approval_id, created_at, completed_at
            FROM tool_calls
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if agent_run_id is not None:
            query += " AND agent_run_id = %s"
            parameters.append(agent_run_id)
        if tool_id is not None:
            query += " AND tool_id = %s"
            parameters.append(tool_id)
        if allowed is not None:
            query += " AND allowed = %s"
            parameters.append(allowed)
        if approval_id is not None:
            query += " AND approval_id = %s"
            parameters.append(approval_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_tool_call_from_row(dict(row)) for row in cursor.fetchall()]

    def get_tool_call(
        self,
        *,
        tenant_id: str,
        tool_call_id: str,
    ) -> ToolCallRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, agent_run_id, tool_id, inputs, result,
                      allowed, approval_id, created_at, completed_at
                    FROM tool_calls
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, tool_call_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _tool_call_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresToolCallWriteRepository:
    """Write tenant-scoped tool call records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_tool_call(self, record: ToolCallRecord) -> None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO tool_calls (
                      id, tenant_id, agent_run_id, tool_id, inputs, result, allowed,
                      approval_id, created_at, completed_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s
                    )
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.agent_run_id,
                        record.tool_id,
                        json.dumps(record.inputs, ensure_ascii=False, default=str),
                        (
                            None
                            if record.result is None
                            else json.dumps(
                                record.result,
                                ensure_ascii=False,
                                default=str,
                            )
                        ),
                        1 if record.allowed else 0,
                        record.approval_id,
                        record.created_at,
                        record.completed_at,
                    ),
                )
