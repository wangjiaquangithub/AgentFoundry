#!/usr/bin/env python3
"""Check phase 3 agent catalog document readiness semantics."""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.agents import PlatformAgentService


class Agents:
    def __init__(self, records: list[dict[str, Any]]) -> None:
        self._records = records

    def list(self, *, tenant: str | None = None) -> list[dict[str, Any]]:
        return [
            dict(record)
            for record in self._records
            if tenant is None or record.get("tenant") == tenant
        ]

    def get(self, agent_id: str) -> dict[str, Any] | None:
        return next(
            (dict(record) for record in self._records if record.get("id") == agent_id),
            None,
        )

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        self._records = [dict(agent) for agent in agents]


class DocumentReadiness:
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


def build_agent(**overrides: Any) -> dict[str, Any]:
    agent = {
        "id": "agent_support",
        "name": "Enterprise Knowledge Assistant",
        "tenant": "acme",
        "status": "published",
        "model_config_id": "model_primary",
        "knowledge_base_ids": ["kb_support"],
        "tools": ["enterprise_search"],
        "memory_enabled": True,
        "workflow_enabled": True,
        "allowed_user_ids": [],
        "allowed_roles": [],
    }
    agent.update(overrides)
    return agent


def build_service(
    *,
    agent: dict[str, Any] | None = None,
    document_readiness: DocumentReadiness | None = None,
) -> PlatformAgentService:
    return PlatformAgentService(
        repository=Agents([agent or build_agent()]),
        templates=[
            {
                "id": "knowledge-assistant",
                "name": "Knowledge Assistant",
                "description": "Answers with enterprise knowledge.",
                "tools": ["enterprise_search"],
                "capabilities": ["knowledge"],
            },
        ],
        approval_required_tools=set(),
        tenant_for_user=lambda user_id: "acme",
        tenant_hint_from_user_id=lambda user_id: "acme",
        identity_metadata=lambda user_id, tenant: [],
        member_for_user=lambda user_id: {"status": "active"},
        role_for_user=lambda user_id: "admin",
        knowledge_document_readiness_service=document_readiness,
    )


def ready_payload() -> dict[str, Any]:
    return {
        "status": "ready",
        "bound_knowledge_base_ids": ["kb_support"],
        "knowledge_bases": [{"id": "kb_support", "status": "ready"}],
        "summary": {
            "knowledge_base_count": 1,
            "ready_knowledge_base_count": 1,
            "document_count": 2,
            "ready_document_count": 2,
            "chunk_count": 5,
            "embedded_chunk_count": 5,
            "embedding_record_count": 5,
        },
    }


def main() -> None:
    readiness_service = DocumentReadiness(ready_payload())
    service = build_service(document_readiness=readiness_service)
    response = service.registry_response()
    agent = response["agents"][0]
    readiness = agent["readiness"]
    assert readiness["status"] == "ready"
    assert readiness["checks"]["knowledge_documents_ready"] is True
    assert readiness["summary"]["knowledge_document_status"] == "ready"
    assert readiness["summary"]["knowledge_document_count"] == 2
    assert readiness["summary"]["knowledge_chunk_count"] == 5
    assert readiness["knowledge_document_readiness"]["status"] == "ready"
    assert readiness_service.calls == [
        {"tenant_id": "acme", "knowledge_base_ids": ["kb_support"]},
    ]

    blocked_service = DocumentReadiness(
        {
            "status": "blocked",
            "bound_knowledge_base_ids": ["kb_support"],
            "knowledge_bases": [],
            "guidance": "Create chunks and embeddings before retrieval.",
            "summary": {"document_count": 1, "chunk_count": 0},
        },
    )
    readiness = build_service(document_readiness=blocked_service).readiness(
        build_agent(),
    )
    assert readiness["status"] == "blocked"
    assert readiness["checks"]["knowledge_documents_ready"] is False
    assert any(
        issue["code"] == "knowledge_documents_not_ready"
        and issue["severity"] == "blocking"
        for issue in readiness["issues"]
    )

    service_without_pg = build_service(document_readiness=None)
    readiness = service_without_pg.readiness(build_agent())
    assert readiness["status"] == "partial"
    assert readiness["knowledge_document_readiness"]["status"] == "unavailable"
    assert "PostgreSQL" in readiness["knowledge_document_readiness"]["guidance"]
    assert any(
        issue["code"] == "knowledge_documents_not_ready"
        and issue["severity"] == "warning"
        for issue in readiness["issues"]
    )

    readiness_service = DocumentReadiness(ready_payload())
    readiness = build_service(
        agent=build_agent(tenant=""),
        document_readiness=readiness_service,
    ).readiness(build_agent(tenant=""))
    assert readiness["status"] == "blocked"
    assert readiness["knowledge_document_readiness"]["status"] == "blocked"
    assert readiness_service.calls == []


if __name__ == "__main__":
    main()
