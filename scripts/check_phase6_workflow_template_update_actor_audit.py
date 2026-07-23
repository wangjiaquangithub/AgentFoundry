#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for workflow template updates."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
WORKFLOWS_API = BACKEND_DIR / "api" / "workflows.py"
MAIN = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.workflows import (  # noqa: E402
    PlatformWorkflowTemplateService,
    PlatformWorkflowTemplateServiceError,
)


def workflow(
    workflow_type: str,
    name: str,
    *,
    enabled: bool = True,
) -> dict[str, Any]:
    return {
        "workflow_type": workflow_type,
        "name": name,
        "description": "Original enterprise workflow.",
        "enabled": enabled,
        "default_inputs": {"ticket_id": "INC-1001"},
        "steps": [
            {"id": "ticket", "tool_name": "enterprise_get_ticket_status"},
            {"id": "metrics", "tool_name": "enterprise_metrics"},
        ],
        "updated_at": "2026-07-22T00:00:00+00:00",
        "updated_by": "acme:operator",
    }


class WorkflowTemplateRepository:
    def __init__(self) -> None:
        self.saved: dict[str, list[dict[str, Any]]] = {
            "acme": [workflow("support_followup", "Support Follow-up")],
            "globex": [workflow("support_followup", "Globex Support Follow-up")],
        }
        self.created_by: dict[str, str] = {}

    def exists(self, *, tenant: str) -> bool:
        return tenant in self.saved

    def list(self, *, tenant: str) -> list[dict[str, Any]]:
        return [dict(item) for item in self.saved.get(tenant, [])]

    def save_all(
        self,
        workflows: list[dict[str, Any]],
        *,
        tenant: str,
        created_by: str,
    ) -> None:
        self.saved[tenant] = [dict(item) for item in workflows]
        self.created_by[tenant] = created_by


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
    *,
    audit_writer: AuditEventWriter,
) -> tuple[PlatformWorkflowTemplateService, WorkflowTemplateRepository]:
    repository = WorkflowTemplateRepository()
    return (
        PlatformWorkflowTemplateService(
            repository=repository,
            audit_event_writer=audit_writer,
            now=lambda: "2026-07-23T01:00:00+00:00",
        ),
        repository,
    )


def update_payload() -> SimpleNamespace:
    return SimpleNamespace(
        name="Updated Support Follow-up",
        description="Updated auditable enterprise workflow.",
        enabled=False,
        default_inputs={
            "department": "support",
            "ticket_id": "INC-2002",
        },
    )


def update_template(service: PlatformWorkflowTemplateService) -> None:
    context = service.update_template_context(
        workflow_type=" support_followup ",
        actor="acme:admin",
        tenant="acme",
    )
    service.update_template(
        workflow_type=context["workflow_type"],
        payload=update_payload(),
        actor=context["actor"],
        tenant="acme",
    )


def check_update_audit_contract() -> list[str]:
    audit_writer = AuditEventWriter()
    service, repository = build_service(audit_writer=audit_writer)
    update_template(service)

    errors: list[str] = []
    updated = repository.saved["acme"][0]
    expected_update = {
        "name": "Updated Support Follow-up",
        "description": "Updated auditable enterprise workflow.",
        "enabled": False,
        "default_inputs": {
            "department": "support",
            "ticket_id": "INC-2002",
        },
        "updated_at": "2026-07-23T01:00:00+00:00",
        "updated_by": "acme:admin",
    }
    for field, expected in expected_update.items():
        if updated.get(field) != expected:
            errors.append(f"updated workflow {field} must equal {expected!r}")
    if repository.created_by.get("acme") != "acme:admin":
        errors.append("workflow template persistence must use the authenticated actor")
    if repository.saved["globex"][0]["name"] != "Globex Support Follow-up":
        errors.append("workflow template update must preserve other tenant records")
    if len(audit_writer.records) != 1:
        return errors + ["workflow template update must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "workflow_template.updated",
        "target_type": "workflow_template",
        "target_id": "support_followup",
        "created_at": "2026-07-23T01:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "workflow_type": "support_followup",
        "name": "Updated Support Follow-up",
        "description": "Updated auditable enterprise workflow.",
        "enabled": False,
        "default_input_keys": ["department", "ticket_id"],
        "step_count": 2,
        "tool_names": [
            "enterprise_get_ticket_status",
            "enterprise_metrics",
        ],
        "updated_by": "acme:admin",
    }
    if event.payload != expected_payload:
        errors.append(
            "audit payload must contain normalized workflow template update evidence"
        )
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service, _ = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        update_template(failing_service)
    except PlatformWorkflowTemplateServiceError as exc:
        if exc.status_code != 500:
            errors.append("audit persistence failure must surface as HTTP 500")
    else:
        errors.append("audit persistence failure must fail closed")

    blank_id_writer = AuditEventWriter()
    original_append = blank_id_writer.append_audit_event

    def append_without_id(record):
        return replace(original_append(record), id="")

    blank_id_writer.append_audit_event = append_without_id
    blank_id_service, _ = build_service(audit_writer=blank_id_writer)
    try:
        update_template(blank_id_service)
    except PlatformWorkflowTemplateServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = WORKFLOWS_API.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.patch("/enterprise/platform/workflows/{workflow_type}")'
    )
    route_end = api_source.index(
        '    @router.get("/enterprise/platform/workflows/runs")',
        route_start,
    )
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    tenant_start = route_source.index("tenant = _request_tenant(")
    context_start = route_source.index("workflow_service.update_template_context(")
    update_start = route_source.index("workflow_service.update_template(")
    if not identity_start < tenant_start < context_start < update_start:
        errors.append("workflow template update must resolve identity before mutation")

    context_end = route_source.index("\n        )", context_start)
    context_call = route_source[context_start:context_end]
    if "actor=identity.user_id," not in context_call:
        errors.append("workflow update context must receive the authenticated actor")
    if "tenant=tenant," not in context_call:
        errors.append("workflow update context must receive the authenticated tenant")

    update_end = route_source.index("\n            )", update_start)
    update_call = route_source[update_start:update_end]
    if 'actor=update_context["actor"],' not in update_call:
        errors.append("workflow update must receive the normalized request actor")
    if "tenant=tenant," not in update_call:
        errors.append("workflow update must receive the authenticated request tenant")

    composition_start = main_source.index(
        "def _platform_workflow_template_service()"
    )
    composition_end = main_source.index(
        "def _platform_workflow_run_service()",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=build_audit_event_write_repository()" not in composition_source:
        errors.append(
            "production workflow template service must inject the audit event writer"
        )
    if "now=now_iso" not in composition_source:
        errors.append("production workflow template service must inject the clock")
    if "check_phase6_workflow_template_update_actor_audit.py" not in gate_source:
        errors.append(
            "Phase 6 backend gate must run the workflow template update audit check"
        )
    return errors


def main() -> int:
    errors = check_update_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(
                f"[phase6-workflow-template-update-actor-audit] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-workflow-template-update-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
