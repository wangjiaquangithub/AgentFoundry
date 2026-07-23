"""Service-layer orchestration for tenant-scoped embedding record writes."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, EmbeddingRecord


class PlatformKnowledgeEmbeddingRecordServiceError(ValueError):
    """Raised when an embedding record mutation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class EmbeddingRecordWriteRepository(Protocol):
    """Write tenant-scoped embedding records to the production system of record."""

    def append_embedding_record(self, record: EmbeddingRecord) -> EmbeddingRecord:
        """Persist one tenant-scoped embedding record."""


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


@dataclass(frozen=True)
class EmbeddingRecordApiCommandInput:
    """API-facing embedding record write input."""

    id: str
    tenant_id: str
    chunk_id: str
    model_config_id: str
    vector_ref: str
    actor_user_id: str


class PlatformKnowledgeEmbeddingRecordService:
    """Manage tenant-scoped embedding records with audit evidence."""

    def __init__(
        self,
        *,
        embedding_record_writer: EmbeddingRecordWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._embedding_record_writer = embedding_record_writer
        self._audit_event_writer = audit_event_writer
        self._now = now or _utc_now_iso

    def upsert_embedding_record_from_api(
        self,
        input: EmbeddingRecordApiCommandInput,
    ) -> EmbeddingRecord:
        timestamp = self._now()
        requested = EmbeddingRecord(
            id=_required_text(input.id, "id"),
            tenant_id=_required_text(input.tenant_id, "tenant_id"),
            chunk_id=_required_text(input.chunk_id, "chunk_id"),
            model_config_id=_required_text(input.model_config_id, "model_config_id"),
            vector_ref=_required_text(input.vector_ref, "vector_ref"),
            created_at=timestamp,
        )
        actor_user_id = _required_text(input.actor_user_id, "actor_user_id")

        try:
            persisted = self._embedding_record_writer.append_embedding_record(requested)
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeEmbeddingRecordServiceError(500, str(exc)) from exc

        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=persisted.tenant_id,
                    actor_user_id=actor_user_id,
                    event_type="knowledge_embedding_record.upserted",
                    target_type="knowledge_embedding_record",
                    target_id=persisted.id,
                    payload={
                        "schema_version": 1,
                        "tenant_id": persisted.tenant_id,
                        "embedding_record_id": persisted.id,
                        "chunk_id": persisted.chunk_id,
                        "model_config_id": persisted.model_config_id,
                        "vector_ref_configured": bool(persisted.vector_ref),
                    },
                    created_at=timestamp,
                ),
            )
        except Exception as exc:
            raise PlatformKnowledgeEmbeddingRecordServiceError(500, str(exc)) from exc

        if not persisted_audit_event.id:
            raise PlatformKnowledgeEmbeddingRecordServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )
        return persisted


def _required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise PlatformKnowledgeEmbeddingRecordServiceError(
            400,
            f"{field_name} is required.",
        )
    return normalized


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
