#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for knowledge ingestion."""

from __future__ import annotations

import sys
from dataclasses import dataclass, replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
KNOWLEDGE_API = BACKEND_DIR / "api" / "knowledge.py"
COMPOSITION = BACKEND_DIR / "services" / "composition.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.knowledge_ingestion import (  # noqa: E402
    KnowledgeIngestionRequest,
    PlatformKnowledgeIngestionService,
    PlatformKnowledgeIngestionServiceError,
)


@dataclass(frozen=True)
class KnowledgeBase:
    id: str = "kb_support"
    tenant_id: str = "acme"
    embedding_model_config_id: str | None = "embed_openai"


class KnowledgeBaseReader:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.calls = []
        self.failure = failure

    def get_knowledge_base(self, *, tenant_id: str, knowledge_base_id: str):
        self.calls.append((tenant_id, knowledge_base_id))
        if self.failure is not None:
            raise self.failure
        return KnowledgeBase(id=knowledge_base_id, tenant_id=tenant_id)


class DocumentWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def upsert_document(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


class DocumentChunkRepository:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.deletes = []
        self.failure = failure

    def append_document_chunk(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record

    def delete_document_chunks(self, *, tenant_id: str, document_id: str) -> int:
        self.deletes.append((tenant_id, document_id))
        return 0


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def ingestion_request(*, actor_user_id: str = "acme:admin") -> KnowledgeIngestionRequest:
    return KnowledgeIngestionRequest(
        tenant_id="acme",
        knowledge_base_id="kb_support",
        title="Private support handbook",
        text="Reset passwords using the confidential recovery workflow.",
        actor_user_id=actor_user_id,
        source_type="markdown",
        source_uri="s3://private-bucket/support.md",
        object_ref="private/object/support.md",
    )


def build_service(
    *,
    knowledge_base_reader: KnowledgeBaseReader | None = None,
    document_writer: DocumentWriter | None = None,
    chunk_repository: DocumentChunkRepository | None = None,
    audit_writer: AuditEventWriter | None = None,
) -> PlatformKnowledgeIngestionService:
    return PlatformKnowledgeIngestionService(
        knowledge_base_repository=knowledge_base_reader or KnowledgeBaseReader(),
        document_repository=document_writer or DocumentWriter(),
        document_chunk_repository=chunk_repository or DocumentChunkRepository(),
        audit_event_writer=audit_writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_ingestion_audit_contract() -> list[str]:
    document_writer = DocumentWriter()
    chunk_repository = DocumentChunkRepository()
    audit_writer = AuditEventWriter()
    result = build_service(
        document_writer=document_writer,
        chunk_repository=chunk_repository,
        audit_writer=audit_writer,
    ).ingest_text(ingestion_request())

    errors: list[str] = []
    if result.tenant_id != "acme" or result.knowledge_base_id != "kb_support":
        errors.append("knowledge ingestion must remain tenant and knowledge-base scoped")
    if len(document_writer.records) != 1 or len(chunk_repository.records) != 1:
        errors.append("knowledge ingestion must persist its document and chunks")
    if len(audit_writer.records) != 1:
        return errors + ["knowledge ingestion must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "knowledge_document.ingested",
        "target_type": "knowledge_document",
        "target_id": result.document_id,
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant_id": "acme",
        "knowledge_base_id": "kb_support",
        "document_id": result.document_id,
        "status": "ready",
        "chunk_count": 1,
        "embedding_model_config_id": "embed_openai",
        "embedding_required": True,
        "source_type": "markdown",
        "has_source_uri": True,
        "has_object_ref": True,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain normalized ingestion evidence")

    serialized_payload = repr(event.payload)
    sensitive_values = (
        "Private support handbook",
        "confidential recovery workflow",
        "s3://private-bucket/support.md",
        "private/object/support.md",
        "content_sha256",
    )
    if any(value in serialized_payload for value in sensitive_values):
        errors.append("audit payload must not expose ingestion content or source details")
    return errors


def check_actor_validation_before_mutation() -> list[str]:
    knowledge_base_reader = KnowledgeBaseReader()
    document_writer = DocumentWriter()
    chunk_repository = DocumentChunkRepository()
    audit_writer = AuditEventWriter()
    try:
        build_service(
            knowledge_base_reader=knowledge_base_reader,
            document_writer=document_writer,
            chunk_repository=chunk_repository,
            audit_writer=audit_writer,
        ).ingest_text(ingestion_request(actor_user_id=" "))
    except ValueError as exc:
        if isinstance(exc, PlatformKnowledgeIngestionServiceError):
            return ["blank actor must remain a request validation error"]
    else:
        return ["blank actor must reject knowledge ingestion"]

    if knowledge_base_reader.calls:
        return ["actor must be validated before repository access"]
    if document_writer.records or chunk_repository.deletes or audit_writer.records:
        return ["actor must be validated before any ingestion mutation"]
    return []


def check_failure_contract() -> list[str]:
    errors: list[str] = []
    try:
        build_service(
            document_writer=DocumentWriter(failure=ValueError("invalid document")),
        ).ingest_text(ingestion_request())
    except ValueError as exc:
        if isinstance(exc, PlatformKnowledgeIngestionServiceError):
            errors.append("document writer ValueError must remain a request error")
    else:
        errors.append("document writer ValueError must surface to the route")

    for failure in (
        RuntimeError("knowledge base unavailable"),
        RuntimeError("document database unavailable"),
        RuntimeError("chunk database unavailable"),
    ):
        kwargs = {}
        if "knowledge base" in str(failure):
            kwargs["knowledge_base_reader"] = KnowledgeBaseReader(failure=failure)
        elif "document" in str(failure):
            kwargs["document_writer"] = DocumentWriter(failure=failure)
        else:
            kwargs["chunk_repository"] = DocumentChunkRepository(failure=failure)
        try:
            build_service(**kwargs).ingest_text(ingestion_request())
        except PlatformKnowledgeIngestionServiceError as exc:
            if exc.status_code != 500:
                errors.append("ingestion infrastructure failure must surface as HTTP 500")
        else:
            errors.append("ingestion infrastructure failure must fail closed")

    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        try:
            build_service(
                audit_writer=AuditEventWriter(failure=failure),
            ).ingest_text(ingestion_request())
        except PlatformKnowledgeIngestionServiceError as exc:
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
        build_service(audit_writer=blank_id_writer).ingest_text(ingestion_request())
    except PlatformKnowledgeIngestionServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = KNOWLEDGE_API.read_text(encoding="utf-8")
    composition_source = COMPOSITION.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.post("/enterprise/platform/knowledge/documents/ingest")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    tenant_start = route_source.index("tenant_id = _resolve_tenant(")
    identity_start = route_source.index("identity = get_request_identity(request)")
    actor_start = route_source.index('actor_user_id = identity.user_id or "system"')
    mutation_start = route_source.index("result = service.ingest_text(")
    if not tenant_start < identity_start < actor_start < mutation_start:
        errors.append("ingestion must resolve tenant, identity, and actor before mutation")
    mutation_source = route_source[mutation_start:]
    if "tenant_id=tenant_id," not in mutation_source:
        errors.append("ingestion must use the resolved request tenant")
    if "actor_user_id=actor_user_id," not in mutation_source:
        errors.append("ingestion must use the authenticated request actor")
    if "except PlatformKnowledgeIngestionServiceError as exc:" not in route_source:
        errors.append("ingestion route must preserve service HTTP failure semantics")

    service_start = composition_source.index(
        "def build_postgres_knowledge_ingestion_service(",
    )
    service_end = composition_source.index(
        "def build_configured_postgres_knowledge_ingestion_service(",
        service_start,
    )
    service_source = composition_source[service_start:service_end]
    if "document_repository=PostgresDocumentWriteRepository(database)" not in service_source:
        errors.append("production ingestion service must inject the document writer")
    if "audit_event_writer=PostgresAuditEventWriteRepository(database)" not in service_source:
        errors.append("production ingestion service must inject the audit event writer")
    if "check_phase6_knowledge_ingestion_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the ingestion actor audit check")
    return errors


def main() -> int:
    errors = check_ingestion_audit_contract()
    errors += check_actor_validation_before_mutation()
    errors += check_failure_contract()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-knowledge-ingestion-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-knowledge-ingestion-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
