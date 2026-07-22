#!/usr/bin/env python3
"""Check Phase 3 knowledge retrieval event and audit persistence wiring."""

from __future__ import annotations

import sys
import asyncio
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.knowledge import (
    PlatformKnowledgeResponseService,
    PlatformKnowledgeRetrievalService,
)

API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "knowledge.py"
RETRIEVAL_EVENTS_MODULE = ROOT / "backend" / "persistence" / "retrieval_events.py"
AUDIT_EVENTS_MODULE = ROOT / "backend" / "persistence" / "audit_events.py"
MAIN_MODULE = ROOT / "backend" / "main.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def _assert_contains(source: str, needle: str, label: str) -> None:
    if needle not in source:
        _fail(f"{label} is missing {needle!r}")


class _KnowledgeBases:
    def get_knowledge_base(self, **_: Any) -> Any:
        return SimpleNamespace(id="kb_support", status="active")


class _Documents:
    def list_documents(self, **_: Any) -> list[Any]:
        return [
            SimpleNamespace(
                id="doc_approval",
                title="Approval Policy",
                source_uri="postgres://knowledge/doc_approval",
                status="ready",
            )
        ]


class _DocumentChunks:
    def list_document_chunks(self, **_: Any) -> list[Any]:
        return [
            SimpleNamespace(
                id="chunk_approval_1",
                chunk_index=0,
                content="Approval requests require manager approval evidence.",
                metadata={"source_type": "postgres"},
            )
        ]


class _RetrievalEvents:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_retrieval_event(self, record: Any) -> Any:
        self.records.append(record)
        return record


class _AuditEvents:
    def __init__(self) -> None:
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> Any:
        self.records.append(record)
        return record


class _ProductionKnowledgeService:
    async def search(self, **_: Any) -> list[Any]:
        return [
            SimpleNamespace(
                score=0.92,
                document_id="doc_runbook",
                chunk=SimpleNamespace(
                    content=SimpleNamespace(
                        type="text",
                        text="Runbook evidence must include source documents.",
                    ),
                    source="postgres://knowledge/doc_runbook",
                    chunk_index=0,
                    total_chunks=2,
                    metadata={"source_type": "postgres"},
                ),
            )
        ]


class _EmptyProductionKnowledgeService:
    async def search(self, **_: Any) -> list[Any]:
        return []


class _DevKnowledgeService:
    def search(self, **_: Any) -> list[dict[str, Any]]:
        return []


def _assert_runtime_retrieval_audit_contract() -> None:
    retrieval_events = _RetrievalEvents()
    audit_events = _AuditEvents()
    service = PlatformKnowledgeRetrievalService(
        knowledge_base_repository=_KnowledgeBases(),
        document_repository=_Documents(),
        document_chunk_repository=_DocumentChunks(),
        retrieval_event_writer=retrieval_events,
        audit_event_writer=audit_events,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )

    payload = service.retrieve(
        tenant_id="acme",
        user_id="acme:alice",
        agent_run_id="run_phase3_audit_check",
        knowledge_base_ids=["kb_support"],
        query="approval evidence",
    )

    if payload["status"] != "ready":
        _fail("runtime retrieval check did not return a ready result")
    if len(retrieval_events.records) != 1:
        _fail("runtime retrieval check did not write one retrieval event")
    if len(audit_events.records) != 1:
        _fail("runtime retrieval check did not write one audit event")

    retrieval_event = retrieval_events.records[0]
    audit_event = audit_events.records[0]
    audit_payload = audit_event.payload
    expected_payload = {
        "schema_version": 1,
        "retrieval_event_id": retrieval_event.id,
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_run_id": "run_phase3_audit_check",
        "knowledge_base_id": "kb_support",
        "bound_knowledge_base_ids": ["kb_support"],
        "ready_knowledge_base_ids": ["kb_support"],
        "blocked_knowledge_base_ids": [],
        "query": "approval evidence",
        "status": "ready",
        "hit_count": 1,
        "document_ids": ["doc_approval"],
        "retrieval_mode": "deterministic_lexical",
    }

    if audit_event.event_type != "knowledge_base.retrieved":
        _fail("runtime audit event type must be knowledge_base.retrieved")
    if audit_event.target_type != "knowledge_base":
        _fail("runtime audit event target type must be knowledge_base")
    if audit_event.target_id != "kb_support":
        _fail("runtime audit event target id must match the retrieved knowledge base")
    for key, expected in expected_payload.items():
        if audit_payload.get(key) != expected:
            _fail(
                "runtime audit payload field "
                f"{key!r} expected {expected!r}, got {audit_payload.get(key)!r}"
            )


async def _assert_agent_run_retrieval_audit_contract() -> None:
    retrieval_events = _RetrievalEvents()
    audit_events = _AuditEvents()
    service = PlatformKnowledgeResponseService(
        retrieval_event_writer=retrieval_events,
        audit_event_writer=audit_events,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )

    hits, knowledge_error, readiness = await service.search_agent_knowledge_bases(
        knowledge_base_service=_ProductionKnowledgeService(),
        dev_knowledge_service=_DevKnowledgeService(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="runbook evidence",
        knowledge_base_ids=["kb_runbook"],
        top_k=3,
        agent_run_id="run_phase3_agent_audit_check",
    )

    if knowledge_error is not None:
        _fail("agent run retrieval check must not return a knowledge error")
    if readiness["status"] != "ready":
        _fail("agent run retrieval check did not return ready retrieval status")
    if len(hits) != 1:
        _fail("agent run retrieval check did not return one hit")
    if len(retrieval_events.records) != 1:
        _fail("agent run retrieval check did not write one retrieval event")
    if len(audit_events.records) != 1:
        _fail("agent run retrieval check did not write one audit event")

    retrieval_event = retrieval_events.records[0]
    audit_event = audit_events.records[0]
    audit_payload = audit_event.payload
    expected_payload = {
        "schema_version": 1,
        "retrieval_event_id": retrieval_event.id,
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_run_id": "run_phase3_agent_audit_check",
        "knowledge_base_id": "kb_runbook",
        "bound_knowledge_base_ids": ["kb_runbook"],
        "ready_knowledge_base_ids": ["kb_runbook"],
        "blocked_knowledge_base_ids": [],
        "query": "runbook evidence",
        "status": "ready",
        "hit_count": 1,
        "document_ids": ["doc_runbook"],
        "retrieval_mode": "production_search",
    }

    if audit_event.event_type != "knowledge_base.retrieved":
        _fail("agent run audit event type must be knowledge_base.retrieved")
    if audit_event.target_type != "knowledge_base":
        _fail("agent run audit event target type must be knowledge_base")
    if audit_event.target_id != "kb_runbook":
        _fail("agent run audit event target id must match the retrieved knowledge base")
    for key, expected in expected_payload.items():
        if audit_payload.get(key) != expected:
            _fail(
                "agent run audit payload field "
                f"{key!r} expected {expected!r}, got {audit_payload.get(key)!r}"
            )


async def _assert_agent_run_zero_hit_retrieval_audit_contract() -> None:
    retrieval_events = _RetrievalEvents()
    audit_events = _AuditEvents()
    service = PlatformKnowledgeResponseService(
        retrieval_event_writer=retrieval_events,
        audit_event_writer=audit_events,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )

    hits, knowledge_error, readiness = await service.search_agent_knowledge_bases(
        knowledge_base_service=_EmptyProductionKnowledgeService(),
        dev_knowledge_service=_DevKnowledgeService(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="missing runbook evidence",
        knowledge_base_ids=["kb_empty"],
        top_k=3,
        agent_run_id="run_phase3_agent_empty_audit_check",
    )

    if knowledge_error is not None:
        _fail("zero-hit production retrieval must not return a knowledge error")
    if readiness["status"] != "ready":
        _fail("zero-hit production retrieval must keep retrieval readiness ready")
    if hits:
        _fail("zero-hit production retrieval check must not return hits")
    if readiness["production_hit_count"] != 0:
        _fail("zero-hit production retrieval readiness must report no production hits")
    if readiness["dev_fallback_hit_count"] != 0:
        _fail("zero-hit production retrieval readiness must not report dev fallback hits")
    if readiness["dev_fallback_used"]:
        _fail("zero-hit production retrieval readiness must not use dev fallback")
    if len(retrieval_events.records) != 1:
        _fail("zero-hit production retrieval must write one retrieval event")
    if len(audit_events.records) != 1:
        _fail("zero-hit production retrieval must write one audit event")

    retrieval_event = retrieval_events.records[0]
    audit_event = audit_events.records[0]
    audit_payload = audit_event.payload
    expected_payload = {
        "schema_version": 1,
        "retrieval_event_id": retrieval_event.id,
        "tenant": "acme",
        "user_id": "acme:alice",
        "agent_run_id": "run_phase3_agent_empty_audit_check",
        "knowledge_base_id": "kb_empty",
        "bound_knowledge_base_ids": ["kb_empty"],
        "ready_knowledge_base_ids": ["kb_empty"],
        "blocked_knowledge_base_ids": [],
        "query": "missing runbook evidence",
        "status": "ready",
        "hit_count": 0,
        "document_ids": [],
        "retrieval_mode": "production_search",
    }

    if audit_event.event_type != "knowledge_base.retrieved":
        _fail("zero-hit audit event type must be knowledge_base.retrieved")
    if audit_event.target_type != "knowledge_base":
        _fail("zero-hit audit event target type must be knowledge_base")
    if audit_event.target_id != "kb_empty":
        _fail("zero-hit audit event target id must match the retrieved knowledge base")
    for key, expected in expected_payload.items():
        if audit_payload.get(key) != expected:
            _fail(
                "zero-hit audit payload field "
                f"{key!r} expected {expected!r}, got {audit_payload.get(key)!r}"
            )


def main() -> int:
    api_source = _read(API_MODULE)
    service_source = _read(SERVICE_MODULE)
    retrieval_events_source = _read(RETRIEVAL_EVENTS_MODULE)
    audit_events_source = _read(AUDIT_EVENTS_MODULE)
    main_source = _read(MAIN_MODULE)
    composition_source = _read(COMPOSITION_MODULE)

    for needle in (
        "retrieval_event_writer: RetrievalEventWriter | None = None",
        "audit_event_writer: AuditEventWriter | None = None",
        "RetrievalEventRecord(",
        "AuditEventRecord(",
        "append_retrieval_event",
        "persisted_event = self._retrieval_event_writer.append_retrieval_event",
        "event_id=persisted_event.id",
        "created_at=persisted_event.created_at",
        "append_audit_event",
        '"knowledge_base.retrieved"',
        '"retrieval_mode"',
        '"bound_knowledge_base_ids"',
        '"ready_knowledge_base_ids"',
        '"blocked_knowledge_base_ids"',
    ):
        _assert_contains(
            service_source,
            needle,
            "knowledge retrieval persistence service",
        )

    for needle in (
        "def append_retrieval_event(",
        ") -> RetrievalEventRecord:",
        "RETURNING id, tenant_id, agent_run_id, knowledge_base_id",
        "row = cursor.fetchone()",
        "Retrieval event insert did not return a row.",
        "return _retrieval_event_from_row(dict(row))",
    ):
        _assert_contains(
            retrieval_events_source,
            needle,
            "PostgreSQL retrieval event write repository",
        )

    for needle in (
        "def append_audit_event(",
        ") -> AuditEventRecord:",
        "RETURNING id, tenant_id, actor_user_id, event_type",
        "resource_type AS target_type",
        "resource_id AS target_id",
        "metadata AS payload",
        "row = cursor.fetchone()",
        "Audit event upsert did not return a row.",
        "return _audit_event_from_row(dict(row))",
    ):
        _assert_contains(
            audit_events_source,
            needle,
            "PostgreSQL audit event write repository",
        )

    _assert_contains(
        api_source,
        'user_id=request.headers.get("X-User-ID") or None',
        "knowledge retrieval actor propagation",
    )

    for needle in (
        "retrieval_event_writer=PostgresRetrievalEventWriteRepository(database)",
        "audit_event_writer=PostgresAuditEventWriteRepository(database)",
    ):
        _assert_contains(
            composition_source,
            needle,
            "composition PostgreSQL retrieval audit wiring",
        )

    _assert_contains(
        main_source,
        "build_knowledge_retrieval_service(now=now_iso)",
        "main knowledge retrieval time provider wiring",
    )

    retrieval_router_wiring = main_source.split(
        "create_knowledge_retrieval_router(", 1
    )[1].split("create_knowledge_retrieval_events_router(", 1)[0]
    for forbidden in (
        "SQLite",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
        "jsonl",
        "build_configured_postgres_knowledge_retrieval_service",
        "PostgresRetrievalEventWriteRepository",
        "PostgresAuditEventWriteRepository",
    ):
        if forbidden in retrieval_router_wiring:
            _fail(
                "backend/main.py knowledge retrieval wiring must not use "
                f"{forbidden!r}"
            )

    _assert_runtime_retrieval_audit_contract()
    asyncio.run(_assert_agent_run_retrieval_audit_contract())
    asyncio.run(_assert_agent_run_zero_hit_retrieval_audit_contract())

    print("OK: Phase 3 knowledge retrieval writes retrieval and audit events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
