#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for embedding record upserts."""

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

from services.knowledge_embedding_records import (  # noqa: E402
    EmbeddingRecordApiCommandInput,
    PlatformKnowledgeEmbeddingRecordService,
    PlatformKnowledgeEmbeddingRecordServiceError,
)


class EmbeddingRecordWriter:
    def __init__(self) -> None:
        self.records = []

    def append_embedding_record(self, record):
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


def command_input() -> EmbeddingRecordApiCommandInput:
    return EmbeddingRecordApiCommandInput(
        id="embedding-support-001",
        tenant_id="acme",
        chunk_id="chunk-support-001",
        model_config_id="model-config-embedding-primary",
        vector_ref="vector://acme/support/001",
        actor_user_id="acme:admin",
    )


def build_service(
    *,
    embedding_record_writer: EmbeddingRecordWriter | None = None,
    audit_writer: AuditEventWriter | None = None,
) -> PlatformKnowledgeEmbeddingRecordService:
    return PlatformKnowledgeEmbeddingRecordService(
        embedding_record_writer=(
            embedding_record_writer or EmbeddingRecordWriter()
        ),
        audit_event_writer=audit_writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_upsert_audit_contract() -> list[str]:
    embedding_record_writer = EmbeddingRecordWriter()
    audit_writer = AuditEventWriter()
    service = build_service(
        embedding_record_writer=embedding_record_writer,
        audit_writer=audit_writer,
    )
    response = service.upsert_embedding_record_from_api(command_input())

    errors: list[str] = []
    if response.tenant_id != "acme":
        errors.append("embedding record upsert must persist within the request tenant")
    if response.id != "embedding-support-001":
        errors.append("embedding record upsert must return the persisted target")
    if len(embedding_record_writer.records) != 1:
        errors.append("embedding record upsert must persist exactly one record")
    if len(audit_writer.records) != 1:
        return errors + ["embedding record upsert must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "knowledge_embedding_record.upserted",
        "target_type": "knowledge_embedding_record",
        "target_id": "embedding-support-001",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant_id": "acme",
        "embedding_record_id": "embedding-support-001",
        "chunk_id": "chunk-support-001",
        "model_config_id": "model-config-embedding-primary",
        "vector_ref_configured": True,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain normalized embedding record evidence")
    if "vector_ref" in event.payload:
        errors.append("audit payload must not expose the raw vector reference")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    for failure in (
        RuntimeError("audit unavailable"),
        ValueError("audit rejected"),
    ):
        try:
            build_service(
                audit_writer=AuditEventWriter(failure=failure),
            ).upsert_embedding_record_from_api(command_input())
        except PlatformKnowledgeEmbeddingRecordServiceError as exc:
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
        build_service(audit_writer=blank_id_writer).upsert_embedding_record_from_api(
            command_input(),
        )
    except PlatformKnowledgeEmbeddingRecordServiceError as exc:
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
        '    @router.post("/enterprise/platform/knowledge/embedding-records/upsert")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    tenant_start = route_source.index("tenant_id = _resolve_tenant(")
    identity_start = route_source.index("identity = get_request_identity(request)")
    actor_start = route_source.index('actor_user_id = identity.user_id or "system"')
    mutation_start = route_source.index(
        "persisted_record = service.upsert_embedding_record_from_api(",
    )
    if not tenant_start < identity_start < actor_start < mutation_start:
        errors.append(
            "embedding record upsert must resolve tenant, identity, and actor before mutation",
        )
    mutation_source = route_source[mutation_start:]
    if "tenant_id=tenant_id," not in mutation_source:
        errors.append("embedding record upsert must use the resolved request tenant")
    if "actor_user_id=actor_user_id," not in mutation_source:
        errors.append("embedding record upsert must use the authenticated request actor")

    service_start = composition_source.index(
        "def build_postgres_knowledge_embedding_record_service(",
    )
    service_end = composition_source.index(
        "def build_configured_postgres_knowledge_embedding_record_service(",
        service_start,
    )
    service_source = composition_source[service_start:service_end]
    if (
        "embedding_record_writer=PostgresEmbeddingRecordWriteRepository(database)"
        not in service_source
    ):
        errors.append("production service must inject the embedding record writer")
    if "audit_event_writer=PostgresAuditEventWriteRepository(database)" not in service_source:
        errors.append("production service must inject the audit event writer")
    if "build_knowledge_embedding_record_service" not in main_source:
        errors.append("application wiring must inject the embedding record service")
    if "check_phase6_knowledge_embedding_record_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the embedding record actor audit check")
    return errors


def main() -> int:
    errors = check_upsert_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-knowledge-embedding-record-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-knowledge-embedding-record-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
