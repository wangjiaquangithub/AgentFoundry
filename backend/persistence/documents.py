"""Document read repositories.

Documents belong to tenant-scoped knowledge bases. PostgreSQL is the
production path; SQLite remains an explicit local development compatibility
path during the data-layer migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    tenant_id: str
    knowledge_base_id: str
    title: str
    source_type: str
    source_uri: str | None
    object_ref: str | None
    status: str
    created_at: str
    updated_at: str


def _document_from_row(row: dict[str, Any]) -> DocumentRecord:
    return DocumentRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        knowledge_base_id=row["knowledge_base_id"],
        title=row["title"],
        source_type=row["source_type"],
        source_uri=row["source_uri"],
        object_ref=row["object_ref"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _validate_write_result(
    requested: DocumentRecord,
    persisted: DocumentRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL document write did not return a document id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL document write did not return a tenant id.")
    if not persisted.knowledge_base_id:
        raise ValueError("PostgreSQL document write did not return a knowledge base.")
    if not persisted.title:
        raise ValueError("PostgreSQL document write did not return a title.")
    if not persisted.source_type:
        raise ValueError("PostgreSQL document write did not return a source type.")
    if not persisted.status:
        raise ValueError("PostgreSQL document write did not return a status.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL document write returned another document.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL document write returned another tenant.")
    if persisted.knowledge_base_id != requested.knowledge_base_id:
        raise ValueError("PostgreSQL document write returned another knowledge base.")
    if persisted.title != requested.title:
        raise ValueError("PostgreSQL document write returned another title.")
    if persisted.source_type != requested.source_type:
        raise ValueError("PostgreSQL document write returned another source type.")
    if persisted.source_uri != requested.source_uri:
        raise ValueError("PostgreSQL document write returned another source uri.")
    if persisted.object_ref != requested.object_ref:
        raise ValueError("PostgreSQL document write returned another object ref.")
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL document write returned another status.")
    if persisted.updated_at != requested.updated_at:
        raise ValueError("PostgreSQL document write returned another updated time.")


def _validate_document_read_result(
    record: DocumentRecord,
    *,
    tenant_id: str,
    document_id: str | None = None,
    knowledge_base_id: str | None = None,
    status: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL document read returned another tenant.")
    if document_id is not None and record.id != document_id:
        raise ValueError("PostgreSQL document read returned another document.")
    if knowledge_base_id is not None and record.knowledge_base_id != knowledge_base_id:
        raise ValueError("PostgreSQL document read returned another knowledge base.")
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL document read returned another status.")


class SQLiteDocumentReadRepository:
    """Read tenant-scoped document records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_documents(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[DocumentRecord]:
        query = """
            SELECT id, tenant_id, knowledge_base_id, title, source_type,
              source_uri, object_ref, status, created_at, updated_at
            FROM documents
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if knowledge_base_id is not None:
            query += " AND knowledge_base_id = ?"
            parameters.append(knowledge_base_id)
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_document_from_row(dict(row)) for row in rows]

    def get_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
    ) -> DocumentRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, knowledge_base_id, title, source_type,
                  source_uri, object_ref, status, created_at, updated_at
                FROM documents
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, document_id),
            ).fetchone()
        if row is None:
            return None
        return _document_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresDocumentReadRepository:
    """Read tenant-scoped document records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_documents(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[DocumentRecord]:
        query = """
            SELECT id, tenant_id, knowledge_base_id, title, source_type,
              source_uri, object_ref, status, created_at, updated_at
            FROM documents
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if knowledge_base_id is not None:
            query += " AND knowledge_base_id = %s"
            parameters.append(knowledge_base_id)
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                rows = cursor.fetchall()
        records = [_document_from_row(dict(row)) for row in rows]
        for record in records:
            _validate_document_read_result(
                record,
                tenant_id=tenant_id,
                knowledge_base_id=knowledge_base_id,
                status=status,
            )
        return records

    def get_document(
        self,
        *,
        tenant_id: str,
        document_id: str,
    ) -> DocumentRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, knowledge_base_id, title, source_type,
                      source_uri, object_ref, status, created_at, updated_at
                    FROM documents
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, document_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        record = _document_from_row(dict(row))
        _validate_document_read_result(
            record,
            tenant_id=tenant_id,
            document_id=document_id,
        )
        return record

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresDocumentWriteRepository:
    """Write tenant-scoped document records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def upsert_document(self, record: DocumentRecord) -> DocumentRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO documents (
                      id, tenant_id, knowledge_base_id, title, source_type,
                      source_uri, object_ref, status, created_at, updated_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      knowledge_base_id = EXCLUDED.knowledge_base_id,
                      title = EXCLUDED.title,
                      source_type = EXCLUDED.source_type,
                      source_uri = EXCLUDED.source_uri,
                      object_ref = EXCLUDED.object_ref,
                      status = EXCLUDED.status,
                      updated_at = EXCLUDED.updated_at
                    WHERE documents.tenant_id = EXCLUDED.tenant_id
                    RETURNING id, tenant_id, knowledge_base_id, title, source_type,
                      source_uri, object_ref, status, created_at, updated_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.knowledge_base_id,
                        record.title,
                        record.source_type,
                        record.source_uri,
                        record.object_ref,
                        record.status,
                        record.created_at,
                        record.updated_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Document id already exists for another tenant.")
        persisted = _document_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
