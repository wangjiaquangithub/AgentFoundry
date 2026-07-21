"""Formatting helpers for platform knowledge search responses."""

import json
import re
from typing import Any, Callable, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, RetrievalEventRecord


class AuditEventWriter(Protocol):
    def append_audit_event(self, record: AuditEventRecord) -> None:
        ...


class RetrievalEventWriter(Protocol):
    def append_retrieval_event(
        self,
        record: RetrievalEventRecord,
    ) -> RetrievalEventRecord:
        ...


class KnowledgeBaseReadRepository(Protocol):
    def get_knowledge_base(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
    ) -> Any | None:
        ...


class DocumentReadRepository(Protocol):
    def list_documents(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[Any]:
        ...


class DocumentChunkReadRepository(Protocol):
    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[Any]:
        ...


class EmbeddingRecordReadRepository(Protocol):
    def list_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
        limit: int = 100,
    ) -> list[Any]:
        ...


class ModelConfigReadRepository(Protocol):
    def get_model_config(
        self,
        *,
        tenant_id: str,
        model_config_id: str,
    ) -> Any | None:
        ...


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _chunk_text(chunk: Any) -> str:
    content = getattr(chunk, "content", None)
    if getattr(content, "type", None) == "text":
        return str(getattr(content, "text", "")).strip()

    name = getattr(content, "name", None)
    if name:
        return str(name).strip()

    source = getattr(chunk, "source", None)
    return str(source or "").strip()


def _record_id(record: Any) -> str:
    return str(getattr(record, "id", "") or "").strip()


def _record_status(record: Any) -> str:
    return str(getattr(record, "status", "") or "").strip().lower()


def _is_ready_status(status: str) -> bool:
    return status in {"active", "ready", "indexed", "completed"}


def _normalize_terms(value: str) -> list[str]:
    return [
        term
        for term in re.findall(r"[\w\u4e00-\u9fff]+", value.lower())
        if term
    ]


class PlatformKnowledgeRetrievalService:
    """Retrieve tenant knowledge chunks from PostgreSQL-backed repositories."""

    def __init__(
        self,
        *,
        knowledge_base_repository: KnowledgeBaseReadRepository,
        document_repository: DocumentReadRepository,
        document_chunk_repository: DocumentChunkReadRepository,
        retrieval_event_writer: RetrievalEventWriter | None = None,
        audit_event_writer: AuditEventWriter | None = None,
        now: Callable[[], str] | None = None,
        document_limit: int = 100,
        chunk_limit: int = 200,
    ) -> None:
        self._knowledge_base_repository = knowledge_base_repository
        self._document_repository = document_repository
        self._document_chunk_repository = document_chunk_repository
        self._retrieval_event_writer = retrieval_event_writer
        self._audit_event_writer = audit_event_writer
        self._now = now
        self._document_limit = document_limit
        self._chunk_limit = chunk_limit

    def retrieve(
        self,
        *,
        tenant_id: str,
        knowledge_base_ids: list[str],
        query: str,
        user_id: str | None = None,
        agent_run_id: str | None = None,
        limit: int = 5,
    ) -> dict[str, Any]:
        normalized_query = query.strip()
        bound_knowledge_base_ids = [
            str(knowledge_base_id).strip()
            for knowledge_base_id in knowledge_base_ids
            if str(knowledge_base_id).strip()
        ]
        if not bound_knowledge_base_ids:
            payload = self._empty_payload(
                status="not_configured",
                bound_knowledge_base_ids=[],
                query=normalized_query,
                guidance="Bind at least one knowledge base to enable production retrieval.",
            )
            self._append_retrieval_event(
                tenant_id=tenant_id,
                user_id=user_id,
                agent_run_id=agent_run_id,
                payload=payload,
            )
            return payload
        if not normalized_query:
            payload = self._empty_payload(
                status="blocked",
                bound_knowledge_base_ids=bound_knowledge_base_ids,
                query=normalized_query,
                guidance="query is required for production retrieval.",
            )
            self._append_retrieval_event(
                tenant_id=tenant_id,
                user_id=user_id,
                agent_run_id=agent_run_id,
                payload=payload,
            )
            return payload

        query_terms = _normalize_terms(normalized_query)
        if not query_terms:
            payload = self._empty_payload(
                status="blocked",
                bound_knowledge_base_ids=bound_knowledge_base_ids,
                query=normalized_query,
                guidance="query must contain searchable text.",
            )
            self._append_retrieval_event(
                tenant_id=tenant_id,
                user_id=user_id,
                agent_run_id=agent_run_id,
                payload=payload,
            )
            return payload

        hits: list[dict[str, Any]] = []
        blocked_knowledge_base_ids: list[str] = []
        ready_knowledge_base_ids: list[str] = []
        ready_document_count = 0
        scanned_chunk_count = 0

        for knowledge_base_id in bound_knowledge_base_ids:
            knowledge_base = self._knowledge_base_repository.get_knowledge_base(
                tenant_id=tenant_id,
                knowledge_base_id=knowledge_base_id,
            )
            if knowledge_base is None or not _is_ready_status(_record_status(knowledge_base)):
                blocked_knowledge_base_ids.append(knowledge_base_id)
                continue

            ready_knowledge_base_ids.append(knowledge_base_id)
            documents = self._document_repository.list_documents(
                tenant_id=tenant_id,
                knowledge_base_id=knowledge_base_id,
                limit=self._document_limit,
            )
            for document in documents:
                if not _is_ready_status(_record_status(document)):
                    continue
                ready_document_count += 1
                chunks = self._document_chunk_repository.list_document_chunks(
                    tenant_id=tenant_id,
                    document_id=_record_id(document),
                    limit=self._chunk_limit,
                )
                scanned_chunk_count += len(chunks)
                for chunk in chunks:
                    score = self._score_chunk(
                        query_terms=query_terms,
                        document=document,
                        chunk=chunk,
                    )
                    if score <= 0:
                        continue
                    hits.append(
                        self._hit_payload(
                            score=score,
                            knowledge_base_id=knowledge_base_id,
                            document=document,
                            chunk=chunk,
                        )
                    )

        hits.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["knowledge_base_id"]),
                str(item["document_id"]),
                int(item["chunk_index"]),
                str(item["chunk_id"]),
            )
        )
        trimmed_hits = hits[: min(max(limit, 1), 20)]
        status, guidance = self._classify_result(
            ready_knowledge_base_ids=ready_knowledge_base_ids,
            blocked_knowledge_base_ids=blocked_knowledge_base_ids,
            ready_document_count=ready_document_count,
            scanned_chunk_count=scanned_chunk_count,
            hit_count=len(trimmed_hits),
        )
        payload: dict[str, Any] = {
            "status": status,
            "retrieval_mode": "deterministic_lexical",
            "bound_knowledge_base_ids": bound_knowledge_base_ids,
            "ready_knowledge_base_ids": ready_knowledge_base_ids,
            "blocked_knowledge_base_ids": blocked_knowledge_base_ids,
            "query": normalized_query,
            "hits": trimmed_hits,
            "summary": {
                "ready_knowledge_base_count": len(ready_knowledge_base_ids),
                "ready_document_count": ready_document_count,
                "scanned_chunk_count": scanned_chunk_count,
                "hit_count": len(trimmed_hits),
            },
        }
        if guidance:
            payload["guidance"] = guidance
        self._append_retrieval_event(
            tenant_id=tenant_id,
            user_id=user_id,
            agent_run_id=agent_run_id,
            payload=payload,
        )
        return payload

    def _score_chunk(
        self,
        *,
        query_terms: list[str],
        document: Any,
        chunk: Any,
    ) -> float:
        content = str(getattr(chunk, "content", "") or "").lower()
        title = str(getattr(document, "title", "") or "").lower()
        if not content and not title:
            return 0.0

        content_terms = set(_normalize_terms(content))
        title_terms = set(_normalize_terms(title))
        matched_terms = {
            term
            for term in query_terms
            if term in content_terms or term in title_terms or term in content
        }
        if not matched_terms:
            return 0.0

        content_frequency = sum(content.count(term) for term in matched_terms)
        title_boost = sum(1 for term in matched_terms if term in title_terms)
        coverage = len(matched_terms) / len(set(query_terms))
        return round(coverage + (content_frequency * 0.1) + (title_boost * 0.2), 6)

    def _hit_payload(
        self,
        *,
        score: float,
        knowledge_base_id: str,
        document: Any,
        chunk: Any,
    ) -> dict[str, Any]:
        content = str(getattr(chunk, "content", "") or "")
        snippet = content.strip()
        if len(snippet) > 500:
            snippet = f"{snippet[:497]}..."
        return {
            "knowledge_base_id": knowledge_base_id,
            "document_id": _record_id(document),
            "document_title": str(getattr(document, "title", "") or ""),
            "source_uri": getattr(document, "source_uri", None),
            "chunk_id": _record_id(chunk),
            "chunk_index": int(getattr(chunk, "chunk_index", 0) or 0),
            "score": score,
            "snippet": snippet,
            "metadata": _json_safe(getattr(chunk, "metadata", {}) or {}),
        }

    def _classify_result(
        self,
        *,
        ready_knowledge_base_ids: list[str],
        blocked_knowledge_base_ids: list[str],
        ready_document_count: int,
        scanned_chunk_count: int,
        hit_count: int,
    ) -> tuple[str, str | None]:
        if not ready_knowledge_base_ids:
            return "blocked", "No requested knowledge base is ready for retrieval."
        if ready_document_count == 0:
            return "not_configured", "Ready knowledge bases do not contain ready documents."
        if scanned_chunk_count == 0:
            return "blocked", "Ready documents do not have indexed chunks."
        if hit_count == 0:
            return "ready", "No matching chunks were found for this query."
        if blocked_knowledge_base_ids:
            return "degraded", "Some requested knowledge bases are not ready."
        return "ready", None

    def _empty_payload(
        self,
        *,
        status: str,
        bound_knowledge_base_ids: list[str],
        query: str,
        guidance: str,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "retrieval_mode": "deterministic_lexical",
            "bound_knowledge_base_ids": bound_knowledge_base_ids,
            "ready_knowledge_base_ids": [],
            "blocked_knowledge_base_ids": [],
            "query": query,
            "hits": [],
            "summary": {
                "ready_knowledge_base_count": 0,
                "ready_document_count": 0,
                "scanned_chunk_count": 0,
                "hit_count": 0,
            },
            "guidance": guidance,
        }

    def _append_retrieval_event(
        self,
        *,
        tenant_id: str,
        user_id: str | None,
        agent_run_id: str | None,
        payload: dict[str, Any],
    ) -> None:
        if self._retrieval_event_writer is None or self._now is None:
            return

        event_id = uuid4().hex
        created_at = self._now()
        safe_hits = _json_safe(payload.get("hits") or [])
        knowledge_base_id = self._primary_knowledge_base_id(payload)
        try:
            persisted_event = self._retrieval_event_writer.append_retrieval_event(
                RetrievalEventRecord(
                    id=event_id,
                    tenant_id=tenant_id,
                    agent_run_id=agent_run_id,
                    knowledge_base_id=knowledge_base_id,
                    query=str(payload.get("query") or ""),
                    hits=safe_hits,
                    created_at=created_at,
                ),
            )
        except Exception:
            return

        self._append_retrieval_audit_event(
            event_id=persisted_event.id,
            tenant_id=tenant_id,
            user_id=user_id,
            agent_run_id=agent_run_id,
            knowledge_base_id=knowledge_base_id,
            payload=payload,
            hits=safe_hits,
            created_at=persisted_event.created_at,
        )

    def _append_retrieval_audit_event(
        self,
        *,
        event_id: str,
        tenant_id: str,
        user_id: str | None,
        agent_run_id: str | None,
        knowledge_base_id: str | None,
        payload: dict[str, Any],
        hits: list[dict[str, Any]],
        created_at: str,
    ) -> None:
        if self._audit_event_writer is None:
            return

        try:
            audit_payload: dict[str, Any] = {
                "schema_version": 1,
                "retrieval_event_id": event_id,
                "tenant": tenant_id,
                "user_id": user_id,
                "agent_run_id": agent_run_id,
                "knowledge_base_id": knowledge_base_id,
                "bound_knowledge_base_ids": _json_safe(
                    payload.get("bound_knowledge_base_ids") or []
                ),
                "ready_knowledge_base_ids": _json_safe(
                    payload.get("ready_knowledge_base_ids") or []
                ),
                "blocked_knowledge_base_ids": _json_safe(
                    payload.get("blocked_knowledge_base_ids") or []
                ),
                "query": str(payload.get("query") or ""),
                "status": str(payload.get("status") or ""),
                "hit_count": len(hits),
                "document_ids": [
                    str(hit.get("document_id") or "")
                    for hit in hits
                    if str(hit.get("document_id") or "").strip()
                ],
                "retrieval_mode": str(payload.get("retrieval_mode") or ""),
            }
            self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=tenant_id,
                    actor_user_id=user_id,
                    event_type="knowledge_base.retrieved",
                    target_type="knowledge_base",
                    target_id=knowledge_base_id,
                    payload=_json_safe(audit_payload),
                    created_at=created_at,
                ),
            )
        except Exception:
            return

    def _primary_knowledge_base_id(self, payload: dict[str, Any]) -> str | None:
        for key in ("ready_knowledge_base_ids", "bound_knowledge_base_ids"):
            values = payload.get(key) or []
            if not isinstance(values, list):
                continue
            for value in values:
                knowledge_base_id = str(value or "").strip()
                if knowledge_base_id:
                    return knowledge_base_id
        return None


class PlatformKnowledgeDocumentReadinessService:
    """Summarize whether bound knowledge bases are indexed for retrieval."""

    def __init__(
        self,
        *,
        knowledge_base_repository: KnowledgeBaseReadRepository,
        document_repository: DocumentReadRepository,
        document_chunk_repository: DocumentChunkReadRepository,
        embedding_record_repository: EmbeddingRecordReadRepository,
        model_config_repository: ModelConfigReadRepository,
        document_limit: int = 100,
        chunk_limit: int = 200,
    ) -> None:
        self._knowledge_base_repository = knowledge_base_repository
        self._document_repository = document_repository
        self._document_chunk_repository = document_chunk_repository
        self._embedding_record_repository = embedding_record_repository
        self._model_config_repository = model_config_repository
        self._document_limit = document_limit
        self._chunk_limit = chunk_limit

    def build_readiness(
        self,
        *,
        tenant_id: str,
        knowledge_base_ids: list[str],
    ) -> dict[str, Any]:
        bound_knowledge_base_ids = [
            str(knowledge_base_id).strip()
            for knowledge_base_id in knowledge_base_ids
            if str(knowledge_base_id).strip()
        ]
        if not bound_knowledge_base_ids:
            return {
                "status": "not_configured",
                "bound_knowledge_base_ids": [],
                "knowledge_bases": [],
                "guidance": "Bind at least one knowledge base to enable production retrieval.",
            }

        knowledge_bases = [
            self._build_knowledge_base_readiness(
                tenant_id=tenant_id,
                knowledge_base_id=knowledge_base_id,
            )
            for knowledge_base_id in bound_knowledge_base_ids
        ]
        statuses = {item["status"] for item in knowledge_bases}
        if "blocked" in statuses:
            status = "blocked"
            guidance = "Resolve blocked knowledge base indexing or embedding configuration before retrieval."
        elif "not_configured" in statuses:
            status = "not_configured"
            guidance = "Create documents, chunks, embeddings, and an active embedding model config."
        elif "degraded" in statuses:
            status = "degraded"
            guidance = "Some bound knowledge bases are only partially indexed."
        else:
            status = "ready"
            guidance = None

        payload: dict[str, Any] = {
            "status": status,
            "bound_knowledge_base_ids": bound_knowledge_base_ids,
            "knowledge_bases": knowledge_bases,
            "summary": {
                "knowledge_base_count": len(knowledge_bases),
                "ready_knowledge_base_count": sum(
                    1 for item in knowledge_bases if item["status"] == "ready"
                ),
                "embedding_configured_knowledge_base_count": sum(
                    1 for item in knowledge_bases if item["embedding_configured"]
                ),
                "embedding_ready_knowledge_base_count": sum(
                    1 for item in knowledge_bases if item["embedding_ready"]
                ),
                "document_count": sum(item["document_count"] for item in knowledge_bases),
                "ready_document_count": sum(
                    item["ready_document_count"] for item in knowledge_bases
                ),
                "chunk_count": sum(item["chunk_count"] for item in knowledge_bases),
                "embedded_chunk_count": sum(
                    item["embedded_chunk_count"] for item in knowledge_bases
                ),
                "embedding_record_count": sum(
                    item["embedding_record_count"] for item in knowledge_bases
                ),
            },
        }
        if guidance:
            payload["guidance"] = guidance
        return payload

    def _build_knowledge_base_readiness(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str,
    ) -> dict[str, Any]:
        knowledge_base = self._knowledge_base_repository.get_knowledge_base(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
        )
        if knowledge_base is None:
            return {
                "id": knowledge_base_id,
                "status": "not_configured",
                "knowledge_base_status": None,
                "embedding_model_config_id": None,
                "embedding_model_config_status": None,
                "embedding_configured": False,
                "embedding_ready": False,
                "embedding_guidance": "Create the knowledge base before assigning an embedding model config.",
                "document_count": 0,
                "ready_document_count": 0,
                "chunk_count": 0,
                "embedded_chunk_count": 0,
                "embedding_record_count": 0,
                "guidance": "Knowledge base metadata was not found for this tenant.",
            }

        knowledge_base_status = _record_status(knowledge_base)
        embedding_model_config_id = str(
            getattr(knowledge_base, "embedding_model_config_id", "") or ""
        ).strip()
        model_config = (
            self._model_config_repository.get_model_config(
                tenant_id=tenant_id,
                model_config_id=embedding_model_config_id,
            )
            if embedding_model_config_id
            else None
        )
        model_config_status = _record_status(model_config) if model_config else None
        documents = self._document_repository.list_documents(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            limit=self._document_limit,
        )
        ready_documents = [
            document for document in documents if _is_ready_status(_record_status(document))
        ]

        chunk_count = 0
        embedded_chunk_ids: set[str] = set()
        embedding_record_count = 0
        documents_with_chunks = 0
        documents_with_embeddings = 0
        for document in ready_documents:
            chunks = self._document_chunk_repository.list_document_chunks(
                tenant_id=tenant_id,
                document_id=_record_id(document),
                limit=self._chunk_limit,
            )
            if chunks:
                documents_with_chunks += 1
            document_has_embedding = False
            chunk_count += len(chunks)
            for chunk in chunks:
                embeddings = self._embedding_record_repository.list_embedding_records(
                    tenant_id=tenant_id,
                    chunk_id=_record_id(chunk),
                    model_config_id=embedding_model_config_id or None,
                    limit=1,
                )
                embedding_record_count += len(embeddings)
                if embeddings:
                    embedded_chunk_ids.add(_record_id(chunk))
                    document_has_embedding = True
            if document_has_embedding:
                documents_with_embeddings += 1

        status, guidance = self._classify_knowledge_base(
            knowledge_base_status=knowledge_base_status,
            document_count=len(documents),
            ready_document_count=len(ready_documents),
            chunk_count=chunk_count,
            embedded_chunk_count=len(embedded_chunk_ids),
            embedding_model_config_id=embedding_model_config_id,
            embedding_model_config_status=model_config_status,
            documents_with_chunks=documents_with_chunks,
            documents_with_embeddings=documents_with_embeddings,
        )
        embedding_configured = bool(embedding_model_config_id)
        embedding_ready = bool(
            embedding_configured
            and model_config_status is not None
            and _is_ready_status(model_config_status)
        )
        embedding_guidance = self._embedding_guidance(
            embedding_model_config_id=embedding_model_config_id,
            embedding_model_config_status=model_config_status,
            chunk_count=chunk_count,
            embedded_chunk_count=len(embedded_chunk_ids),
        )
        return {
            "id": knowledge_base_id,
            "status": status,
            "knowledge_base_status": knowledge_base_status,
            "embedding_model_config_id": embedding_model_config_id or None,
            "embedding_model_config_status": model_config_status,
            "embedding_configured": embedding_configured,
            "embedding_ready": embedding_ready,
            "embedding_guidance": embedding_guidance,
            "document_count": len(documents),
            "ready_document_count": len(ready_documents),
            "document_with_chunk_count": documents_with_chunks,
            "document_with_embedding_count": documents_with_embeddings,
            "chunk_count": chunk_count,
            "embedded_chunk_count": len(embedded_chunk_ids),
            "embedding_record_count": embedding_record_count,
            "guidance": guidance,
        }

    def _classify_knowledge_base(
        self,
        *,
        knowledge_base_status: str,
        document_count: int,
        ready_document_count: int,
        chunk_count: int,
        embedded_chunk_count: int,
        embedding_model_config_id: str,
        embedding_model_config_status: str | None,
        documents_with_chunks: int,
        documents_with_embeddings: int,
    ) -> tuple[str, str | None]:
        if not _is_ready_status(knowledge_base_status):
            return "blocked", "Knowledge base is not active."
        if not embedding_model_config_id:
            return "not_configured", "Assign an embedding model config to this knowledge base."
        if not embedding_model_config_status:
            return "blocked", "Embedding model config record was not found."
        if not _is_ready_status(embedding_model_config_status):
            return "blocked", "Embedding model config is not active."
        if document_count == 0:
            return "not_configured", "Upload at least one document."
        if ready_document_count == 0:
            return "blocked", "No documents are ready for indexing."
        if chunk_count == 0:
            return "blocked", "Ready documents do not have indexed chunks."
        if embedded_chunk_count == 0:
            return "blocked", "Document chunks do not have embedding records."
        if (
            ready_document_count < document_count
            or documents_with_chunks < ready_document_count
            or documents_with_embeddings < ready_document_count
            or embedded_chunk_count < chunk_count
        ):
            return "degraded", "Knowledge base is partially indexed."
        return "ready", None

    def _embedding_guidance(
        self,
        *,
        embedding_model_config_id: str,
        embedding_model_config_status: str | None,
        chunk_count: int,
        embedded_chunk_count: int,
    ) -> str | None:
        if not embedding_model_config_id:
            return "Assign an active embedding model config to this knowledge base."
        if not embedding_model_config_status:
            return "Create or restore the referenced embedding model config."
        if not _is_ready_status(embedding_model_config_status):
            return "Enable the embedding model config before indexing documents."
        if chunk_count > 0 and embedded_chunk_count == 0:
            return "Run embedding indexing for the existing document chunks."
        if embedded_chunk_count < chunk_count:
            return "Run embedding indexing for the remaining document chunks."
        return None


class PlatformKnowledgeResponseService:
    """Build API response payloads from platform knowledge search hits."""

    def __init__(
        self,
        *,
        retrieval_event_writer: RetrievalEventWriter | None = None,
        audit_event_writer: AuditEventWriter | None = None,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._retrieval_event_writer = retrieval_event_writer
        self._audit_event_writer = audit_event_writer
        self._now = now

    def format_hit(
        self,
        knowledge_base_id: str,
        hit: Any,
    ) -> dict[str, Any]:
        chunk = getattr(hit, "chunk", None)
        snippet = _chunk_text(chunk)
        if len(snippet) > 500:
            snippet = f"{snippet[:497]}..."

        metadata = getattr(chunk, "metadata", {}) if chunk is not None else {}
        return {
            "knowledge_base_id": knowledge_base_id,
            "score": float(getattr(hit, "score", 0.0) or 0.0),
            "document_id": str(getattr(hit, "document_id", "")),
            "source": str(getattr(chunk, "source", "") or ""),
            "chunk_index": getattr(chunk, "chunk_index", None),
            "total_chunks": getattr(chunk, "total_chunks", None),
            "snippet": snippet,
            "metadata": _json_safe(metadata or {}),
        }

    async def search_agent_knowledge_bases(
        self,
        *,
        knowledge_base_service: Any | None,
        dev_knowledge_service: Any,
        dev_knowledge_provider: str,
        user_id: str,
        tenant: str,
        question: str,
        knowledge_base_ids: list[str],
        top_k: int = 3,
        agent_run_id: str | None = None,
    ) -> tuple[list[dict[str, Any]], str | None, dict[str, Any]]:
        readiness = self.build_retrieval_readiness(
            knowledge_base_ids=knowledge_base_ids,
            production_retriever_available=knowledge_base_service is not None,
        )
        if not knowledge_base_ids:
            return [], None, readiness

        hits: list[dict[str, Any]] = []
        errors: list[str] = []
        production_hit_count = 0
        if knowledge_base_service is not None:
            for knowledge_base_id in knowledge_base_ids:
                try:
                    results = await knowledge_base_service.search(
                        user_id=user_id,
                        knowledge_base_id=knowledge_base_id,
                        query=question,
                        top_k=top_k,
                    )
                except Exception as exc:  # Do not let RAG failures break tool answers.
                    errors.append(f"{knowledge_base_id}: {exc}")
                    continue

                formatted_results = [
                    self.format_hit(knowledge_base_id, hit)
                    for hit in results
                ]
                hits.extend(formatted_results)
                production_hit_count += len(formatted_results)
                self._append_retrieval_event(
                    tenant=tenant,
                    user_id=user_id,
                    knowledge_base_id=knowledge_base_id,
                    question=question,
                    hits=formatted_results,
                    agent_run_id=agent_run_id,
                )

        if len(hits) < top_k:
            seen = {
                (
                    str(hit.get("knowledge_base_id") or ""),
                    str(hit.get("document_id") or ""),
                )
                for hit in hits
            }
            for hit in dev_knowledge_service.search(
                question=question,
                knowledge_base_ids=knowledge_base_ids,
                provider=dev_knowledge_provider,
                top_k=top_k,
            ):
                key = (
                    str(hit.get("knowledge_base_id") or ""),
                    str(hit.get("document_id") or ""),
                )
                if key in seen:
                    continue
                seen.add(key)
                hits.append(hit)

        hits.sort(key=lambda item: item["score"], reverse=True)
        trimmed_hits = hits[:top_k]
        dev_fallback_hit_count = sum(
            1
            for hit in trimmed_hits
            if bool((hit.get("metadata") or {}).get("dev_fallback"))
        )
        knowledge_error = (
            "; ".join(errors) if errors and not production_hit_count else None
        )
        readiness = self.build_retrieval_readiness(
            knowledge_base_ids=knowledge_base_ids,
            production_retriever_available=knowledge_base_service is not None,
            production_hit_count=production_hit_count,
            dev_fallback_hit_count=dev_fallback_hit_count,
            knowledge_error=knowledge_error,
        )
        return trimmed_hits, knowledge_error, readiness

    def build_retrieval_readiness(
        self,
        *,
        knowledge_base_ids: list[str],
        production_retriever_available: bool,
        production_hit_count: int = 0,
        dev_fallback_hit_count: int = 0,
        knowledge_error: str | None = None,
    ) -> dict[str, Any]:
        bound_knowledge_base_ids = [
            str(knowledge_base_id).strip()
            for knowledge_base_id in knowledge_base_ids
            if str(knowledge_base_id).strip()
        ]
        dev_fallback_used = dev_fallback_hit_count > 0
        if not bound_knowledge_base_ids:
            status = "not_configured"
            guidance = "Bind at least one knowledge base to enable retrieval."
        elif knowledge_error and not production_hit_count and not dev_fallback_used:
            status = "blocked"
            guidance = "Production retrieval failed. Check knowledge service and embedding configuration."
        elif not production_retriever_available:
            status = "degraded" if dev_fallback_used else "not_configured"
            guidance = "Configure the production knowledge retriever and embedding provider."
        elif knowledge_error or dev_fallback_used:
            status = "degraded"
            guidance = "Production retrieval is partial; inspect retrieval errors and fallback usage."
        else:
            status = "ready"
            guidance = None

        payload: dict[str, Any] = {
            "status": status,
            "bound_knowledge_base_ids": bound_knowledge_base_ids,
            "production_retriever_available": production_retriever_available,
            "production_hit_count": production_hit_count,
            "dev_fallback_hit_count": dev_fallback_hit_count,
            "dev_fallback_used": dev_fallback_used,
        }
        if knowledge_error:
            payload["knowledge_error"] = knowledge_error
        if guidance:
            payload["guidance"] = guidance
        return payload

    def _append_retrieval_event(
        self,
        *,
        tenant: str,
        user_id: str,
        knowledge_base_id: str,
        question: str,
        hits: list[dict[str, Any]],
        agent_run_id: str | None = None,
    ) -> None:
        if self._retrieval_event_writer is None or self._now is None:
            return

        event_id = uuid4().hex
        created_at = self._now()
        safe_hits = _json_safe(hits)
        try:
            persisted_event = self._retrieval_event_writer.append_retrieval_event(
                RetrievalEventRecord(
                    id=event_id,
                    tenant_id=tenant,
                    agent_run_id=agent_run_id,
                    knowledge_base_id=knowledge_base_id,
                    query=question,
                    hits=safe_hits,
                    created_at=created_at,
                ),
            )
        except Exception:
            return
        self._append_retrieval_audit_event(
            event_id=persisted_event.id,
            tenant=tenant,
            user_id=user_id,
            knowledge_base_id=knowledge_base_id,
            question=question,
            hits=safe_hits,
            created_at=persisted_event.created_at,
            agent_run_id=agent_run_id,
        )

    def _append_retrieval_audit_event(
        self,
        *,
        event_id: str,
        tenant: str,
        user_id: str,
        knowledge_base_id: str,
        question: str,
        hits: list[dict[str, Any]],
        created_at: str,
        agent_run_id: str | None = None,
    ) -> None:
        if self._audit_event_writer is None:
            return

        try:
            payload = {
                "schema_version": 1,
                "retrieval_event_id": event_id,
                "tenant": tenant,
                "user_id": user_id,
                "knowledge_base_id": knowledge_base_id,
                "query": question,
                "hit_count": len(hits),
                "document_ids": [
                    str(hit.get("document_id") or "")
                    for hit in hits
                    if str(hit.get("document_id") or "").strip()
                ],
            }
            if agent_run_id:
                payload["agent_run_id"] = agent_run_id

            self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=tenant,
                    actor_user_id=user_id,
                    event_type="knowledge_base.retrieved",
                    target_type="knowledge_base",
                    target_id=knowledge_base_id,
                    payload=payload,
                    created_at=created_at,
                ),
            )
        except Exception:
            return

    def build_agent_run_payload(
        self,
        *,
        knowledge_hits: list[dict[str, Any]],
        knowledge_error: str | None,
        retrieval_readiness: dict[str, Any] | None = None,
        knowledge_document_readiness: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"knowledge_hits": knowledge_hits}
        if retrieval_readiness is not None:
            payload["retrieval_readiness"] = retrieval_readiness
        if knowledge_document_readiness is not None:
            payload["knowledge_document_readiness"] = knowledge_document_readiness
        if knowledge_error:
            payload["knowledge_error"] = knowledge_error
        return payload

    def format_answer(
        self,
        knowledge_hits: list[dict[str, Any]],
    ) -> str:
        snippets = []
        for index, hit in enumerate(knowledge_hits[:3], start=1):
            source = (
                hit.get("source")
                or hit.get("document_id")
                or hit["knowledge_base_id"]
            )
            snippets.append(f"{index}. {source}: {hit.get('snippet', '')}")

        return "我在该 Agent 绑定的知识库中找到这些相关内容：\n" + "\n".join(snippets)
