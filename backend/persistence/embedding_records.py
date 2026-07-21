"""Embedding record read repositories.

Embedding records link tenant-scoped document chunks to provider-neutral vector
references. PostgreSQL is the production path; SQLite remains an explicit local
development compatibility path during the data-layer migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class EmbeddingRecord:
    id: str
    tenant_id: str
    chunk_id: str
    model_config_id: str
    vector_ref: str
    created_at: str


def _embedding_record_from_row(row: dict[str, Any]) -> EmbeddingRecord:
    return EmbeddingRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        chunk_id=row["chunk_id"],
        model_config_id=row["model_config_id"],
        vector_ref=row["vector_ref"],
        created_at=row["created_at"],
    )


class SQLiteEmbeddingRecordReadRepository:
    """Read tenant-scoped embedding records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
        limit: int = 100,
    ) -> list[EmbeddingRecord]:
        query = """
            SELECT id, tenant_id, chunk_id, model_config_id, vector_ref,
              created_at
            FROM embedding_records
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if chunk_id is not None:
            query += " AND chunk_id = ?"
            parameters.append(chunk_id)
        if model_config_id is not None:
            query += " AND model_config_id = ?"
            parameters.append(model_config_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_embedding_record_from_row(dict(row)) for row in rows]

    def get_embedding_record(
        self,
        *,
        tenant_id: str,
        embedding_record_id: str,
    ) -> EmbeddingRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, chunk_id, model_config_id, vector_ref,
                  created_at
                FROM embedding_records
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, embedding_record_id),
            ).fetchone()
        if row is None:
            return None
        return _embedding_record_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 200)


class PostgresEmbeddingRecordReadRepository:
    """Read tenant-scoped embedding records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
        limit: int = 100,
    ) -> list[EmbeddingRecord]:
        query = """
            SELECT id, tenant_id, chunk_id, model_config_id, vector_ref,
              created_at
            FROM embedding_records
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if chunk_id is not None:
            query += " AND chunk_id = %s"
            parameters.append(chunk_id)
        if model_config_id is not None:
            query += " AND model_config_id = %s"
            parameters.append(model_config_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_embedding_record_from_row(dict(row)) for row in cursor.fetchall()]

    def get_embedding_record(
        self,
        *,
        tenant_id: str,
        embedding_record_id: str,
    ) -> EmbeddingRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, chunk_id, model_config_id, vector_ref,
                      created_at
                    FROM embedding_records
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, embedding_record_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _embedding_record_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 200)


class PostgresEmbeddingRecordWriteRepository:
    """Write tenant-scoped embedding records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_embedding_record(self, record: EmbeddingRecord) -> None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO embedding_records (
                      id, tenant_id, chunk_id, model_config_id, vector_ref,
                      created_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s
                    )
                    ON CONFLICT (tenant_id, chunk_id, model_config_id) DO UPDATE SET
                      id = EXCLUDED.id,
                      vector_ref = EXCLUDED.vector_ref,
                      created_at = EXCLUDED.created_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.chunk_id,
                        record.model_config_id,
                        record.vector_ref,
                        record.created_at,
                    ),
                )

    def delete_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
    ) -> int:
        query = "DELETE FROM embedding_records WHERE tenant_id = %s"
        parameters: list[Any] = [tenant_id]
        if chunk_id is not None:
            query += " AND chunk_id = %s"
            parameters.append(chunk_id)
        if model_config_id is not None:
            query += " AND model_config_id = %s"
            parameters.append(model_config_id)

        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return int(cursor.rowcount)
