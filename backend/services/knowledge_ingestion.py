"""Deterministic ingestion service for tenant knowledge documents."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Callable, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, DocumentChunkRecord, DocumentRecord


class PlatformKnowledgeIngestionServiceError(Exception):
    """Raised when knowledge ingestion infrastructure cannot complete safely."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class KnowledgeBaseReadRepository(Protocol):
    def get_knowledge_base(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
    ) -> Any | None:
        ...


class DocumentWriteRepository(Protocol):
    def upsert_document(self, record: DocumentRecord) -> DocumentRecord:
        ...


class DocumentChunkWriteRepository(Protocol):
    def append_document_chunk(self, record: DocumentChunkRecord) -> DocumentChunkRecord:
        ...

    def delete_document_chunks(self, *, tenant_id: str, document_id: str) -> int:
        ...


class DocumentChunkReadRepository(Protocol):
    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[DocumentChunkRecord]:
        ...


class EmbeddingRecordDeleteRepository(Protocol):
    def delete_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
    ) -> int:
        ...


class AuditEventWriteRepository(Protocol):
    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        ...


@dataclass(frozen=True)
class KnowledgeIngestionRequest:
    tenant_id: str
    knowledge_base_id: str
    title: str
    text: str
    actor_user_id: str
    source_type: str = "text"
    source_uri: str | None = None
    object_ref: str | None = None
    document_id: str | None = None


@dataclass(frozen=True)
class KnowledgeIngestionResult:
    tenant_id: str
    knowledge_base_id: str
    document_id: str
    status: str
    chunk_count: int
    embedding_model_config_id: str | None
    embedding_required: bool
    guidance: str | None = None


@dataclass(frozen=True)
class PlannedChunk:
    id: str
    index: int
    content: str
    metadata: dict[str, Any]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} is required.")
    return normalized


def _stable_id(prefix: str, *parts: str) -> str:
    digest = sha256("\n".join(parts).encode("utf-8")).hexdigest()[:24]
    return f"{prefix}_{digest}"


class PlatformKnowledgeIngestionService:
    """Persist documents and chunks without pretending embeddings exist."""

    def __init__(
        self,
        *,
        knowledge_base_repository: KnowledgeBaseReadRepository,
        document_repository: DocumentWriteRepository,
        document_chunk_repository: DocumentChunkWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        document_chunk_read_repository: DocumentChunkReadRepository | None = None,
        embedding_record_repository: EmbeddingRecordDeleteRepository | None = None,
        now: Callable[[], str] = _utc_now,
        target_chunk_size: int = 900,
    ) -> None:
        self._knowledge_base_repository = knowledge_base_repository
        self._document_repository = document_repository
        self._document_chunk_repository = document_chunk_repository
        self._audit_event_writer = audit_event_writer
        self._document_chunk_read_repository = document_chunk_read_repository
        self._embedding_record_repository = embedding_record_repository
        self._now = now
        self._target_chunk_size = max(target_chunk_size, 200)

    def ingest_text(self, request: KnowledgeIngestionRequest) -> KnowledgeIngestionResult:
        tenant_id = _require_text(request.tenant_id, "tenant_id")
        knowledge_base_id = _require_text(
            request.knowledge_base_id,
            "knowledge_base_id",
        )
        title = _require_text(request.title, "title")
        text = _require_text(request.text, "text")
        actor_user_id = _require_text(request.actor_user_id, "actor_user_id")

        try:
            knowledge_base = self._knowledge_base_repository.get_knowledge_base(
                tenant_id=tenant_id,
                knowledge_base_id=knowledge_base_id,
            )
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeIngestionServiceError(500, str(exc)) from exc
        if knowledge_base is None:
            raise ValueError("Knowledge base was not found for this tenant.")

        document_id = self._document_id(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            text=text,
            requested_document_id=request.document_id,
        )
        now = self._now()
        chunks = self.plan_chunks(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            document_id=document_id,
            text=text,
        )
        try:
            self._replace_existing_chunks(tenant_id=tenant_id, document_id=document_id)
            persisted_document = self._document_repository.upsert_document(
                DocumentRecord(
                    id=document_id,
                    tenant_id=tenant_id,
                    knowledge_base_id=knowledge_base_id,
                    title=title,
                    source_type=_require_text(request.source_type, "source_type"),
                    source_uri=request.source_uri,
                    object_ref=request.object_ref,
                    status="ready",
                    created_at=now,
                    updated_at=now,
                ),
            )
            persisted_chunks: list[DocumentChunkRecord] = []
            for chunk in chunks:
                persisted_chunks.append(
                    self._document_chunk_repository.append_document_chunk(
                        DocumentChunkRecord(
                            id=chunk.id,
                            tenant_id=tenant_id,
                            document_id=persisted_document.id,
                            chunk_index=chunk.index,
                            content=chunk.content,
                            metadata=chunk.metadata,
                            created_at=now,
                        ),
                    ),
                )
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeIngestionServiceError(500, str(exc)) from exc

        embedding_model_config_id = str(
            getattr(knowledge_base, "embedding_model_config_id", "") or ""
        ).strip() or None
        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    actor_user_id=actor_user_id,
                    event_type="knowledge_document.ingested",
                    target_type="knowledge_document",
                    target_id=persisted_document.id,
                    payload={
                        "schema_version": 1,
                        "tenant_id": tenant_id,
                        "knowledge_base_id": knowledge_base_id,
                        "document_id": persisted_document.id,
                        "status": "ready",
                        "chunk_count": len(persisted_chunks),
                        "embedding_model_config_id": embedding_model_config_id,
                        "embedding_required": True,
                        "source_type": persisted_document.source_type,
                        "has_source_uri": bool(persisted_document.source_uri),
                        "has_object_ref": bool(persisted_document.object_ref),
                    },
                    created_at=now,
                ),
            )
        except Exception as exc:
            raise PlatformKnowledgeIngestionServiceError(500, str(exc)) from exc

        if not str(persisted_audit_event.id or "").strip():
            raise PlatformKnowledgeIngestionServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )
        guidance = (
            "Document chunks are persisted; create embedding records with a real "
            "provider before production retrieval is ready."
        )
        return KnowledgeIngestionResult(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            document_id=persisted_document.id,
            status="ready",
            chunk_count=len(persisted_chunks),
            embedding_model_config_id=embedding_model_config_id,
            embedding_required=True,
            guidance=guidance,
        )

    def plan_chunks(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
        document_id: str,
        text: str,
    ) -> list[PlannedChunk]:
        paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
        chunks: list[str] = []
        current: list[str] = []
        current_length = 0
        for paragraph in paragraphs or [text.strip()]:
            paragraph_length = len(paragraph)
            if current and current_length + paragraph_length + 2 > self._target_chunk_size:
                chunks.append("\n\n".join(current))
                current = []
                current_length = 0
            if paragraph_length > self._target_chunk_size:
                chunks.extend(self._split_long_paragraph(paragraph))
                continue
            current.append(paragraph)
            current_length += paragraph_length + 2
        if current:
            chunks.append("\n\n".join(current))

        total_chunks = len(chunks)
        return [
            PlannedChunk(
                id=_stable_id(
                    "chunk",
                    tenant_id,
                    knowledge_base_id,
                    document_id,
                    str(index),
                    content,
                ),
                index=index,
                content=content,
                metadata={
                    "schema_version": 1,
                    "chunking": "paragraph",
                    "total_chunks": total_chunks,
                    "content_sha256": sha256(content.encode("utf-8")).hexdigest(),
                },
            )
            for index, content in enumerate(chunks)
        ]

    def _split_long_paragraph(self, paragraph: str) -> list[str]:
        chunks: list[str] = []
        start = 0
        while start < len(paragraph):
            chunks.append(paragraph[start : start + self._target_chunk_size].strip())
            start += self._target_chunk_size
        return [chunk for chunk in chunks if chunk]

    def _replace_existing_chunks(self, *, tenant_id: str, document_id: str) -> None:
        if self._document_chunk_read_repository and self._embedding_record_repository:
            old_chunks = self._document_chunk_read_repository.list_document_chunks(
                tenant_id=tenant_id,
                document_id=document_id,
                limit=200,
            )
            for chunk in old_chunks:
                self._embedding_record_repository.delete_embedding_records(
                    tenant_id=tenant_id,
                    chunk_id=chunk.id,
                )
        self._document_chunk_repository.delete_document_chunks(
            tenant_id=tenant_id,
            document_id=document_id,
        )

    def _document_id(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
        title: str,
        text: str,
        requested_document_id: str | None,
    ) -> str:
        if requested_document_id is not None and str(requested_document_id).strip():
            return str(requested_document_id).strip()
        return _stable_id("doc", tenant_id, knowledge_base_id, title, text)
