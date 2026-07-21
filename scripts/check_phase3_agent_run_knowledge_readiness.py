#!/usr/bin/env python3
"""Check agent runs honor PostgreSQL knowledge document readiness."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.agent_runs import PlatformAgentRunService
from backend.services.knowledge import PlatformKnowledgeResponseService


class Runs:
    def list(self, **_: Any) -> list[dict[str, Any]]:
        return []

    def get(self, *_: Any, **__: Any) -> dict[str, Any] | None:
        return None

    def append(self, _: dict[str, Any]) -> None:
        return None

    def delete(self, *_: Any, **__: Any) -> bool:
        return False


class Readiness:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.calls: list[dict[str, Any]] = []

    def build_readiness(
        self,
        *,
        tenant_id: str,
        knowledge_base_ids: list[str],
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "tenant_id": tenant_id,
                "knowledge_base_ids": list(knowledge_base_ids),
            },
        )
        return dict(self.payload)


class FailingProductionKnowledge:
    async def search(self, **_: Any) -> list[Any]:
        raise AssertionError("blocked readiness must not call production search")


class ProductionKnowledge:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def search(self, **kwargs: Any) -> list[Any]:
        self.calls.append(dict(kwargs))
        return [
            SimpleNamespace(
                chunk=SimpleNamespace(
                    content=SimpleNamespace(type="text", text=f"production answer {i}"),
                    source="postgres document",
                    chunk_index=i,
                    total_chunks=3,
                    metadata={"source_type": "postgres"},
                ),
                score=0.9 - (i * 0.1),
                document_id=f"pg-doc-{i + 1}",
            )
            for i in range(3)
        ]


class DevKnowledge:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def search(self, **kwargs: Any) -> list[dict[str, Any]]:
        self.calls.append(dict(kwargs))
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


def execution_context() -> dict[str, Any]:
    return {
        "tenant": "acme",
        "question": "How do approvals work?",
        "knowledge_base_ids": ["kb_support"],
        "response_record_context": {"user_id": "acme:alice"},
    }


async def main() -> None:
    run_service = PlatformAgentRunService(repository=Runs())
    knowledge_service = PlatformKnowledgeResponseService()

    blocked_readiness = Readiness(
        {
            "status": "blocked",
            "bound_knowledge_base_ids": ["kb_support"],
            "knowledge_bases": [],
            "guidance": "Create chunks and embeddings before retrieval.",
            "summary": {"document_count": 1, "chunk_count": 0},
        },
    )
    dev = DevKnowledge()
    blocked = await run_service.prepare_knowledge_context_from_execution_context(
        build_agent_run_payload=knowledge_service.build_agent_run_payload,
        search_agent_knowledge_bases=knowledge_service.search_agent_knowledge_bases,
        knowledge_base_service=FailingProductionKnowledge(),
        dev_knowledge_service=dev,
        dev_knowledge_provider="agentfoundry-dev-local",
        knowledge_document_readiness_service=blocked_readiness,
        execution_context=execution_context(),
    )
    assert blocked["knowledge_hits"] == []
    assert dev.calls == []
    assert blocked["retrieval_readiness"]["status"] == "blocked"
    assert blocked["retrieval_readiness"]["dev_fallback_used"] is False
    assert blocked["knowledge_document_readiness"]["status"] == "blocked"
    assert blocked["knowledge_payload"]["knowledge_document_readiness"]["status"] == (
        "blocked"
    )
    assert blocked_readiness.calls == [
        {"tenant_id": "acme", "knowledge_base_ids": ["kb_support"]},
    ]

    ready_readiness = Readiness(
        {
            "status": "ready",
            "bound_knowledge_base_ids": ["kb_support"],
            "knowledge_bases": [{"id": "kb_support", "status": "ready"}],
            "summary": {
                "document_count": 1,
                "ready_document_count": 1,
                "chunk_count": 1,
                "embedded_chunk_count": 1,
            },
        },
    )
    production = ProductionKnowledge()
    ready = await run_service.prepare_knowledge_context_from_execution_context(
        build_agent_run_payload=knowledge_service.build_agent_run_payload,
        search_agent_knowledge_bases=knowledge_service.search_agent_knowledge_bases,
        knowledge_base_service=production,
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        knowledge_document_readiness_service=ready_readiness,
        execution_context=execution_context(),
    )
    assert production.calls
    assert ready["knowledge_hits"]
    assert ready["retrieval_readiness"]["status"] == "ready"
    assert ready["knowledge_document_readiness"]["status"] == "ready"

    dev = DevKnowledge()
    fallback = await run_service.prepare_knowledge_context_from_execution_context(
        build_agent_run_payload=knowledge_service.build_agent_run_payload,
        search_agent_knowledge_bases=knowledge_service.search_agent_knowledge_bases,
        knowledge_base_service=None,
        dev_knowledge_service=dev,
        dev_knowledge_provider="agentfoundry-dev-local",
        knowledge_document_readiness_service=None,
        execution_context=execution_context(),
    )
    assert dev.calls
    assert fallback["knowledge_hits"]
    assert fallback["retrieval_readiness"]["dev_fallback_used"] is True
    assert fallback.get("knowledge_document_readiness") is None


if __name__ == "__main__":
    asyncio.run(main())
