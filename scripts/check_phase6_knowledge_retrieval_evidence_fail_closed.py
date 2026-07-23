#!/usr/bin/env python3
"""Validate fail-closed persistence for knowledge retrieval evidence."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
KNOWLEDGE_API = BACKEND_DIR / "api" / "knowledge.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.knowledge import (  # noqa: E402
    PlatformKnowledgeRetrievalService,
    PlatformKnowledgeRetrievalServiceError,
)


class KnowledgeBases:
    def get_knowledge_base(self, **_):
        return SimpleNamespace(id="kb_support", status="ready")


class Documents:
    def list_documents(self, **_):
        return [
            SimpleNamespace(
                id="doc_support",
                title="Support handbook",
                source_uri="postgres://knowledge/doc_support",
                status="ready",
            )
        ]


class DocumentChunks:
    def list_document_chunks(self, **_):
        return [
            SimpleNamespace(
                id="chunk_support",
                chunk_index=0,
                content="Approval evidence is required.",
                metadata={"source_type": "postgres"},
            )
        ]


class EventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records = []

    def append_retrieval_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


class AuditWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records = []

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def build_service(
    *,
    event_writer: EventWriter | None = None,
    audit_writer: AuditWriter | None = None,
    include_event_writer: bool = True,
    include_audit_writer: bool = True,
    include_now: bool = True,
) -> PlatformKnowledgeRetrievalService:
    return PlatformKnowledgeRetrievalService(
        knowledge_base_repository=KnowledgeBases(),
        document_repository=Documents(),
        document_chunk_repository=DocumentChunks(),
        retrieval_event_writer=(event_writer or EventWriter()) if include_event_writer else None,
        audit_event_writer=(audit_writer or AuditWriter()) if include_audit_writer else None,
        now=(lambda: "2026-07-23T00:00:00+00:00") if include_now else None,
    )


def retrieve(service: PlatformKnowledgeRetrievalService):
    return service.retrieve(
        tenant_id="acme",
        user_id="acme:alice",
        agent_run_id="run_phase6_retrieval_fail_closed",
        knowledge_base_ids=["kb_support"],
        query="approval evidence",
    )


def expect_service_error(service: PlatformKnowledgeRetrievalService, label: str) -> list[str]:
    try:
        retrieve(service)
    except PlatformKnowledgeRetrievalServiceError as exc:
        if exc.status_code != 500:
            return [f"{label} must surface as HTTP 500"]
        return []
    return [f"{label} must fail closed"]


def check_success_contract() -> list[str]:
    event_writer = EventWriter()
    audit_writer = AuditWriter()
    payload = retrieve(
        build_service(event_writer=event_writer, audit_writer=audit_writer),
    )
    errors: list[str] = []
    if payload["status"] != "ready" or len(payload["hits"]) != 1:
        errors.append("successful retrieval must still return persisted evidence")
    if len(event_writer.records) != 1 or len(audit_writer.records) != 1:
        errors.append("successful retrieval must persist one event and one audit record")
    return errors


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    for failure in (RuntimeError("event unavailable"), ValueError("event rejected")):
        errors += expect_service_error(
            build_service(event_writer=EventWriter(failure=failure)),
            "retrieval event persistence failure",
        )
    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        errors += expect_service_error(
            build_service(audit_writer=AuditWriter(failure=failure)),
            "retrieval audit persistence failure",
        )

    blank_event_writer = EventWriter()
    original_event_append = blank_event_writer.append_retrieval_event

    def append_event_without_id(record):
        return replace(original_event_append(record), id="")

    blank_event_writer.append_retrieval_event = append_event_without_id
    errors += expect_service_error(
        build_service(event_writer=blank_event_writer),
        "blank persisted retrieval event id",
    )

    blank_audit_writer = AuditWriter()
    original_audit_append = blank_audit_writer.append_audit_event

    def append_audit_without_id(record):
        return replace(original_audit_append(record), id="")

    blank_audit_writer.append_audit_event = append_audit_without_id
    errors += expect_service_error(
        build_service(audit_writer=blank_audit_writer),
        "blank persisted retrieval audit id",
    )

    for kwargs, label in (
        ({"include_event_writer": False}, "missing retrieval event writer"),
        ({"include_audit_writer": False}, "missing retrieval audit writer"),
        ({"include_now": False}, "missing retrieval timestamp provider"),
    ):
        errors += expect_service_error(build_service(**kwargs), label)
    return errors


def check_route_and_gate() -> list[str]:
    api_source = KNOWLEDGE_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.post("/enterprise/platform/knowledge/retrieve")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    if "except PlatformKnowledgeRetrievalServiceError as exc:" not in route_source:
        errors.append("knowledge retrieval route must preserve service HTTP semantics")
    if "status_code=exc.status_code" not in route_source:
        errors.append("knowledge retrieval infrastructure failures must map to HTTP 500")
    if "check_phase6_knowledge_retrieval_evidence_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the retrieval fail-closed check")
    return errors


def main() -> int:
    errors = check_success_contract()
    errors += check_failure_contract()
    errors += check_route_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-knowledge-retrieval-fail-closed] {error}", file=sys.stderr)
        return 1
    print("[phase6-knowledge-retrieval-fail-closed] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
