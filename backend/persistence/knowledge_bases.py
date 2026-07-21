"""Knowledge base read repositories.

Knowledge base metadata is tenant-scoped platform data. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class KnowledgeBaseRecord:
    id: str
    tenant_id: str
    name: str
    description: str | None
    status: str
    embedding_model_config_id: str | None
    created_at: str
    updated_at: str


def _knowledge_base_from_row(row: dict[str, Any]) -> KnowledgeBaseRecord:
    return KnowledgeBaseRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        embedding_model_config_id=row["embedding_model_config_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class SQLiteKnowledgeBaseReadRepository:
    """Read tenant-scoped knowledge base records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_knowledge_bases(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        limit: int = 50,
    ) -> list[KnowledgeBaseRecord]:
        query = """
            SELECT id, tenant_id, name, description, status,
              embedding_model_config_id, created_at, updated_at
            FROM knowledge_bases
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY name ASC, id ASC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_knowledge_base_from_row(dict(row)) for row in rows]

    def get_knowledge_base(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
    ) -> KnowledgeBaseRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, status,
                  embedding_model_config_id, created_at, updated_at
                FROM knowledge_bases
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, knowledge_base_id),
            ).fetchone()
        if row is None:
            return None
        return _knowledge_base_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresKnowledgeBaseReadRepository:
    """Read tenant-scoped knowledge base records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_knowledge_bases(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        limit: int = 50,
    ) -> list[KnowledgeBaseRecord]:
        query = """
            SELECT id, tenant_id, name, description, status,
              embedding_model_config_id, created_at, updated_at
            FROM knowledge_bases
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY name ASC, id ASC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_knowledge_base_from_row(dict(row)) for row in cursor.fetchall()]

    def get_knowledge_base(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
    ) -> KnowledgeBaseRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, status,
                      embedding_model_config_id, created_at, updated_at
                    FROM knowledge_bases
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, knowledge_base_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _knowledge_base_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
