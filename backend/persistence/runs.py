"""Agent run persistence repositories."""

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


def _validate_write_result(
    requested: AgentRunRecord,
    persisted: AgentRunRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL agent run write did not return a run id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL agent run write did not return a tenant id.")
    if not persisted.user_id:
        raise ValueError("PostgreSQL agent run write did not return a user id.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL agent run write returned another run.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL agent run write returned another tenant.")
    if persisted.agent_id != requested.agent_id:
        raise ValueError("PostgreSQL agent run write returned another agent.")
    if persisted.agent_version_id != requested.agent_version_id:
        raise ValueError("PostgreSQL agent run write returned another agent version.")
    if persisted.user_id != requested.user_id:
        raise ValueError("PostgreSQL agent run write returned another user.")
    if persisted.session_id != requested.session_id:
        raise ValueError("PostgreSQL agent run write returned another session.")
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL agent run write returned another status.")
    if persisted.question != requested.question:
        raise ValueError("PostgreSQL agent run write returned another question.")
    if persisted.answer != requested.answer:
        raise ValueError("PostgreSQL agent run write returned another answer.")
    if persisted.runtime_provider != requested.runtime_provider:
        raise ValueError(
            "PostgreSQL agent run write returned another runtime provider.",
        )
    if persisted.runtime_invocation_id != requested.runtime_invocation_id:
        raise ValueError(
            "PostgreSQL agent run write returned another runtime invocation.",
        )
    if persisted.created_at != requested.created_at:
        raise ValueError("PostgreSQL agent run write returned another created time.")
    if persisted.completed_at != requested.completed_at:
        raise ValueError("PostgreSQL agent run write returned another completed time.")


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


class PostgresAgentRunWriteRepository:
    """Write tenant-scoped agent run records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_run(self, record: AgentRunRecord) -> AgentRunRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO agent_runs (
                      id, tenant_id, agent_id, agent_version_id, user_id, session_id,
                      status, question, answer, runtime_provider,
                      runtime_invocation_id, created_at, completed_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      tenant_id = EXCLUDED.tenant_id,
                      agent_id = EXCLUDED.agent_id,
                      agent_version_id = EXCLUDED.agent_version_id,
                      user_id = EXCLUDED.user_id,
                      session_id = EXCLUDED.session_id,
                      status = EXCLUDED.status,
                      question = EXCLUDED.question,
                      answer = EXCLUDED.answer,
                      runtime_provider = EXCLUDED.runtime_provider,
                      runtime_invocation_id = EXCLUDED.runtime_invocation_id,
                      created_at = EXCLUDED.created_at,
                      completed_at = EXCLUDED.completed_at
                    RETURNING id, tenant_id, agent_id, agent_version_id, user_id,
                      session_id, status, question, answer, runtime_provider,
                      runtime_invocation_id, created_at, completed_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.agent_id,
                        record.agent_version_id,
                        record.user_id,
                        record.session_id,
                        record.status,
                        record.question,
                        record.answer,
                        record.runtime_provider,
                        record.runtime_invocation_id,
                        record.created_at,
                        record.completed_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Agent run upsert did not return a row.")
        persisted = _run_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted

    def delete_runs(
        self,
        *,
        tenant_id: str,
        agent_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        status: str | None = None,
    ) -> int:
        query = "DELETE FROM agent_runs WHERE tenant_id = %s"
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

        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return cursor.rowcount
