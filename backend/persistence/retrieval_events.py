"""Retrieval event repositories.

Retrieval events are tenant-scoped evidence records for knowledge access.
PostgreSQL is the production path; SQLite remains an explicit local
development compatibility path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class RetrievalEventRecord:
    id: str
    tenant_id: str
    agent_run_id: str | None
    knowledge_base_id: str | None
    query: str
    hits: list[Any]
    created_at: str


def _retrieval_event_from_row(row: dict[str, Any]) -> RetrievalEventRecord:
    return RetrievalEventRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        agent_run_id=row["agent_run_id"],
        knowledge_base_id=row["knowledge_base_id"],
        query=row["query"],
        hits=_hits_from_json(row["hits"], row["id"]),
        created_at=row["created_at"],
    )


def _hits_from_json(value: list[Any] | str, event_id: str) -> list[Any]:
    parsed = value if isinstance(value, list) else json.loads(value)
    if not isinstance(parsed, list):
        raise ValueError(f"Retrieval event {event_id} has invalid hits JSON.")
    return parsed


def _validate_write_result(
    requested: RetrievalEventRecord,
    persisted: RetrievalEventRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL retrieval event write did not return an event id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL retrieval event write did not return a tenant id.")
    if not persisted.query:
        raise ValueError("PostgreSQL retrieval event write did not return a query.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL retrieval event write returned another event.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL retrieval event write returned another tenant.")
    if persisted.agent_run_id != requested.agent_run_id:
        raise ValueError("PostgreSQL retrieval event write returned another agent run.")
    if persisted.knowledge_base_id != requested.knowledge_base_id:
        raise ValueError(
            "PostgreSQL retrieval event write returned another knowledge base.",
        )
    if persisted.query != requested.query:
        raise ValueError("PostgreSQL retrieval event write returned another query.")


class SQLiteRetrievalEventReadRepository:
    """Read tenant-scoped retrieval events from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_retrieval_events(
        self,
        *,
        tenant_id: str,
        agent_run_id: str | None = None,
        knowledge_base_id: str | None = None,
        limit: int = 50,
    ) -> list[RetrievalEventRecord]:
        query = """
            SELECT id, tenant_id, agent_run_id, knowledge_base_id, query, hits,
              created_at
            FROM retrieval_events
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if agent_run_id is not None:
            query += " AND agent_run_id = ?"
            parameters.append(agent_run_id)
        if knowledge_base_id is not None:
            query += " AND knowledge_base_id = ?"
            parameters.append(knowledge_base_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_retrieval_event_from_row(dict(row)) for row in rows]

    def get_retrieval_event(
        self,
        *,
        tenant_id: str,
        retrieval_event_id: str,
    ) -> RetrievalEventRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, agent_run_id, knowledge_base_id, query,
                  hits, created_at
                FROM retrieval_events
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, retrieval_event_id),
            ).fetchone()
        if row is None:
            return None
        return _retrieval_event_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresRetrievalEventReadRepository:
    """Read tenant-scoped retrieval events from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_retrieval_events(
        self,
        *,
        tenant_id: str,
        agent_run_id: str | None = None,
        knowledge_base_id: str | None = None,
        limit: int = 50,
    ) -> list[RetrievalEventRecord]:
        query = """
            SELECT id, tenant_id, agent_run_id, knowledge_base_id, query, hits,
              created_at
            FROM retrieval_events
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if agent_run_id is not None:
            query += " AND agent_run_id = %s"
            parameters.append(agent_run_id)
        if knowledge_base_id is not None:
            query += " AND knowledge_base_id = %s"
            parameters.append(knowledge_base_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_retrieval_event_from_row(dict(row)) for row in cursor.fetchall()]

    def get_retrieval_event(
        self,
        *,
        tenant_id: str,
        retrieval_event_id: str,
    ) -> RetrievalEventRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, agent_run_id, knowledge_base_id,
                      query, hits, created_at
                    FROM retrieval_events
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, retrieval_event_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _retrieval_event_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresRetrievalEventWriteRepository:
    """Write tenant-scoped retrieval events to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_retrieval_event(
        self,
        record: RetrievalEventRecord,
    ) -> RetrievalEventRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO retrieval_events (
                      id, tenant_id, agent_run_id, knowledge_base_id, query,
                      hits, created_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s
                    )
                    RETURNING id, tenant_id, agent_run_id, knowledge_base_id,
                      query, hits, created_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.agent_run_id,
                        record.knowledge_base_id,
                        record.query,
                        json.dumps(record.hits, ensure_ascii=False),
                        record.created_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Retrieval event insert did not return a row.")
        persisted = _retrieval_event_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
