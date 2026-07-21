"""Enterprise knowledge ingestion HTTP routes."""

from dataclasses import dataclass
from typing import Callable, NoReturn

from fastapi import APIRouter, HTTPException, Request

from api.schemas import EnterpriseKnowledgeIngestRequest
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

        tenant_id = payload.tenant or deps.tenant_hint_from_user_id(
            request.headers.get("X-User-ID") or "",
        )
        if not tenant_id:
            raise HTTPException(
                status_code=400,
                detail="tenant is required when X-User-ID does not imply a tenant.",
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
