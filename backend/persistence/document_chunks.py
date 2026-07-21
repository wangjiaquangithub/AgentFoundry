"""Document chunk read repositories.

Document chunks are tenant-scoped knowledge records. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class DocumentChunkRecord:
    id: str
    tenant_id: str
    document_id: str
    chunk_index: int
    content: str
    metadata: dict[str, Any]
    created_at: str


def _document_chunk_from_row(row: dict[str, Any]) -> DocumentChunkRecord:
    return DocumentChunkRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        document_id=row["document_id"],
        chunk_index=row["chunk_index"],
        content=row["content"],
        metadata=_metadata_from_json(row["metadata"], row["id"]),
        created_at=row["created_at"],
    )


def _metadata_from_json(value: dict[str, Any] | str, chunk_id: str) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Document chunk {chunk_id} has invalid metadata JSON.")
    return parsed


class SQLiteDocumentChunkReadRepository:
    """Read tenant-scoped document chunk records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[DocumentChunkRecord]:
        with self._database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, tenant_id, document_id, chunk_index, content, metadata,
                  created_at
                FROM document_chunks
                WHERE tenant_id = ? AND document_id = ?
                ORDER BY chunk_index ASC, id ASC
                LIMIT ?
                """,
                (tenant_id, document_id, self._clamp_limit(limit)),
            ).fetchall()
        return [_document_chunk_from_row(dict(row)) for row in rows]

    def get_document_chunk(
        self,
        *,
        tenant_id: str,
        chunk_id: str,
    ) -> DocumentChunkRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, document_id, chunk_index, content, metadata,
                  created_at
                FROM document_chunks
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, chunk_id),
            ).fetchone()
        if row is None:
            return None
        return _document_chunk_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 200)


class PostgresDocumentChunkReadRepository:
    """Read tenant-scoped document chunk records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[DocumentChunkRecord]:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, document_id, chunk_index, content,
                      metadata, created_at
                    FROM document_chunks
                    WHERE tenant_id = %s AND document_id = %s
                    ORDER BY chunk_index ASC, id ASC
                    LIMIT %s
                    """,
                    (tenant_id, document_id, self._clamp_limit(limit)),
                )
                return [_document_chunk_from_row(dict(row)) for row in cursor.fetchall()]

    def get_document_chunk(
        self,
        *,
        tenant_id: str,
        chunk_id: str,
    ) -> DocumentChunkRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, document_id, chunk_index, content,
                      metadata, created_at
                    FROM document_chunks
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, chunk_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _document_chunk_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 200)
