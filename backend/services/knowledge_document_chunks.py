"""Service-layer orchestration for tenant-scoped knowledge document chunk writes."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, DocumentChunkRecord


class PlatformKnowledgeDocumentChunkServiceError(ValueError):
    """Raised when a knowledge document chunk mutation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class DocumentChunkWriteRepository(Protocol):
    """Write tenant-scoped knowledge document chunks to the system of record."""

    def append_document_chunk(
        self,
        record: DocumentChunkRecord,
    ) -> DocumentChunkRecord:
        """Persist one tenant-scoped knowledge document chunk."""


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


@dataclass(frozen=True)
class KnowledgeDocumentChunkApiCommandInput:
    """API-facing knowledge document chunk write input."""

    id: str
    tenant_id: str
    document_id: str
    chunk_index: int
    content: str
    metadata: dict[str, Any]
    actor_user_id: str


class PlatformKnowledgeDocumentChunkService:
    """Manage tenant-scoped knowledge document chunks with audit evidence."""

    def __init__(
        self,
        *,
        document_chunk_writer: DocumentChunkWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._document_chunk_writer = document_chunk_writer
        self._audit_event_writer = audit_event_writer
        self._now = now or _utc_now_iso

    def upsert_document_chunk_from_api(
        self,
        input: KnowledgeDocumentChunkApiCommandInput,
    ) -> DocumentChunkRecord:
        timestamp = self._now()
        requested = DocumentChunkRecord(
            id=_required_text(input.id, "id"),
            tenant_id=_required_text(input.tenant_id, "tenant_id"),
            document_id=_required_text(input.document_id, "document_id"),
            chunk_index=input.chunk_index,
            content=_required_text(input.content, "content"),
            metadata=dict(input.metadata),
            created_at=timestamp,
        )
        actor_user_id = _required_text(input.actor_user_id, "actor_user_id")

        try:
            persisted = self._document_chunk_writer.append_document_chunk(requested)
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeDocumentChunkServiceError(500, str(exc)) from exc

        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=persisted.tenant_id,
                    actor_user_id=actor_user_id,
                    event_type="knowledge_document_chunk.upserted",
                    target_type="knowledge_document_chunk",
                    target_id=persisted.id,
                    payload={
                        "schema_version": 1,
                        "tenant_id": persisted.tenant_id,
                        "document_chunk_id": persisted.id,
                        "document_id": persisted.document_id,
                        "chunk_index": persisted.chunk_index,
                        "content_length": len(persisted.content),
                        "metadata_key_count": len(persisted.metadata),
                    },
                    created_at=timestamp,
                ),
            )
        except Exception as exc:
            raise PlatformKnowledgeDocumentChunkServiceError(500, str(exc)) from exc

        if not persisted_audit_event.id:
            raise PlatformKnowledgeDocumentChunkServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )
        return persisted


def _required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise PlatformKnowledgeDocumentChunkServiceError(
            400,
            f"{field_name} is required.",
        )
    return normalized


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
