#!/usr/bin/env python3
"""Check phase 3 deterministic knowledge ingestion service semantics."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence import DocumentChunkRecord, DocumentRecord
from backend.services.knowledge_ingestion import (
    KnowledgeIngestionRequest,
    PlatformKnowledgeIngestionService,
)


@dataclass(frozen=True)
class KnowledgeBase:
    id: str
    tenant_id: str
    embedding_model_config_id: str | None = None


class KnowledgeBases:
    def __init__(self, records: dict[tuple[str, str], KnowledgeBase]) -> None:
        self._records = records

    def get_knowledge_base(self, *, tenant_id: str, knowledge_base_id: str) -> Any | None:
        return self._records.get((tenant_id, knowledge_base_id))


class Documents:
    def __init__(self) -> None:
        self.records: dict[str, DocumentRecord] = {}

    def upsert_document(self, record: DocumentRecord) -> None:
        self.records[record.id] = record


class Chunks:
    def __init__(self) -> None:
        self.records: dict[str, list[DocumentChunkRecord]] = {}
        self.deleted: list[tuple[str, str]] = []

    def append_document_chunk(self, record: DocumentChunkRecord) -> None:
        self.records.setdefault(record.document_id, [])
        self.records[record.document_id].append(record)

    def delete_document_chunks(self, *, tenant_id: str, document_id: str) -> int:
        self.deleted.append((tenant_id, document_id))
        deleted = len(self.records.get(document_id, []))
        self.records[document_id] = []
        return deleted

    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[DocumentChunkRecord]:
        return self.records.get(document_id, [])[:limit]


class Embeddings:
    def __init__(self) -> None:
        self.deleted_chunk_ids: list[str] = []

    def delete_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
    ) -> int:
        if chunk_id is not None:
            self.deleted_chunk_ids.append(chunk_id)
        return 1


def build_service(
    *,
    knowledge_bases: dict[tuple[str, str], KnowledgeBase] | None = None,
    documents: Documents | None = None,
    chunks: Chunks | None = None,
    embeddings: Embeddings | None = None,
) -> PlatformKnowledgeIngestionService:
    chunk_repository = chunks or Chunks()
    return PlatformKnowledgeIngestionService(
        knowledge_base_repository=KnowledgeBases(knowledge_bases or {}),
        document_repository=documents or Documents(),
        document_chunk_repository=chunk_repository,
        document_chunk_read_repository=chunk_repository,
        embedding_record_repository=embeddings,
        now=lambda: "2026-07-22T00:00:00+00:00",
        target_chunk_size=220,
    )


def main() -> None:
    documents = Documents()
    chunks = Chunks()
    embeddings = Embeddings()
    service = build_service(
        knowledge_bases={
            ("acme", "kb_support"): KnowledgeBase(
                id="kb_support",
                tenant_id="acme",
                embedding_model_config_id="embed_openai",
            )
        },
        documents=documents,
        chunks=chunks,
        embeddings=embeddings,
    )

    result = service.ingest_text(
        KnowledgeIngestionRequest(
            tenant_id="acme",
            knowledge_base_id="kb_support",
            title="Support handbook",
            text="Reset passwords from the admin console.\n\n"
            "Escalate billing disputes to finance operations.",
            source_type="markdown",
            source_uri="s3://agentfoundry-docs/support.md",
        )
    )
    assert result.status == "ready"
    assert result.embedding_required is True
    assert result.embedding_model_config_id == "embed_openai"
    assert result.guidance
    assert result.document_id in documents.records
    assert documents.records[result.document_id].tenant_id == "acme"
    assert documents.records[result.document_id].source_type == "markdown"
    assert len(chunks.records[result.document_id]) == 1
    assert chunks.records[result.document_id][0].metadata["total_chunks"] == 1

    second = service.ingest_text(
        KnowledgeIngestionRequest(
            tenant_id="acme",
            knowledge_base_id="kb_support",
            title="Support handbook",
            text="Reset passwords from the admin console.\n\n"
            "Escalate billing disputes to finance operations.",
        )
    )
    assert second.document_id == result.document_id
    assert chunks.deleted[-1] == ("acme", result.document_id)
    assert embeddings.deleted_chunk_ids
    assert len(chunks.records[result.document_id]) == 1

    long_result = service.ingest_text(
        KnowledgeIngestionRequest(
            tenant_id="acme",
            knowledge_base_id="kb_support",
            title="Long handbook",
            text="A" * 500,
        )
    )
    assert long_result.chunk_count == 3
    assert [
        chunk.chunk_index
        for chunk in chunks.records[long_result.document_id]
    ] == [0, 1, 2]

    missing_service = build_service()
    try:
        missing_service.ingest_text(
            KnowledgeIngestionRequest(
                tenant_id="acme",
                knowledge_base_id="kb_missing",
                title="Missing",
                text="Body",
            )
        )
    except ValueError as exc:
        assert "Knowledge base" in str(exc)
    else:
        raise AssertionError("Missing knowledge base must fail ingestion.")

    try:
        service.ingest_text(
            KnowledgeIngestionRequest(
                tenant_id="acme",
                knowledge_base_id="kb_support",
                title="",
                text="Body",
            )
        )
    except ValueError as exc:
        assert "title" in str(exc)
    else:
        raise AssertionError("Blank title must fail ingestion.")


if __name__ == "__main__":
    main()
