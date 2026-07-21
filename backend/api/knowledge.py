"""Enterprise knowledge HTTP routes."""

from dataclasses import dataclass
from typing import Any, Callable, NoReturn

from fastapi import APIRouter, HTTPException, Request

from api.schemas import (
    EnterpriseKnowledgeDocumentDetailRequest,
    EnterpriseKnowledgeDocumentsRequest,
    EnterpriseKnowledgeIngestRequest,
    EnterpriseKnowledgeReadinessRequest,
)
from services.knowledge import PlatformKnowledgeDocumentReadinessService
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
class KnowledgeDocumentsRouteDependencies:
    document_repository: Callable[[], Any | None]
    document_chunk_repository: Callable[[], Any | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


def _resolve_tenant(
    *,
    tenant: str | None,
    request: Request,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    tenant_id = tenant or tenant_hint_from_user_id(
        request.headers.get("X-User-ID") or "",
    )
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant is required when X-User-ID does not imply a tenant.",
        )
    return tenant_id


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

    return router
