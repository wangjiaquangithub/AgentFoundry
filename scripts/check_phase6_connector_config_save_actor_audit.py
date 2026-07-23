#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for connector config saves."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
PLATFORM_ADMIN_API = BACKEND_DIR / "api" / "platform_admin.py"
MAIN = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"
SECRET_FIXTURE = "replace-with-real-token"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.api.schemas import EnterpriseConnectorConfigSaveRequest  # noqa: E402
from backend.connectors import MockEnterpriseConnector  # noqa: E402
from backend.repositories.connectors import ConnectorConfigRepository  # noqa: E402
from backend.services.connectors import (  # noqa: E402
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def build_service(
    config_path: Path,
    *,
    audit_writer: AuditEventWriter,
) -> PlatformConnectorConfigService:
    return PlatformConnectorConfigService(
        repository=ConnectorConfigRepository(config_path),
        global_connector=MockEnterpriseConnector(),
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def save_payload() -> EnterpriseConnectorConfigSaveRequest:
    return EnterpriseConnectorConfigSaveRequest(
        tenant="acme",
        base_url="https://enterprise.example.test/api/",
        token=SECRET_FIXTURE,
        policy_path="/policies/search",
        ticket_path="/tickets/{ticket_id}",
        metrics_path="/departments/{department}/metrics",
        timeout_seconds=12,
        enabled=True,
    )


def check_save_audit_contract(config_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(config_path, audit_writer=audit_writer)
    response = service.save_config_payload(
        save_payload(),
        user_id="acme:admin",
        tenant="acme",
    )

    errors: list[str] = []
    config = response.get("config", {})
    if config.get("tenant") != "acme" or config.get("updated_by") != "acme:admin":
        errors.append("connector config response must bind the tenant and request actor")
    if config.get("token_configured") is not True:
        errors.append("connector config response must expose only token configuration state")
    if "token" in config or SECRET_FIXTURE in repr(response):
        errors.append("connector config response must not expose the connector token")
    if len(audit_writer.records) != 1:
        return errors + ["connector config save must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "connector_config.saved",
        "target_type": "connector_config",
        "target_id": "acme",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "base_url": "https://enterprise.example.test/api",
        "policy_path": "/policies/search",
        "ticket_path": "/tickets/{ticket_id}",
        "metrics_path": "/departments/{department}/metrics",
        "timeout_seconds": 12.0,
        "enabled": True,
        "token_configured": True,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain only redacted connector save evidence")
    if "token" in event.payload or SECRET_FIXTURE in repr(event.payload):
        errors.append("audit payload must not expose the connector token")
    return errors


def check_audit_fail_closed(config_path: Path) -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        config_path,
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.save_config_payload(
            save_payload(),
            user_id="acme:admin",
            tenant="acme",
        )
    except PlatformConnectorConfigServiceError as exc:
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
        build_service(config_path, audit_writer=blank_id_writer).save_config_payload(
            save_payload(),
            user_id="acme:admin",
            tenant="acme",
        )
    except PlatformConnectorConfigServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = PLATFORM_ADMIN_API.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.post("/enterprise/platform/connectors/configs")'
    )
    route_end = api_source.index(
        '    @router.post("/enterprise/platform/connectors/test")',
        route_start,
    )
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    save_start = route_source.index(
        "deps.connector_config_service().save_config_payload("
    )
    save_end = route_source.index("\n            )", save_start)
    save_call = route_source[save_start:save_end]
    if identity_start > save_start:
        errors.append("connector config save must resolve identity before mutation")
    if "user_id=identity.user_id," not in save_call:
        errors.append("connector config save must receive the authenticated request actor")

    composition_start = main_source.index("def _platform_connector_config_service()")
    composition_end = main_source.index(
        "def _raise_platform_connector_config_service_error(",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=audit_event_write_repository" not in composition_source:
        errors.append("production connector service must inject the audit event writer")
    if "check_phase6_connector_config_save_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the connector config save audit check")
    return errors


def main() -> int:
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        errors = check_save_audit_contract(temporary_path / "connector-configs.json")
        errors += check_audit_fail_closed(temporary_path / "failed-configs.json")
        errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-connector-config-save-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-connector-config-save-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
