#!/usr/bin/env python3
"""Check phase 3 retrieval readiness payload semantics."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.knowledge import PlatformKnowledgeResponseService


class DevKnowledge:
    def search(self, **_: Any) -> list[dict[str, Any]]:
        return [
            {
                "knowledge_base_id": "kb_support",
                "score": 0.7,
                "document_id": "dev-doc-1",
                "source": "dev fallback",
                "chunk_index": 0,
                "total_chunks": 1,
                "snippet": "fallback answer",
                "metadata": {
                    "provider": "agentfoundry-dev-local",
                    "dev_fallback": True,
                },
            },
        ]


class EmptyProductionKnowledge:
    async def search(self, **_: Any) -> list[Any]:
        return []


class ProductionKnowledge:
    async def search(self, **_: Any) -> list[Any]:
        chunk = SimpleNamespace(
            content=SimpleNamespace(type="text", text="production answer"),
            source="postgres document",
            chunk_index=0,
            total_chunks=1,
            metadata={"source_type": "postgres"},
        )
        return [
            SimpleNamespace(
                chunk=chunk,
                score=0.9,
                document_id="pg-doc-1",
            ),
        ]


async def main() -> None:
    service = PlatformKnowledgeResponseService()

    _, _, no_binding = await service.search_agent_knowledge_bases(
        knowledge_base_service=None,
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="How do approvals work?",
        knowledge_base_ids=[],
    )
    assert no_binding["status"] == "not_configured"
    assert no_binding["production_hit_count"] == 0
    assert no_binding["dev_fallback_hit_count"] == 0
    assert no_binding["dev_fallback_allowed"] is True
    assert no_binding["retrieval_mode"] == "production_with_dev_fallback"

    hits, _, fallback = await service.search_agent_knowledge_bases(
        knowledge_base_service=None,
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="How do approvals work?",
        knowledge_base_ids=["kb_support"],
    )
    assert hits
    assert hits[0]["retrieval_source"] == "dev_fallback"
    assert fallback["status"] == "degraded"
    assert fallback["production_retriever_available"] is False
    assert fallback["production_hit_count"] == 0
    assert fallback["dev_fallback_hit_count"] == 1
    assert fallback["dev_fallback_used"] is True
    assert fallback["dev_fallback_allowed"] is True
    assert fallback["retrieval_mode"] == "production_with_dev_fallback"

    _, _, production_ready = await service.search_agent_knowledge_bases(
        knowledge_base_service=EmptyProductionKnowledge(),
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="No matching terms",
        knowledge_base_ids=["kb_support"],
    )
    assert production_ready["status"] == "degraded"
    assert production_ready["production_retriever_available"] is True
    assert production_ready["production_hit_count"] == 0
    assert production_ready["dev_fallback_hit_count"] == 1
    assert production_ready["dev_fallback_allowed"] is True
    assert production_ready["retrieval_mode"] == "production_with_dev_fallback"

    unavailable_hits, _, production_unavailable = await service.search_agent_knowledge_bases(
        knowledge_base_service=None,
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="How do approvals work?",
        knowledge_base_ids=["kb_support"],
        allow_dev_fallback=False,
    )
    assert unavailable_hits == []
    assert production_unavailable["status"] == "blocked"
    assert production_unavailable["production_retriever_available"] is False
    assert production_unavailable["dev_fallback_allowed"] is False
    assert production_unavailable["retrieval_mode"] == "production"
    assert "PostgreSQL retriever" in production_unavailable["guidance"]

    production_hits, _, production_only = await service.search_agent_knowledge_bases(
        knowledge_base_service=EmptyProductionKnowledge(),
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="No matching terms",
        knowledge_base_ids=["kb_support"],
        allow_dev_fallback=False,
    )
    assert production_hits == []
    assert production_only["status"] == "ready"
    assert production_only["production_retriever_available"] is True
    assert production_only["production_hit_count"] == 0
    assert production_only["dev_fallback_hit_count"] == 0
    assert production_only["dev_fallback_used"] is False
    assert production_only["dev_fallback_allowed"] is False
    assert production_only["retrieval_mode"] == "production"

    production_hits, _, production_ready = await service.search_agent_knowledge_bases(
        knowledge_base_service=ProductionKnowledge(),
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="How do approvals work?",
        knowledge_base_ids=["kb_support"],
        top_k=1,
    )
    assert production_hits[0]["retrieval_source"] == "production"
    assert production_ready["status"] == "ready"
    assert production_ready["production_retriever_available"] is True
    assert production_ready["production_hit_count"] == 1
    assert production_ready["dev_fallback_hit_count"] == 0
    assert production_ready["dev_fallback_allowed"] is True
    assert production_ready["retrieval_mode"] == "production_with_dev_fallback"


if __name__ == "__main__":
    asyncio.run(main())
