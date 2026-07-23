#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for Model Config upserts."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MODEL_CONFIGS_API = BACKEND_DIR / "api" / "model_configs.py"
COMPOSITION = BACKEND_DIR / "services" / "composition.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.model_configs import (  # noqa: E402
    ModelConfigApiCommandInput,
    PlatformModelConfigService,
    PlatformModelConfigServiceError,
)


CONFIG_REF_FIXTURE = "vault://acme/openai/production-api-key"


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


def command_input() -> ModelConfigApiCommandInput:
    return ModelConfigApiCommandInput(
        id="model-config-chat-primary",
        tenant_id="acme",
        name="Primary Chat",
        provider="openai",
        model="gpt-4.1",
        purpose="chat",
        status="active",
        config_ref=CONFIG_REF_FIXTURE,
        actor_user_id="acme:admin",
    )


def build_service(
    *,
    model_writer: ModelConfigWriter | None = None,
    audit_writer: AuditEventWriter | None = None,
) -> PlatformModelConfigService:
    return PlatformModelConfigService(
        model_config_writer=model_writer or ModelConfigWriter(),
        audit_event_writer=audit_writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_upsert_audit_contract() -> list[str]:
    model_writer = ModelConfigWriter()
    audit_writer = AuditEventWriter()
    service = build_service(
        model_writer=model_writer,
        audit_writer=audit_writer,
    )
    response = service.upsert_model_config_from_api(command_input())

    errors: list[str] = []
    if response["tenant_id"] != "acme":
        errors.append("Model Config upsert must persist within the request tenant")
    if response["id"] != "model-config-chat-primary":
        errors.append("Model Config upsert must return the persisted target")
    if len(model_writer.records) != 1:
        errors.append("Model Config upsert must persist exactly one record")
    if len(audit_writer.records) != 1:
        return errors + ["Model Config upsert must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "model_config.upserted",
        "target_type": "model_config",
        "target_id": "model-config-chat-primary",
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
        errors.append("audit payload must contain the normalized Model Config evidence")
    if "config_ref" in event.payload or CONFIG_REF_FIXTURE in repr(event.payload):
        errors.append("audit payload must not expose the config_ref secret reference")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.upsert_model_config_from_api(command_input())
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
        build_service(audit_writer=blank_id_writer).upsert_model_config_from_api(
            command_input(),
        )
    except PlatformModelConfigServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = MODEL_CONFIGS_API.read_text(encoding="utf-8")
    composition_source = COMPOSITION.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.post("/enterprise/platform/model-configs/upsert")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    tenant_start = route_source.index("tenant_id = _resolve_tenant(")
    actor_start = route_source.index(
        'actor_user_id = identity.user_id or "system"',
    )
    mutation_start = route_source.index(
        "model_config = service.upsert_model_config_from_api(",
    )
    if not identity_start < tenant_start < actor_start < mutation_start:
        errors.append(
            "Model Config upsert must resolve identity, tenant, and actor before mutation",
        )
    mutation_source = route_source[mutation_start:]
    if "tenant_id=tenant_id," not in mutation_source:
        errors.append("Model Config upsert must use the resolved request tenant")
    if "actor_user_id=actor_user_id," not in mutation_source:
        errors.append("Model Config upsert must use the authenticated request actor")

    service_start = composition_source.index(
        "def build_postgres_model_config_service(",
    )
    service_end = composition_source.index(
        "def build_configured_postgres_model_config_service()",
        service_start,
    )
    service_source = composition_source[service_start:service_end]
    if "audit_event_writer=PostgresAuditEventWriteRepository(database)" not in service_source:
        errors.append("production Model Config service must inject the audit event writer")
    if "check_phase6_model_config_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the Model Config actor audit check")
    return errors


def main() -> int:
    errors = check_upsert_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-model-config-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-model-config-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
