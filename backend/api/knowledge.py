"""Enterprise knowledge HTTP routes."""

from dataclasses import dataclass
from typing import Any, Callable, NoReturn
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import (
    EnterpriseKnowledgeBaseDetailRequest,
    EnterpriseKnowledgeBaseUpsertRequest,
    EnterpriseKnowledgeBasesRequest,
    EnterpriseKnowledgeDocumentDetailRequest,
    EnterpriseKnowledgeDocumentChunkUpsertRequest,
    EnterpriseKnowledgeDocumentUpsertRequest,
    EnterpriseKnowledgeDocumentsRequest,
    EnterpriseKnowledgeEmbeddingRecordUpsertRequest,
    EnterpriseKnowledgeEmbeddingRecordsRequest,
    EnterpriseKnowledgeIngestRequest,
    EnterpriseKnowledgeReadinessRequest,
    EnterpriseKnowledgeRetrieveRequest,
    EnterpriseKnowledgeRetrievalEventDetailRequest,
    EnterpriseKnowledgeRetrievalEventsRequest,
)
from backend.persistence.document_chunks import DocumentChunkRecord
from backend.persistence.documents import DocumentRecord
from backend.persistence.embedding_records import EmbeddingRecord
from services.knowledge import (
    PlatformKnowledgeDocumentReadinessService,
    PlatformKnowledgeRetrievalService,
)
from services.knowledge_bases import (
    KnowledgeBaseApiCommandInput,
    PlatformKnowledgeBaseService,
    PlatformKnowledgeBaseServiceError,
)
from services.knowledge_ingestion import (
    KnowledgeIngestionRequest,
    PlatformKnowledgeIngestionService,
)


def _raise_ingestion_error(exc: ValueError) -> NoReturn:
    raise HTTPException(status_code=400, detail=str(exc)) from exc


@dataclass(frozen=True)
class KnowledgeIngestionRouteDependencies:
    ingestion_service: Callable[[], PlatformKnowledgeIngestionService | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


@dataclass(frozen=True)
class KnowledgeReadinessRouteDependencies:
    readiness_service: Callable[[], PlatformKnowledgeDocumentReadinessService | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


@dataclass(frozen=True)
class KnowledgeBasesRouteDependencies:
    knowledge_base_read_repository: Callable[[], Any | None]
    knowledge_base_service: Callable[[], PlatformKnowledgeBaseService | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


@dataclass(frozen=True)
class KnowledgeDocumentsRouteDependencies:
    document_repository: Callable[[], Any | None]
    document_write_repository: Callable[[], Any | None]
    document_chunk_repository: Callable[[], Any | None]
    document_chunk_write_repository: Callable[[], Any | None]
    tenant_hint_from_user_id: Callable[[str], str | None]
    now: Callable[[], str]


@dataclass(frozen=True)
class KnowledgeRetrievalRouteDependencies:
    retrieval_service: Callable[[], PlatformKnowledgeRetrievalService | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


@dataclass(frozen=True)
class KnowledgeRetrievalEventsRouteDependencies:
    retrieval_event_repository: Callable[[], Any | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


@dataclass(frozen=True)
class KnowledgeEmbeddingRecordsRouteDependencies:
    embedding_record_read_repository: Callable[[], Any | None]
    embedding_record_write_repository: Callable[[], Any | None]
    tenant_hint_from_user_id: Callable[[str], str | None]
    now: Callable[[], str]


def _resolve_tenant(
    *,
    tenant: str | None,
    request: Request,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    identity = get_request_identity(request)
    identity_tenant = (identity.tenant_id or "").strip()
    hinted_tenant = tenant_hint_from_user_id(identity.user_id or "")
    request_tenant = identity_tenant or hinted_tenant
    if not request_tenant:
        raise HTTPException(
            status_code=400,
            detail="request identity does not resolve to a tenant.",
        )

    explicit_tenant = (tenant or "").strip()
    if explicit_tenant and explicit_tenant != request_tenant:
        raise HTTPException(
            status_code=403,
            detail="tenant does not match request identity tenant boundary.",
        )
    return request_tenant


def _document_payload(document: Any) -> dict[str, Any]:
    return {
        "id": document.id,
        "tenant": document.tenant_id,
        "knowledge_base_id": document.knowledge_base_id,
        "title": document.title,
        "source_type": document.source_type,
        "source_uri": document.source_uri,
        "object_ref": document.object_ref,
        "status": document.status,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


def _knowledge_base_payload(knowledge_base: Any) -> dict[str, Any]:
    return {
        "id": knowledge_base.id,
        "tenant": knowledge_base.tenant_id,
        "name": knowledge_base.name,
        "description": knowledge_base.description,
        "status": knowledge_base.status,
        "embedding_model_config_id": knowledge_base.embedding_model_config_id,
        "created_at": knowledge_base.created_at,
        "updated_at": knowledge_base.updated_at,
    }


def _chunk_payload(chunk: Any) -> dict[str, Any]:
    return {
        "id": chunk.id,
        "tenant": chunk.tenant_id,
        "document_id": chunk.document_id,
        "chunk_index": chunk.chunk_index,
        "content": chunk.content,
        "metadata": chunk.metadata,
        "created_at": chunk.created_at,
    }


def _retrieval_event_payload(retrieval_event: Any) -> dict[str, Any]:
    hits = retrieval_event.hits
    document_ids = _unique_nonempty_hit_values(hits, "document_id")
    knowledge_base_ids = _unique_nonempty_hit_values(hits, "knowledge_base_id")
    if not knowledge_base_ids and retrieval_event.knowledge_base_id:
        knowledge_base_ids = [retrieval_event.knowledge_base_id]
    dev_fallback_hit_count = sum(
        1
        for hit in hits
        if isinstance(hit, dict)
        and bool((hit.get("metadata") or {}).get("dev_fallback"))
    )
    return {
        "id": retrieval_event.id,
        "tenant": retrieval_event.tenant_id,
        "agent_run_id": retrieval_event.agent_run_id,
        "knowledge_base_id": retrieval_event.knowledge_base_id,
        "query": retrieval_event.query,
        "hits": retrieval_event.hits,
        "hit_count": len(hits),
        "production_knowledge_hit_count": len(hits) - dev_fallback_hit_count,
        "dev_fallback_knowledge_hit_count": dev_fallback_hit_count,
        "dev_fallback_knowledge_used": dev_fallback_hit_count > 0,
        "knowledge_base_ids": knowledge_base_ids,
        "document_ids": document_ids,
        "hit_provenance": _hit_provenance_payload(hits),
        "retrieval_event_store": "postgresql",
        "created_at": retrieval_event.created_at,
    }


def _unique_nonempty_hit_values(hits: list[Any], key: str) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        value = str(hit.get(key) or "").strip()
        if not value or value in seen:
            continue
        values.append(value)
        seen.add(value)
    return values


def _hit_provenance_payload(hits: list[Any]) -> list[dict[str, Any]]:
    provenance: list[dict[str, Any]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        metadata = hit.get("metadata") if isinstance(hit.get("metadata"), dict) else {}
        provenance.append(
            {
                "knowledge_base_id": str(hit.get("knowledge_base_id") or ""),
                "document_id": str(hit.get("document_id") or ""),
                "chunk_id": str(hit.get("chunk_id") or ""),
                "chunk_index": hit.get("chunk_index"),
                "source": str(hit.get("source") or hit.get("source_uri") or ""),
                "source_type": str(metadata.get("source_type") or ""),
                "dev_fallback": bool(metadata.get("dev_fallback")),
            }
        )
    return provenance


def _embedding_record_payload(record: Any) -> dict[str, Any]:
    return {
        "id": record.id,
        "tenant": record.tenant_id,
        "chunk_id": record.chunk_id,
        "model_config_id": record.model_config_id,
        "vector_ref": record.vector_ref,
        "created_at": record.created_at,
    }


def create_knowledge_ingestion_router(
    deps: KnowledgeIngestionRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/documents/ingest")
    async def ingest_enterprise_knowledge_document(
        payload: EnterpriseKnowledgeIngestRequest,
        request: Request,
    ) -> dict[str, object]:
        """Persist a tenant document and chunks to PostgreSQL."""
        service = deps.ingestion_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge ingestion requires PostgreSQL. "
                    "Local JSON or SQLite storage is not a production ingestion target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            result = service.ingest_text(
                KnowledgeIngestionRequest(
                    tenant_id=tenant_id,
                    knowledge_base_id=payload.knowledge_base_id,
                    title=payload.title,
                    text=payload.text,
                    source_type=payload.source_type,
                    source_uri=payload.source_uri,
                    object_ref=payload.object_ref,
                    document_id=payload.document_id,
                )
            )
        except ValueError as exc:
            _raise_ingestion_error(exc)

        return {
            "tenant": result.tenant_id,
            "knowledge_base_id": result.knowledge_base_id,
            "document_id": result.document_id,
            "status": result.status,
            "chunk_count": result.chunk_count,
            "embedding_required": result.embedding_required,
            "embedding_model_config_id": result.embedding_model_config_id,
            "guidance": result.guidance,
        }

    return router


def create_knowledge_bases_router(
    deps: KnowledgeBasesRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/bases")
    async def list_enterprise_knowledge_bases(
        payload: EnterpriseKnowledgeBasesRequest,
        request: Request,
    ) -> dict[str, Any]:
        """List tenant knowledge base records from PostgreSQL."""
        repository = deps.knowledge_base_read_repository()
        if repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge base reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production knowledge "
                    "base target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        knowledge_bases = repository.list_knowledge_bases(
            tenant_id=tenant_id,
            status=payload.status,
            limit=payload.limit,
        )
        return {
            "tenant": tenant_id,
            "knowledge_bases": [
                _knowledge_base_payload(knowledge_base)
                for knowledge_base in knowledge_bases
            ],
        }

    @router.post("/enterprise/platform/knowledge/bases/detail")
    async def read_enterprise_knowledge_base_detail(
        payload: EnterpriseKnowledgeBaseDetailRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Read one tenant knowledge base record from PostgreSQL."""
        repository = deps.knowledge_base_read_repository()
        if repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge base reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production knowledge "
                    "base target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        knowledge_base = repository.get_knowledge_base(
            tenant_id=tenant_id,
            knowledge_base_id=payload.knowledge_base_id,
        )
        if knowledge_base is None:
            raise HTTPException(status_code=404, detail="Knowledge base not found.")

        return {
            "tenant": tenant_id,
            "knowledge_base": _knowledge_base_payload(knowledge_base),
        }

    @router.post("/enterprise/platform/knowledge/bases/upsert")
    async def upsert_enterprise_knowledge_base(
        payload: EnterpriseKnowledgeBaseUpsertRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Persist one tenant knowledge base record to PostgreSQL."""
        service = deps.knowledge_base_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge base writes require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production knowledge "
                    "base target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        identity = get_request_identity(request)
        actor_user_id = identity.user_id or "system"
        try:
            persisted_knowledge_base = service.upsert_knowledge_base_from_api(
                KnowledgeBaseApiCommandInput(
                    id=payload.knowledge_base_id or f"kb-{uuid4()}",
                    tenant_id=tenant_id,
                    name=payload.name,
                    description=payload.description,
                    status=payload.status,
                    embedding_model_config_id=payload.embedding_model_config_id,
                    actor_user_id=actor_user_id,
                )
            )
        except PlatformKnowledgeBaseServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "knowledge_base": _knowledge_base_payload(persisted_knowledge_base),
        }

    return router


def create_knowledge_embedding_records_router(
    deps: KnowledgeEmbeddingRecordsRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/embedding-records")
    async def list_enterprise_knowledge_embedding_records(
        payload: EnterpriseKnowledgeEmbeddingRecordsRequest,
        request: Request,
    ) -> dict[str, Any]:
        """List tenant embedding records from PostgreSQL."""
        repository = deps.embedding_record_read_repository()
        if repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge embedding record reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production embedding "
                    "record target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        records = repository.list_embedding_records(
            tenant_id=tenant_id,
            chunk_id=payload.chunk_id,
            model_config_id=payload.model_config_id,
            limit=payload.limit,
        )
        return {
            "tenant": tenant_id,
            "embedding_records": [
                _embedding_record_payload(record) for record in records
            ],
        }

    @router.post("/enterprise/platform/knowledge/embedding-records/upsert")
    async def upsert_enterprise_knowledge_embedding_record(
        payload: EnterpriseKnowledgeEmbeddingRecordUpsertRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Persist one tenant embedding record to PostgreSQL."""
        repository = deps.embedding_record_write_repository()
        if repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge embedding record writes require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production embedding "
                    "record target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        record = EmbeddingRecord(
            id=payload.embedding_record_id or f"emb-{uuid4()}",
            tenant_id=tenant_id,
            chunk_id=payload.chunk_id,
            model_config_id=payload.model_config_id,
            vector_ref=payload.vector_ref,
            created_at=deps.now(),
        )
        try:
            persisted_record = repository.append_embedding_record(record)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {
            "tenant": tenant_id,
            "embedding_record": _embedding_record_payload(persisted_record),
        }

    return router


def create_knowledge_retrieval_events_router(
    deps: KnowledgeRetrievalEventsRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/retrieval-events")
    async def list_enterprise_knowledge_retrieval_events(
        payload: EnterpriseKnowledgeRetrievalEventsRequest,
        request: Request,
    ) -> dict[str, Any]:
        """List tenant knowledge retrieval events from PostgreSQL."""
        retrieval_event_repository = deps.retrieval_event_repository()
        if retrieval_event_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge retrieval event reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production retrieval "
                    "event read target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        retrieval_events = retrieval_event_repository.list_retrieval_events(
            tenant_id=tenant_id,
            agent_run_id=payload.agent_run_id,
            knowledge_base_id=payload.knowledge_base_id,
            limit=payload.limit,
        )
        return {
            "tenant": tenant_id,
            "retrieval_events": [
                _retrieval_event_payload(retrieval_event)
                for retrieval_event in retrieval_events
            ],
        }

    @router.post("/enterprise/platform/knowledge/retrieval-events/detail")
    async def read_enterprise_knowledge_retrieval_event_detail(
        payload: EnterpriseKnowledgeRetrievalEventDetailRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Read one tenant knowledge retrieval event from PostgreSQL."""
        retrieval_event_repository = deps.retrieval_event_repository()
        if retrieval_event_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge retrieval event reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production retrieval "
                    "event read target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        retrieval_event = retrieval_event_repository.get_retrieval_event(
            tenant_id=tenant_id,
            retrieval_event_id=payload.retrieval_event_id,
        )
        if retrieval_event is None:
            raise HTTPException(
                status_code=404,
                detail="Knowledge retrieval event not found.",
            )

        return {
            "tenant": tenant_id,
            "retrieval_event": _retrieval_event_payload(retrieval_event),
        }

    return router


def create_knowledge_retrieval_router(
    deps: KnowledgeRetrievalRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/retrieve")
    async def retrieve_enterprise_knowledge(
        payload: EnterpriseKnowledgeRetrieveRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Retrieve tenant knowledge chunks from PostgreSQL."""
        service = deps.retrieval_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge retrieval requires PostgreSQL. "
                    "Local JSON or SQLite storage is not a production retrieval target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        return {
            "tenant": tenant_id,
            "knowledge_retrieval": service.retrieve(
                tenant_id=tenant_id,
                knowledge_base_ids=payload.knowledge_base_ids,
                query=payload.query,
                user_id=get_request_identity(request).user_id,
                limit=payload.limit,
            ),
        }

    return router


def create_knowledge_readiness_router(
    deps: KnowledgeReadinessRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/readiness")
    async def read_enterprise_knowledge_readiness(
        payload: EnterpriseKnowledgeReadinessRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Summarize tenant knowledge base indexing readiness from PostgreSQL."""
        service = deps.readiness_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge readiness requires PostgreSQL. "
                    "Local JSON or SQLite storage is not a production readiness target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )

        return {
            "tenant": tenant_id,
            "knowledge_readiness": service.build_readiness(
                tenant_id=tenant_id,
                knowledge_base_ids=payload.knowledge_base_ids,
            ),
        }

    return router


def create_knowledge_documents_router(
    deps: KnowledgeDocumentsRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/knowledge/documents")
    async def list_enterprise_knowledge_documents(
        payload: EnterpriseKnowledgeDocumentsRequest,
        request: Request,
    ) -> dict[str, Any]:
        """List tenant knowledge documents from PostgreSQL."""
        document_repository = deps.document_repository()
        if document_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge document reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production document read target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        documents = document_repository.list_documents(
            tenant_id=tenant_id,
            knowledge_base_id=payload.knowledge_base_id,
            status=payload.status,
            limit=payload.limit,
        )
        return {
            "tenant": tenant_id,
            "documents": [_document_payload(document) for document in documents],
        }

    @router.post("/enterprise/platform/knowledge/documents/detail")
    async def read_enterprise_knowledge_document_detail(
        payload: EnterpriseKnowledgeDocumentDetailRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Read one tenant knowledge document and its chunks from PostgreSQL."""
        document_repository = deps.document_repository()
        if document_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge document reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production document read target."
                ),
            )

        chunk_repository = deps.document_chunk_repository()
        if payload.include_chunks and chunk_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge document reads require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production document read target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        document = document_repository.get_document(
            tenant_id=tenant_id,
            document_id=payload.document_id,
        )
        if document is None:
            raise HTTPException(status_code=404, detail="Knowledge document not found.")

        chunks = []
        if payload.include_chunks:
            chunks = [
                _chunk_payload(chunk)
                for chunk in chunk_repository.list_document_chunks(
                    tenant_id=tenant_id,
                    document_id=payload.document_id,
                    limit=payload.chunk_limit,
                )
            ]

        return {
            "tenant": tenant_id,
            "document": _document_payload(document),
            "chunks": chunks,
        }

    @router.post("/enterprise/platform/knowledge/documents/upsert")
    async def upsert_enterprise_knowledge_document(
        payload: EnterpriseKnowledgeDocumentUpsertRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Persist one tenant knowledge document metadata record to PostgreSQL."""
        document_repository = deps.document_write_repository()
        if document_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge document writes require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production document "
                    "write target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        now = deps.now()
        document = DocumentRecord(
            id=payload.document_id or f"doc-{uuid4()}",
            tenant_id=tenant_id,
            knowledge_base_id=payload.knowledge_base_id,
            title=payload.title,
            source_type=payload.source_type,
            source_uri=payload.source_uri,
            object_ref=payload.object_ref,
            status=payload.status,
            created_at=now,
            updated_at=now,
        )
        try:
            persisted_document = document_repository.upsert_document(document)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "document": _document_payload(persisted_document),
        }

    @router.post("/enterprise/platform/knowledge/document-chunks/upsert")
    async def upsert_enterprise_knowledge_document_chunk(
        payload: EnterpriseKnowledgeDocumentChunkUpsertRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Persist one tenant knowledge document chunk record to PostgreSQL."""
        chunk_repository = deps.document_chunk_write_repository()
        if chunk_repository is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production knowledge document chunk writes require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production document "
                    "chunk write target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        chunk = DocumentChunkRecord(
            id=payload.chunk_id or f"chunk-{uuid4()}",
            tenant_id=tenant_id,
            document_id=payload.document_id,
            chunk_index=payload.chunk_index,
            content=payload.content,
            metadata=payload.metadata,
            created_at=deps.now(),
        )
        try:
            persisted_chunk = chunk_repository.append_document_chunk(chunk)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "chunk": _chunk_payload(persisted_chunk),
        }

    return router
