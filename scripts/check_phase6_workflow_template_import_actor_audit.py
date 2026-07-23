#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for workflow template imports."""

from __future__ import annotations

import sys
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
PLATFORM_ADMIN_API = BACKEND_DIR / "api" / "platform_admin.py"
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


class WorkflowTemplateRepository:
    def __init__(self) -> None:
        self.saved: dict[str, list[dict[str, Any]]] = {
            "acme": [workflow("existing_acme", "Existing Acme Workflow")],
            "globex": [workflow("existing_globex", "Existing Globex Workflow")],
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


def workflow(workflow_type: str, name: str) -> dict[str, Any]:
    return {
        "workflow_type": workflow_type,
        "name": name,
        "description": "Auditable enterprise workflow.",
        "enabled": True,
        "default_inputs": {
            "ticket_id": "INC-1001",
            "department": "support",
        },
        "steps": [
            {"id": "ticket", "tool_name": "enterprise_get_ticket_status"},
            {"id": "metrics", "tool_name": "enterprise_metrics"},
        ],
    }


def build_service(
    *,
    audit_writer: AuditEventWriter,
) -> tuple[PlatformWorkflowTemplateService, WorkflowTemplateRepository]:
    repository = WorkflowTemplateRepository()
    return (
        PlatformWorkflowTemplateService(
            repository=repository,
            audit_event_writer=audit_writer,
            now=lambda: "2026-07-23T00:00:00+00:00",
        ),
        repository,
    )


def import_payload() -> list[dict[str, Any]]:
    return [workflow("support_followup", "Support Follow-up")]


def check_import_audit_contract() -> list[str]:
    audit_writer = AuditEventWriter()
    service, repository = build_service(audit_writer=audit_writer)
    service.import_templates_payload(
        import_payload(),
        actor="acme:admin",
        mode="merge",
        tenant="acme",
    )

    errors: list[str] = []
    acme_workflow_types = {
        item["workflow_type"] for item in repository.saved["acme"]
    }
    if acme_workflow_types != {"existing_acme", "support_followup"}:
        errors.append("Workflow template merge import must persist in the request tenant")
    globex_workflow_types = [
        item["workflow_type"] for item in repository.saved["globex"]
    ]
    if globex_workflow_types != ["existing_globex"]:
        errors.append("Workflow template import must preserve other tenant records")
    if repository.created_by.get("acme") != "acme:admin":
        errors.append("Workflow template persistence must use the authenticated actor")
    if len(audit_writer.records) != 1:
        return errors + [
            "Workflow template import must append exactly one audit event per template"
        ]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "workflow_template.imported",
        "target_type": "workflow_template",
        "target_id": "support_followup",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")
    try:
        datetime.fromisoformat(event.created_at)
    except (TypeError, ValueError):
        errors.append("audit created_at must be an ISO-8601 timestamp")

    expected_payload = {
        "schema_version": 1,
        "mode": "merge",
        "workflow_type": "support_followup",
        "name": "Support Follow-up",
        "description": "Auditable enterprise workflow.",
        "enabled": True,
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
            "audit payload must contain normalized workflow template import evidence"
        )
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service, _ = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.import_templates_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
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
        blank_id_service.import_templates_payload(
            import_payload(),
            actor="acme:admin",
            mode="replace",
            tenant="acme",
        )
    except PlatformWorkflowTemplateServiceError as exc:
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
        "deps.workflow_template_service().import_templates_payload("
    )
    import_end = route_source.index("\n                )", import_start)
    import_call = route_source[import_start:import_end]
    if identity_start > actor_start or actor_start > import_start:
        errors.append("Workflow template import must resolve identity before mutation")
    if "actor=actor," not in import_call:
        errors.append("Workflow template import must receive the authenticated actor")
    if "tenant=tenant_id," not in import_call:
        errors.append("Workflow template import must receive the authenticated tenant")

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
    if "check_phase6_workflow_template_import_actor_audit.py" not in gate_source:
        errors.append(
            "Phase 6 backend gate must run the workflow template import audit check"
        )
    return errors


def main() -> int:
    errors = check_import_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(
                f"[phase6-workflow-template-import-actor-audit] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-workflow-template-import-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
