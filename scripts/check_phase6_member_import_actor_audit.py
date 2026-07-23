#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for platform member imports."""

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

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.repositories.members import MemberRepository  # noqa: E402
from backend.services.members import (  # noqa: E402
    PlatformMemberService,
    PlatformMemberServiceError,
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
) -> PlatformMemberService:
    return PlatformMemberService(
        repository=MemberRepository(config_path),
        tenant_hint_from_user_id=lambda user_id: user_id.partition(":")[0] or None,
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def import_payload(*, tenant: str = "acme") -> list[dict]:
    return [
        {
            "user_id": f"{tenant}:imported-user",
            "tenant": tenant,
            "display_name": "Imported User",
            "role": "Enterprise analyst",
            "status": "active",
            "sample_questions": ["Show the latest account status"],
            "source": "portable_config",
        },
    ]


def check_import_audit_contract(config_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(config_path, audit_writer=audit_writer)
    service.import_members_payload(
        import_payload(),
        actor="acme:admin",
        mode="merge",
        tenant="acme",
    )

    errors: list[str] = []
    persisted = service.get_member_by_user("acme:imported-user") or {}
    if persisted.get("tenant") != "acme":
        errors.append("member import must persist the authenticated request tenant")
    if persisted.get("updated_by") != "acme:admin":
        errors.append("member import must persist the authenticated request actor")
    if len(audit_writer.records) != 1:
        return errors + ["member import must append exactly one audit event per member"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "platform_member.imported",
        "target_type": "platform_member",
        "target_id": "acme:imported-user",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "mode": "merge",
        "tenant": "acme",
        "user_id": "acme:imported-user",
        "display_name": "Imported User",
        "role": "Enterprise analyst",
        "status": "active",
        "source": "portable_config",
        "updated_by": "acme:admin",
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain the normalized member import evidence")
    return errors


def check_tenant_boundary(config_path: Path) -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(config_path, audit_writer=audit_writer)
    try:
        service.import_members_payload(
            import_payload(tenant="globex"),
            actor="acme:admin",
            mode="merge",
            tenant="acme",
        )
    except PlatformMemberServiceError as exc:
        if exc.status_code != 403:
            return ["cross-tenant member import must surface as HTTP 403"]
    else:
        return ["cross-tenant member import must be rejected"]
    if audit_writer.records:
        return ["rejected cross-tenant member import must not append an audit event"]
    return []


def check_audit_fail_closed(config_path: Path) -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        config_path,
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.import_members_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
    except PlatformMemberServiceError as exc:
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
        build_service(config_path, audit_writer=blank_id_writer).import_members_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
    except PlatformMemberServiceError as exc:
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
    import_start = route_source.index("deps.member_service().import_members_payload(")
    import_end = route_source.index("\n                )", import_start)
    import_call = route_source[import_start:import_end]
    if identity_start > actor_start or actor_start > import_start:
        errors.append("member import must resolve identity before mutation")
    if "actor=actor," not in import_call:
        errors.append("member import must receive the authenticated request actor")
    if "tenant=tenant_id," not in import_call:
        errors.append("member import must receive the authenticated request tenant")

    composition_start = main_source.index("def _platform_member_service()")
    composition_end = main_source.index(
        "def _raise_platform_member_service_error(",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=audit_event_write_repository" not in composition_source:
        errors.append("production member service must inject the audit event writer")
    if "check_phase6_member_import_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the member import audit check")
    return errors


def main() -> int:
    with TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        errors = check_import_audit_contract(temporary_path / "members.json")
        errors += check_tenant_boundary(temporary_path / "foreign-members.json")
        errors += check_audit_fail_closed(temporary_path / "failed-members.json")
        errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-member-import-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-member-import-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
