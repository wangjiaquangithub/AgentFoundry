#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for connector config imports."""

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


def import_payload() -> list[dict]:
    return [
        {
            "tenant": "acme",
            "base_url": "https://enterprise.example.test/api/",
            "token": SECRET_FIXTURE,
            "policy_path": "/policies/search",
            "ticket_path": "/tickets/{ticket_id}",
            "metrics_path": "/departments/{department}/metrics",
            "timeout_seconds": 12,
            "enabled": True,
        },
    ]


def check_import_audit_contract(config_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(config_path, audit_writer=audit_writer)
    service.import_configs_payload(
        import_payload(),
        actor="acme:admin",
        mode="merge",
        tenant="acme",
    )

    errors: list[str] = []
    persisted = service.list_configs().get("acme", {})
    if persisted.get("updated_by") != "acme:admin":
        errors.append("connector config import must persist the authenticated actor")
    if persisted.get("token") != SECRET_FIXTURE:
        errors.append("connector config import must persist the imported secret")
    redacted = service.redacted_configs(tenant="acme")
    if len(redacted) != 1 or redacted[0].get("token_configured") is not True:
        errors.append("redacted imported config must expose token configuration state")
    if SECRET_FIXTURE in repr(redacted):
        errors.append("redacted imported config must not expose the connector token")
    if len(audit_writer.records) != 1:
        return errors + ["connector config import must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "connector_config.imported",
        "target_type": "connector_config",
        "target_id": "acme",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "mode": "merge",
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
        errors.append("audit payload must contain only redacted connector import evidence")
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
        failing_service.import_configs_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
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
        build_service(config_path, audit_writer=blank_id_writer).import_configs_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
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

    route_start = api_source.index('    @router.post("/enterprise/platform/config/import")')
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    actor_start = route_source.index(
        "actor = connector_config_service.import_actor(\n"
        "            identity.user_id,"
    )
    import_start = route_source.index(
        "deps.connector_config_service().import_configs_payload("
    )
    import_end = route_source.index("\n                )", import_start)
    import_call = route_source[import_start:import_end]
    if identity_start > actor_start or actor_start > import_start:
        errors.append("connector config import must resolve identity before mutation")
    if "actor=actor," not in import_call:
        errors.append("connector config import must receive the authenticated request actor")
    if "tenant=tenant_id," not in import_call:
        errors.append("connector config import must receive the authenticated request tenant")

    composition_start = main_source.index("def _platform_connector_config_service()")
    composition_end = main_source.index(
        "def _raise_platform_connector_config_service_error(",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=audit_event_write_repository" not in composition_source:
        errors.append("production connector service must inject the audit event writer")
    if "check_phase6_connector_config_import_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the connector config import audit check")
    return errors


def main() -> int:
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        errors = check_import_audit_contract(temporary_path / "connector-configs.json")
        errors += check_audit_fail_closed(temporary_path / "failed-configs.json")
        errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-connector-config-import-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-connector-config-import-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
