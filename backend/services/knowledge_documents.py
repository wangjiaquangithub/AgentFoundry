"""Service-layer orchestration for tenant-scoped knowledge document writes."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, DocumentRecord


class PlatformKnowledgeDocumentServiceError(ValueError):
    """Raised when a knowledge document mutation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class DocumentWriteRepository(Protocol):
    """Write tenant-scoped knowledge documents to the system of record."""

    def upsert_document(self, record: DocumentRecord) -> DocumentRecord:
        """Persist one tenant-scoped knowledge document."""


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


@dataclass(frozen=True)
class KnowledgeDocumentApiCommandInput:
    """API-facing knowledge document write input."""

    id: str
    tenant_id: str
    knowledge_base_id: str
    title: str
    source_type: str
    source_uri: str | None
    object_ref: str | None
    status: str
    actor_user_id: str


class PlatformKnowledgeDocumentService:
    """Manage tenant-scoped knowledge documents with audit evidence."""

    def __init__(
        self,
        *,
        document_writer: DocumentWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._document_writer = document_writer
        self._audit_event_writer = audit_event_writer
        self._now = now or _utc_now_iso

    def upsert_document_from_api(
        self,
        input: KnowledgeDocumentApiCommandInput,
    ) -> DocumentRecord:
        timestamp = self._now()
        requested = DocumentRecord(
            id=_required_text(input.id, "id"),
            tenant_id=_required_text(input.tenant_id, "tenant_id"),
            knowledge_base_id=_required_text(
                input.knowledge_base_id,
                "knowledge_base_id",
            ),
            title=_required_text(input.title, "title"),
            source_type=_required_text(input.source_type, "source_type"),
            source_uri=_optional_text(input.source_uri),
            object_ref=_optional_text(input.object_ref),
            status=_required_text(input.status, "status"),
            created_at=timestamp,
            updated_at=timestamp,
        )
        actor_user_id = _required_text(input.actor_user_id, "actor_user_id")

        try:
            persisted = self._document_writer.upsert_document(requested)
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeDocumentServiceError(500, str(exc)) from exc

        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=persisted.tenant_id,
                    actor_user_id=actor_user_id,
                    event_type="knowledge_document.upserted",
                    target_type="knowledge_document",
                    target_id=persisted.id,
                    payload={
                        "schema_version": 1,
                        "tenant_id": persisted.tenant_id,
                        "document_id": persisted.id,
                        "knowledge_base_id": persisted.knowledge_base_id,
                        "title": persisted.title,
                        "source_type": persisted.source_type,
                        "status": persisted.status,
                        "source_uri_configured": bool(persisted.source_uri),
                        "object_ref_configured": bool(persisted.object_ref),
                    },
                    created_at=timestamp,
                ),
            )
        except Exception as exc:
            raise PlatformKnowledgeDocumentServiceError(500, str(exc)) from exc

        if not persisted_audit_event.id:
            raise PlatformKnowledgeDocumentServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )
        return persisted


def _required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise PlatformKnowledgeDocumentServiceError(
            400,
            f"{field_name} is required.",
        )
    return normalized


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
