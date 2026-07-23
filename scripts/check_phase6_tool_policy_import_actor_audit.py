#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for tool policy imports."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
PLATFORM_ADMIN_API = BACKEND_DIR / "api" / "platform_admin.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.tools import (  # noqa: E402
    PlatformToolPolicyService,
    PlatformToolPolicyServiceError,
)


SENSITIVE_MARKER = "should-not-appear-in-audit"


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
    policy_path: Path,
    *,
    audit_writer: AuditEventWriter,
) -> PlatformToolPolicyService:
    return PlatformToolPolicyService(
        policy_path=lambda: policy_path,
        default_policy={"tenants": {}},
        policy_mode=lambda: "enforce",
        enterprise_tool_names=[],
        runtime_context=lambda *args, **kwargs: {},
        identity_metadata=lambda user_id, tenant: [],
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def import_payload() -> dict:
    return {
        "tenants": {
            "acme": {
                "users": {
                    "acme:alice": {
                        "allow": [SENSITIVE_MARKER],
                        "deny": [],
                    }
                }
            }
        }
    }


def check_import_audit_contract(policy_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(policy_path, audit_writer=audit_writer)
    service.import_policy_payload(
        import_payload(),
        actor="acme:admin",
        mode="merge",
        tenant="acme",
    )

    errors: list[str] = []
    if service.load_policy()["tenants"].get("acme") is None:
        errors.append("tool policy import must persist the request tenant policy")
    if len(audit_writer.records) != 1:
        return errors + ["tool policy import must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "tool_policy.imported",
        "target_type": "tool_policy_tenant",
        "target_id": "acme",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "mode": "merge",
        "tenant_policy_present": True,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain only the import evidence contract")
    if SENSITIVE_MARKER in repr(event.payload):
        errors.append("audit payload must not copy imported policy contents")
    return errors


def check_audit_fail_closed(policy_path: Path) -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        policy_path,
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.import_policy_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
    except PlatformToolPolicyServiceError as exc:
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
        build_service(policy_path, audit_writer=blank_id_writer).import_policy_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
    except PlatformToolPolicyServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_and_gate() -> list[str]:
    api_source = PLATFORM_ADMIN_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index('    @router.post("/enterprise/platform/config/import")')
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    import_start = route_source.index(
        "deps.tool_policy_service().import_policy_payload("
    )
    import_end = route_source.index("\n                )", import_start)
    import_call = route_source[import_start:import_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    actor_start = route_source.index(
        "actor = connector_config_service.import_actor(\n"
        "            identity.user_id,"
    )
    if identity_start > actor_start or actor_start > import_start:
        errors.append("config import must resolve the authenticated actor before mutation")
    if "actor=actor," not in import_call:
        errors.append("tool policy import must receive the authenticated request actor")
    if "check_phase6_tool_policy_import_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the tool policy import audit check")
    return errors


def main() -> int:
    with TemporaryDirectory() as temporary_directory:
        policy_path = Path(temporary_directory) / "tool-policy.json"
        errors = (
            check_import_audit_contract(policy_path)
            + check_audit_fail_closed(policy_path)
            + check_route_and_gate()
        )
    if errors:
        for error in errors:
            print(f"[phase6-tool-policy-import-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-tool-policy-import-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
