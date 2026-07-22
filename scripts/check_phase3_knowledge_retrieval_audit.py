#!/usr/bin/env python3
"""Check Phase 3 knowledge retrieval event and audit persistence wiring."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.knowledge import PlatformKnowledgeRetrievalService

API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "knowledge.py"
RETRIEVAL_EVENTS_MODULE = ROOT / "backend" / "persistence" / "retrieval_events.py"
AUDIT_EVENTS_MODULE = ROOT / "backend" / "persistence" / "audit_events.py"
MAIN_MODULE = ROOT / "backend" / "main.py"


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


def main() -> int:
    api_source = _read(API_MODULE)
    service_source = _read(SERVICE_MODULE)
    retrieval_events_source = _read(RETRIEVAL_EVENTS_MODULE)
    audit_events_source = _read(AUDIT_EVENTS_MODULE)
    main_source = _read(MAIN_MODULE)

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
        "now=now_iso",
    ):
        _assert_contains(
            main_source,
            needle,
            "main PostgreSQL retrieval audit wiring",
        )

    retrieval_builder = main_source.split(
        "def _build_knowledge_retrieval_service", 1
    )[1].split("def _build_knowledge_ingestion_service", 1)[0]
    for forbidden in (
        "SQLite",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
        "jsonl",
    ):
        if forbidden in retrieval_builder:
            _fail(
                "knowledge retrieval persistence builder must not use "
                f"{forbidden!r}"
            )

    _assert_runtime_retrieval_audit_contract()

    print("OK: Phase 3 knowledge retrieval writes retrieval and audit events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
