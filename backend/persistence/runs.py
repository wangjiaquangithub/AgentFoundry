"""Agent run read repositories.

This repository is intentionally read-only while AgentFoundry migrates run
history from development JSONL files into the production data layer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class AgentRunRecord:
    id: str
    tenant_id: str
    agent_id: str | None
    agent_version_id: str | None
    user_id: str
    session_id: str | None
    status: str
    question: str
    answer: str | None
    runtime_provider: str
    runtime_invocation_id: str | None
    created_at: str
    completed_at: str | None


def _run_from_row(row: dict[str, Any]) -> AgentRunRecord:
    return AgentRunRecord(**row)


class SQLiteAgentRunReadRepository:
    """Read tenant-scoped agent run records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_runs(
        self,
        *,
        tenant_id: str,
        agent_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[AgentRunRecord]:
        query = """
            SELECT id, tenant_id, agent_id, agent_version_id, user_id, session_id,
              status, question, answer, runtime_provider, runtime_invocation_id,
              created_at, completed_at
            FROM agent_runs
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if agent_id is not None:
            query += " AND agent_id = ?"
            parameters.append(agent_id)
        if user_id is not None:
            query += " AND user_id = ?"
            parameters.append(user_id)
        if session_id is not None:
            query += " AND session_id = ?"
            parameters.append(session_id)
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_run_from_row(dict(row)) for row in rows]

    def get_run(self, *, tenant_id: str, run_id: str) -> AgentRunRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, agent_id, agent_version_id, user_id, session_id,
                  status, question, answer, runtime_provider, runtime_invocation_id,
                  created_at, completed_at
                FROM agent_runs
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, run_id),
            ).fetchone()
        if row is None:
            return None
        return _run_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresAgentRunReadRepository:
    """Read tenant-scoped agent run records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_runs(
        self,
        *,
        tenant_id: str,
        agent_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[AgentRunRecord]:
        query = """
            SELECT id, tenant_id, agent_id, agent_version_id, user_id, session_id,
              status, question, answer, runtime_provider, runtime_invocation_id,
              created_at, completed_at
            FROM agent_runs
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if agent_id is not None:
            query += " AND agent_id = %s"
            parameters.append(agent_id)
        if user_id is not None:
            query += " AND user_id = %s"
            parameters.append(user_id)
        if session_id is not None:
            query += " AND session_id = %s"
            parameters.append(session_id)
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_run_from_row(dict(row)) for row in cursor.fetchall()]

    def get_run(self, *, tenant_id: str, run_id: str) -> AgentRunRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, agent_id, agent_version_id, user_id,
                      session_id, status, question, answer, runtime_provider,
                      runtime_invocation_id, created_at, completed_at
                    FROM agent_runs
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, run_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _run_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
