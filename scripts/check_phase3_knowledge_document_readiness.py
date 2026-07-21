#!/usr/bin/env python3
"""Check phase 3 knowledge document readiness semantics."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.knowledge import PlatformKnowledgeDocumentReadinessService


@dataclass(frozen=True)
class Record:
    id: str
    status: str = "active"
    knowledge_base_id: str | None = None
    embedding_model_config_id: str | None = None
    model_config_id: str | None = None


class KnowledgeBases:
    def __init__(self, records: dict[str, Record]) -> None:
        self._records = records

    def get_knowledge_base(self, *, tenant_id: str, knowledge_base_id: str) -> Any | None:
        return self._records.get(knowledge_base_id)


class Documents:
    def __init__(self, records: list[Record]) -> None:
        self._records = records

    def list_documents(
        self,
        *,
        tenant_id: str,
        knowledge_base_id: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[Any]:
        records = [
            record
            for record in self._records
            if knowledge_base_id is None or record.knowledge_base_id == knowledge_base_id
        ]
        if status is not None:
            records = [record for record in records if record.status == status]
        return records[:limit]


class Chunks:
    def __init__(self, by_document: dict[str, list[Record]]) -> None:
        self._by_document = by_document

    def list_document_chunks(
        self,
        *,
        tenant_id: str,
        document_id: str,
        limit: int = 100,
    ) -> list[Any]:
        return self._by_document.get(document_id, [])[:limit]


class Embeddings:
    def __init__(self, by_chunk: dict[str, list[Record]]) -> None:
        self._by_chunk = by_chunk

    def list_embedding_records(
        self,
        *,
        tenant_id: str,
        chunk_id: str | None = None,
        model_config_id: str | None = None,
        limit: int = 100,
    ) -> list[Any]:
        records = list(self._by_chunk.get(chunk_id or "", []))
        if model_config_id is not None:
            records = [
                record
                for record in records
                if record.model_config_id == model_config_id
            ]
        return records[:limit]


class ModelConfigs:
    def __init__(self, records: dict[str, Record]) -> None:
        self._records = records

    def get_model_config(self, *, tenant_id: str, model_config_id: str) -> Any | None:
        return self._records.get(model_config_id)


def build_service(
    *,
    knowledge_bases: dict[str, Record] | None = None,
    documents: list[Record] | None = None,
    chunks: dict[str, list[Record]] | None = None,
    embeddings: dict[str, list[Record]] | None = None,
    model_configs: dict[str, Record] | None = None,
) -> PlatformKnowledgeDocumentReadinessService:
    return PlatformKnowledgeDocumentReadinessService(
        knowledge_base_repository=KnowledgeBases(knowledge_bases or {}),
        document_repository=Documents(documents or []),
        document_chunk_repository=Chunks(chunks or {}),
        embedding_record_repository=Embeddings(embeddings or {}),
        model_config_repository=ModelConfigs(model_configs or {}),
    )


def active_kb() -> Record:
    return Record(id="kb_support", status="active", embedding_model_config_id="embed_openai")


def main() -> None:
    service = build_service()
    readiness = service.build_readiness(tenant_id="acme", knowledge_base_ids=[])
    assert readiness["status"] == "not_configured"
    assert readiness["bound_knowledge_base_ids"] == []

    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_missing"],
    )
    assert readiness["status"] == "not_configured"
    assert readiness["knowledge_bases"][0]["guidance"]

    service = build_service(knowledge_bases={"kb_support": active_kb()})
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "blocked"
    assert readiness["knowledge_bases"][0]["guidance"] == "Embedding model config record was not found."

    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        model_configs={"embed_openai": Record(id="embed_openai", status="active")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "not_configured"
    assert readiness["summary"]["document_count"] == 0

    docs = [Record(id="doc_1", status="ready", knowledge_base_id="kb_support")]
    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        documents=docs,
        model_configs={"embed_openai": Record(id="embed_openai", status="active")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "blocked"
    assert readiness["knowledge_bases"][0]["chunk_count"] == 0

    chunks = {"doc_1": [Record(id="chunk_1")]}
    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        documents=docs,
        chunks=chunks,
        model_configs={"embed_openai": Record(id="embed_openai", status="active")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "blocked"
    assert readiness["knowledge_bases"][0]["embedded_chunk_count"] == 0

    embeddings = {"chunk_1": [Record(id="embedding_1", model_config_id="embed_openai")]}
    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        documents=docs,
        chunks=chunks,
        embeddings=embeddings,
        model_configs={"embed_openai": Record(id="embed_openai", status="disabled")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "blocked"
    assert readiness["knowledge_bases"][0]["embedding_model_config_status"] == "disabled"

    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        documents=docs,
        chunks=chunks,
        embeddings=embeddings,
        model_configs={"embed_openai": Record(id="embed_openai", status="active")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "ready"
    assert readiness["summary"]["ready_knowledge_base_count"] == 1
    assert readiness["summary"]["embedding_record_count"] == 1

    partial_docs = [
        Record(id="doc_1", status="ready", knowledge_base_id="kb_support"),
        Record(id="doc_2", status="ready", knowledge_base_id="kb_support"),
    ]
    service = build_service(
        knowledge_bases={"kb_support": active_kb()},
        documents=partial_docs,
        chunks={"doc_1": [Record(id="chunk_1")], "doc_2": [Record(id="chunk_2")]},
        embeddings={"chunk_1": [Record(id="embedding_1", model_config_id="embed_openai")]},
        model_configs={"embed_openai": Record(id="embed_openai", status="active")},
    )
    readiness = service.build_readiness(
        tenant_id="acme",
        knowledge_base_ids=["kb_support"],
    )
    assert readiness["status"] == "degraded"
    assert readiness["summary"]["chunk_count"] == 2
    assert readiness["summary"]["embedded_chunk_count"] == 1


if __name__ == "__main__":
    main()
