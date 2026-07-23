#!/usr/bin/env python3
"""Validate immutable audit evidence for Phase 6 model config mutations."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSITION = ROOT / "backend" / "services" / "composition.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.model_configs import (  # noqa: E402
    ModelConfigWriteCommand,
    PlatformModelConfigService,
    PlatformModelConfigServiceError,
)


SECRET_CONFIG_REF = "vault://acme/openai/production-api-key"


class ModelConfigWriter:
    def __init__(self) -> None:
        self.records = []

    def upsert_model_config(self, record):
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


def command() -> ModelConfigWriteCommand:
    return ModelConfigWriteCommand(
        id="model-config-chat-primary",
        tenant_id="acme",
        name="Primary Chat",
        provider="openai",
        model="gpt-4.1",
        purpose="chat",
        status="active",
        config_ref=SECRET_CONFIG_REF,
        actor_user_id="acme:admin",
    )


def model_config_service(
    *,
    model_writer: ModelConfigWriter | None = None,
    audit_writer: AuditEventWriter | None = None,
) -> PlatformModelConfigService:
    return PlatformModelConfigService(
        model_config_writer=model_writer or ModelConfigWriter(),
        audit_event_writer=audit_writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_mutation_audit_event() -> list[str]:
    model_writer = ModelConfigWriter()
    audit_writer = AuditEventWriter()
    service = model_config_service(
        model_writer=model_writer,
        audit_writer=audit_writer,
    )
    persisted = service.upsert_model_config(command())

    errors: list[str] = []
    if model_writer.records != [persisted]:
        errors.append("model config mutation must persist exactly one record")
    if len(audit_writer.records) != 1:
        return errors + ["model config mutation must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "event_type": "model_config.upserted",
        "target_type": "model_config",
        "target_id": "model-config-chat-primary",
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant_id": "acme",
        "model_config_id": "model-config-chat-primary",
        "name": "Primary Chat",
        "provider": "openai",
        "model": "gpt-4.1",
        "purpose": "chat",
        "status": "active",
        "config_ref_configured": True,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain only the model config evidence contract")
    if "config_ref" in event.payload or SECRET_CONFIG_REF in repr(event.payload):
        errors.append("audit payload must not expose the config_ref secret reference")
    return errors


def check_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = model_config_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable"))
    )
    try:
        failing_service.upsert_model_config(command())
    except PlatformModelConfigServiceError as exc:
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
        model_config_service(audit_writer=blank_id_writer).upsert_model_config(command())
    except PlatformModelConfigServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_composition_and_gate() -> list[str]:
    composition_source = COMPOSITION.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    service_start = composition_source.index("def build_postgres_model_config_service(")
    service_end = composition_source.index(
        "def build_configured_postgres_model_config_service()",
        service_start,
    )
    service_source = composition_source[service_start:service_end]
    if "audit_event_writer=PostgresAuditEventWriteRepository(database)" not in service_source:
        errors.append("production composition must inject the PostgreSQL audit writer")
    if "scripts/check_phase6_model_config_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the model config audit check")
    return errors


def main() -> int:
    errors = (
        check_mutation_audit_event()
        + check_fail_closed()
        + check_composition_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-model-config-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-model-config-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
