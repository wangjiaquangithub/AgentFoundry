#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for tool policy updates."""

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
        policy_mode=lambda: "strict",
        enterprise_tool_names=["calendar.read", "email.send"],
        runtime_context=lambda *args, **kwargs: {},
        identity_metadata=lambda user_id, tenant: [],
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def update_payload() -> dict:
    return {
        "tenant": "acme",
        "user_id": "acme:alice",
        "allow": ["calendar.read"],
        "deny": ["email.send"],
    }


def check_update_audit_contract(policy_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(policy_path, audit_writer=audit_writer)
    authorization_policy, response = service.update_user_policy_request_payload(
        update_payload(),
        actor_user_id="acme:admin",
    )

    errors: list[str] = []
    if not authorization_policy.is_allowed("acme", "acme:alice", "calendar.read"):
        errors.append("tool policy update must persist the allowed tool")
    if authorization_policy.is_allowed("acme", "acme:alice", "email.send"):
        errors.append("tool policy update must persist the denied tool")
    if response.get("selected") != {"tenant": "acme", "user_id": "acme:alice"}:
        errors.append("tool policy response must preserve the updated tenant user")
    if len(audit_writer.records) != 1:
        return errors + ["tool policy update must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "tool_policy.user_policy_updated",
        "target_type": "tool_policy_user",
        "target_id": "acme:acme:alice",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_audit_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "user_id": "acme:alice",
        "allow": ["calendar.read"],
        "deny": ["email.send"],
    }
    if event.payload != expected_audit_payload:
        errors.append("audit payload must contain only the policy update evidence contract")
    return errors


def check_audit_fail_closed(policy_path: Path) -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        policy_path,
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.update_user_policy_request_payload(
            update_payload(),
            actor_user_id="acme:admin",
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
        build_service(policy_path, audit_writer=blank_id_writer).update_user_policy_request_payload(
            update_payload(),
            actor_user_id="acme:admin",
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

    route_start = api_source.index(
        '    @router.patch("/enterprise/platform/policies/tools")'
    )
    route_end = api_source.index(
        '    @router.get("/enterprise/platform/connectors/configs")',
        route_start,
    )
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    update_start = route_source.index(
        "deps.tool_policy_service().update_user_policy_request_payload("
    )
    update_end = route_source.index("\n            )", update_start)
    update_call = route_source[update_start:update_end]
    if identity_start > update_start:
        errors.append("tool policy update must resolve authenticated identity before mutation")
    if "actor_user_id=identity.user_id," not in update_call:
        errors.append("tool policy update must receive the authenticated request actor")
    if "check_phase6_tool_policy_update_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the tool policy update audit check")
    return errors


def main() -> int:
    with TemporaryDirectory() as temporary_directory:
        policy_path = Path(temporary_directory) / "tool-policy.json"
        errors = (
            check_update_audit_contract(policy_path)
            + check_audit_fail_closed(policy_path)
            + check_route_and_gate()
        )
    if errors:
        for error in errors:
            print(f"[phase6-tool-policy-update-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-tool-policy-update-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
