#!/usr/bin/env python3
"""Validate immutable audit evidence for Phase 6 approval mutations."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "backend" / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from backend.services.approvals import (  # noqa: E402
    PlatformApprovalService,
    PlatformApprovalServiceError,
)


class ApprovalRepository:
    def __init__(self) -> None:
        self.records: dict[str, dict] = {}

    def append(self, record: dict) -> dict:
        persisted = dict(record)
        self.records[persisted["approval_id"]] = persisted
        return dict(persisted)

    def get(self, *, approval_id: str, tenant: str) -> dict | None:
        record = self.records.get(approval_id)
        if record is None or record.get("tenant") != tenant:
            return None
        return dict(record)

    def update_status(
        self,
        *,
        approval_id: str,
        tenant: str,
        status: str,
        decided_by: str,
        decided_at: str,
        decision_note: str | None,
    ) -> dict | None:
        record = self.records.get(approval_id)
        if record is None or record.get("tenant") != tenant:
            return None
        record.update(
            {
                "status": status,
                "decided_by": decided_by,
                "decided_at": decided_at,
                "decision_note": decision_note,
            }
        )
        return dict(record)


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def approval_service(
    *,
    repository: ApprovalRepository | None = None,
    writer: AuditEventWriter | None = None,
) -> PlatformApprovalService:
    return PlatformApprovalService(
        repository=repository or ApprovalRepository(),
        audit_event_writer=writer or AuditEventWriter(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def create_request(service: PlatformApprovalService, *, requested_by: str) -> dict:
    return service.create_request(
        request_type="tool_run",
        tenant="acme",
        user_id="acme:alice",
        agent_id="support-agent",
        inputs={"ticket_id": "secret-ticket", "customer_email": "secret@example.com"},
        requested_by=requested_by,
        tool_name="support.update_ticket",
        reason="Sensitive business justification must not enter the audit payload.",
    )


def check_mutation_audit_events() -> list[str]:
    repository = ApprovalRepository()
    writer = AuditEventWriter()
    service = approval_service(repository=repository, writer=writer)

    approved = create_request(service, requested_by="acme:alice")
    service.update_status(
        approval_id=approved["approval_id"],
        tenant="acme",
        status="approved",
        decided_by="acme:reviewer",
        decision_note="Sensitive approval note must not enter the audit payload.",
    )
    rejected = create_request(service, requested_by="acme:bob")
    service.update_status(
        approval_id=rejected["approval_id"],
        tenant="acme",
        status="rejected",
        decided_by="acme:reviewer",
        decision_note="Sensitive rejection note must not enter the audit payload.",
    )

    errors: list[str] = []
    event_types = [event.event_type for event in writer.records]
    if event_types != [
        "approval.requested",
        "approval.approved",
        "approval.requested",
        "approval.rejected",
    ]:
        errors.append("approval mutations must append requested/approved/rejected events")

    expected_by_type = {
        "approval.approved": (approved["approval_id"], "acme:reviewer", "approved"),
        "approval.rejected": (rejected["approval_id"], "acme:reviewer", "rejected"),
    }
    for event in writer.records:
        if event.event_type == "approval.requested":
            expected_id = event.target_id
            expected_actor = event.payload.get("requested_by")
            expected_status = "pending"
        else:
            expected_id, expected_actor, expected_status = expected_by_type[event.event_type]

        expected_fields = {
            "tenant_id": "acme",
            "actor_user_id": expected_actor,
            "target_type": "approval_request",
            "target_id": expected_id,
            "created_at": "2026-07-23T00:00:00+00:00",
        }
        for field, expected in expected_fields.items():
            if getattr(event, field) != expected:
                errors.append(
                    f"{event.event_type} {field} must equal {expected!r}"
                )

        expected_payload_keys = {
            "schema_version",
            "approval_id",
            "tenant",
            "request_type",
            "status",
            "requested_by",
            "decided_by",
            "agent_id",
            "tool_name",
            "workflow_type",
            "input_keys",
        }
        if set(event.payload) != expected_payload_keys:
            errors.append(
                f"{event.event_type} payload must contain only non-sensitive evidence"
            )
        if event.payload.get("status") != expected_status:
            errors.append(f"{event.event_type} payload must preserve mutation status")
        if event.payload.get("input_keys") != ["customer_email", "ticket_id"]:
            errors.append(f"{event.event_type} payload must preserve sorted input keys")
        serialized_payload = repr(event.payload)
        for sensitive_value in (
            "secret-ticket",
            "secret@example.com",
            "Sensitive business justification",
            "Sensitive approval note",
            "Sensitive rejection note",
        ):
            if sensitive_value in serialized_payload:
                errors.append(
                    f"{event.event_type} payload must not contain sensitive values"
                )
    return errors


def check_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = approval_service(
        writer=AuditEventWriter(failure=RuntimeError("audit unavailable"))
    )
    try:
        create_request(failing_service, requested_by="acme:alice")
    except PlatformApprovalServiceError as exc:
        if exc.status_code != 500:
            errors.append("request audit failure must surface as HTTP 500")
    else:
        errors.append("request audit failure must fail closed")

    repository = ApprovalRepository()
    seed_writer = AuditEventWriter()
    seed_service = approval_service(repository=repository, writer=seed_writer)
    pending = create_request(seed_service, requested_by="acme:alice")
    decision_service = approval_service(
        repository=repository,
        writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        decision_service.update_status(
            approval_id=pending["approval_id"],
            tenant="acme",
            status="approved",
            decided_by="acme:reviewer",
            decision_note=None,
        )
    except PlatformApprovalServiceError as exc:
        if exc.status_code != 500:
            errors.append("decision audit failure must surface as HTTP 500")
    else:
        errors.append("decision audit failure must fail closed")

    blank_id_writer = AuditEventWriter()
    original_append = blank_id_writer.append_audit_event

    def append_without_id(record):
        return replace(original_append(record), id="")

    blank_id_writer.append_audit_event = append_without_id
    try:
        create_request(
            approval_service(writer=blank_id_writer),
            requested_by="acme:alice",
        )
    except PlatformApprovalServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_composition_and_gate() -> list[str]:
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    service_start = main_source.index("def _platform_approval_service()")
    service_end = main_source.index(
        "def _raise_platform_approval_service_error",
        service_start,
    )
    service_source = main_source[service_start:service_end]
    if "audit_event_writer=audit_event_write_repository" not in service_source:
        errors.append("backend composition must inject the production audit writer")
    if "scripts/check_phase6_approval_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the approval audit check")
    return errors


def main() -> int:
    errors = check_mutation_audit_events() + check_fail_closed() + check_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-approval-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-approval-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
