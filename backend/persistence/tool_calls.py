"""SQLite tool call read repository.

Tool call records are execution evidence and must always be read through an
explicit tenant boundary. This repository is read-only while AgentFoundry moves
tool execution history from development JSONL files into the production data
layer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import SQLiteDatabase


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
        return [self._tool_call_from_row(dict(row)) for row in rows]

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
        return self._tool_call_from_row(dict(row))

    def _tool_call_from_row(self, row: dict[str, Any]) -> ToolCallRecord:
        return ToolCallRecord(
            id=row["id"],
            tenant_id=row["tenant_id"],
            agent_run_id=row["agent_run_id"],
            tool_id=row["tool_id"],
            inputs=self._object_from_json(row["inputs"], row["id"], "inputs"),
            result=self._result_from_json(row["result"], row["id"]),
            allowed=bool(row["allowed"]),
            approval_id=row["approval_id"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
        )

    def _object_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise ValueError(f"Tool call {record_id} has invalid {field_name} JSON.")
        return parsed

    def _result_from_json(
        self,
        value: str | None,
        record_id: str,
    ) -> dict[str, Any] | list[Any] | str | int | float | bool | None:
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
