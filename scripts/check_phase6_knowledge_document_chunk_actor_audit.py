#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for document chunk upserts."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
KNOWLEDGE_API = BACKEND_DIR / "api" / "knowledge.py"
COMPOSITION = BACKEND_DIR / "services" / "composition.py"
MAIN = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.knowledge_document_chunks import (  # noqa: E402
    KnowledgeDocumentChunkApiCommandInput,
    PlatformKnowledgeDocumentChunkService,
    PlatformKnowledgeDocumentChunkServiceError,
)


class DocumentChunkWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_document_chunk(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def command_input() -> KnowledgeDocumentChunkApiCommandInput:
    return KnowledgeDocumentChunkApiCommandInput(
        id="chunk-support-001",
        tenant_id="acme",
        document_id="document-support-001",
        chunk_index=3,
        content="Private support handbook content.",
        metadata={"page": 7, "section": "Escalation"},
        actor_user_id="acme:admin",
    )


def build_service(
    *,
    chunk_writer: DocumentChunkWriter | None = None,
    audit_writer: AuditEventWriter | None = None,
) -> PlatformKnowledgeDocumentChunkService:
    return PlatformKnowledgeDocumentChunkService(
        document_chunk_writer=chunk_writer or DocumentChunkWriter(),
        audit_event_writer=audit_writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_upsert_audit_contract() -> list[str]:
    chunk_writer = DocumentChunkWriter()
    audit_writer = AuditEventWriter()
    service = build_service(chunk_writer=chunk_writer, audit_writer=audit_writer)
    response = service.upsert_document_chunk_from_api(command_input())

    errors: list[str] = []
    if response.tenant_id != "acme":
        errors.append("document chunk upsert must persist within the request tenant")
    if response.id != "chunk-support-001":
        errors.append("document chunk upsert must return the persisted target")
    if len(chunk_writer.records) != 1:
        errors.append("document chunk upsert must persist exactly one record")
    if len(audit_writer.records) != 1:
        return errors + ["document chunk upsert must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "knowledge_document_chunk.upserted",
        "target_type": "knowledge_document_chunk",
        "target_id": "chunk-support-001",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant_id": "acme",
        "document_chunk_id": "chunk-support-001",
        "document_id": "document-support-001",
        "chunk_index": 3,
        "content_length": 33,
        "metadata_key_count": 2,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain normalized document chunk evidence")
    if "content" in event.payload or "metadata" in event.payload:
        errors.append("audit payload must not expose raw chunk content or metadata")
    return errors


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    try:
        build_service(
            chunk_writer=DocumentChunkWriter(failure=ValueError("invalid chunk")),
        ).upsert_document_chunk_from_api(command_input())
    except ValueError as exc:
        if isinstance(exc, PlatformKnowledgeDocumentChunkServiceError):
            errors.append("document chunk writer ValueError must remain a request error")
    else:
        errors.append("document chunk writer ValueError must surface to the route")

    try:
        build_service(
            chunk_writer=DocumentChunkWriter(failure=RuntimeError("database unavailable")),
        ).upsert_document_chunk_from_api(command_input())
    except PlatformKnowledgeDocumentChunkServiceError as exc:
        if exc.status_code != 500:
            errors.append("document chunk infrastructure failure must surface as HTTP 500")
    else:
        errors.append("document chunk infrastructure failure must fail closed")

    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        try:
            build_service(
                audit_writer=AuditEventWriter(failure=failure),
            ).upsert_document_chunk_from_api(command_input())
        except PlatformKnowledgeDocumentChunkServiceError as exc:
            if exc.status_code != 500:
                errors.append("audit persistence failure must surface as HTTP 500")
        else:
            errors.append("audit persistence failure must fail closed")

    blank_id_writer = AuditEventWriter()
    original_append = blank_id_writer.append_audit_event

    def append_without_id(record):
        return replace(original_append(record), id="")

    blank_id_writer.append_audit_event = append_without_id
    try:
        build_service(audit_writer=blank_id_writer).upsert_document_chunk_from_api(
            command_input(),
        )
    except PlatformKnowledgeDocumentChunkServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = KNOWLEDGE_API.read_text(encoding="utf-8")
    composition_source = COMPOSITION.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.post("/enterprise/platform/knowledge/document-chunks/upsert")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    tenant_start = route_source.index("tenant_id = _resolve_tenant(")
    identity_start = route_source.index("identity = get_request_identity(request)")
    actor_start = route_source.index('actor_user_id = identity.user_id or "system"')
    mutation_start = route_source.index(
        "persisted_chunk = service.upsert_document_chunk_from_api(",
    )
    if not tenant_start < identity_start < actor_start < mutation_start:
        errors.append(
            "document chunk upsert must resolve tenant, identity, and actor before mutation",
        )
    mutation_source = route_source[mutation_start:]
    if "tenant_id=tenant_id," not in mutation_source:
        errors.append("document chunk upsert must use the resolved request tenant")
    if "actor_user_id=actor_user_id," not in mutation_source:
        errors.append("document chunk upsert must use the authenticated request actor")

    service_start = composition_source.index(
        "def build_postgres_knowledge_document_chunk_service(",
    )
    service_end = composition_source.index(
        "def build_configured_postgres_knowledge_document_chunk_service(",
        service_start,
    )
    service_source = composition_source[service_start:service_end]
    if "document_chunk_writer=PostgresDocumentChunkWriteRepository(database)" not in service_source:
        errors.append("production service must inject the document chunk writer")
    if "audit_event_writer=PostgresAuditEventWriteRepository(database)" not in service_source:
        errors.append("production service must inject the audit event writer")
    if "build_knowledge_document_chunk_service" not in main_source:
        errors.append("application wiring must inject the document chunk service")
    if "check_phase6_knowledge_document_chunk_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the document chunk actor audit check")
    return errors


def main() -> int:
    errors = check_upsert_audit_contract()
    errors += check_failure_contract()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-knowledge-document-chunk-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-knowledge-document-chunk-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
