#!/usr/bin/env python3
"""Check retrieval events and run traces share one agent run identity."""

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


class RetrievalEvents:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_retrieval_event(self, record: Any) -> Any:
        self.records.append(record)
        return record


class AuditEvents:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> None:
        self.records.append(record)


class ProductionKnowledge:
    async def search(self, **_: Any) -> list[Any]:
        return [
            SimpleNamespace(
                chunk=SimpleNamespace(
                    content=SimpleNamespace(type="text", text="approval evidence"),
                    source="postgres document",
                    chunk_index=0,
                    total_chunks=1,
                    metadata={"source_type": "postgres"},
                ),
                score=0.91,
                document_id="pg-doc-1",
            ),
        ]


class DevKnowledge:
    def search(self, **_: Any) -> list[dict[str, Any]]:
        return []


def execution_context(run_identity: dict[str, str]) -> dict[str, Any]:
    return {
        "tenant": "acme",
        "question": "How do approvals work?",
        "run_identity": run_identity,
        "knowledge_base_ids": ["kb_support"],
        "response_record_context": {"user_id": "acme:alice"},
    }


async def main() -> None:
    run_service = PlatformAgentRunService(repository=Runs())
    retrieval_events = RetrievalEvents()
    audit_events = AuditEvents()
    knowledge_service = PlatformKnowledgeResponseService(
        retrieval_event_writer=retrieval_events,
        audit_event_writer=audit_events,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )
    run_identity = {
        "turn_id": "run_retrieval_evidence_check",
        "created_at": "2026-01-01T00:00:00+00:00",
    }

    knowledge_context = await run_service.prepare_knowledge_context_from_execution_context(
        build_agent_run_payload=knowledge_service.build_agent_run_payload,
        search_agent_knowledge_bases=knowledge_service.search_agent_knowledge_bases,
        knowledge_base_service=ProductionKnowledge(),
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        knowledge_document_readiness_service=None,
        execution_context=execution_context(run_identity),
    )

    assert knowledge_context["knowledge_hits"]
    assert len(retrieval_events.records) == 1
    assert retrieval_events.records[0].agent_run_id == run_identity["turn_id"]
    assert len(audit_events.records) == 1
    assert audit_events.records[0].payload["agent_run_id"] == run_identity["turn_id"]
    assert audit_events.records[0].payload["retrieval_event_id"] == (
        retrieval_events.records[0].id
    )

    trace = run_service.build_unrouted_response_trace(
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent_support",
        session_id="session_support",
        knowledge_hits=knowledge_context["knowledge_hits"],
        memory_hits=[],
        memory_saved=False,
        run_identity=run_identity,
    )
    assert trace["turn_id"] == run_identity["turn_id"]
    assert trace["created_at"] == run_identity["created_at"]
    assert trace["evidence"]["turn_id"] == run_identity["turn_id"]

    routed_trace = run_service.build_routed_response_trace(
        primary_call={"tenant": "acme", "user_id": "acme:alice"},
        tenant="acme",
        user_id="acme:alice",
        agent_id="agent_support",
        session_id="session_support",
        tool_calls=[],
        knowledge_hits=knowledge_context["knowledge_hits"],
        memory_hits=[],
        memory_saved=False,
        run_identity=run_identity,
    )
    assert routed_trace["turn_id"] == run_identity["turn_id"]
    assert routed_trace["evidence"]["turn_id"] == run_identity["turn_id"]


if __name__ == "__main__":
    asyncio.run(main())
