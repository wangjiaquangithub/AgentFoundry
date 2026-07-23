#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for workflow template enables."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path
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
    enabled: bool,
    default_inputs: dict[str, Any] | None = None,
    tool_names: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "workflow_type": workflow_type,
        "name": name,
        "description": f"Auditable {name} workflow.",
        "enabled": enabled,
        "default_inputs": dict(default_inputs or {}),
        "steps": [
            {"id": f"step-{index}", "tool_name": tool_name}
            for index, tool_name in enumerate(tool_names or [], start=1)
        ],
        "updated_at": "2026-07-22T00:00:00+00:00",
        "updated_by": "acme:operator",
    }


class WorkflowTemplateRepository:
    def __init__(self) -> None:
        self.saved: dict[str, list[dict[str, Any]]] = {
            "acme": [
                workflow(
                    "support_followup",
                    "Support Follow-up",
                    enabled=False,
                    default_inputs={"ticket_id": "INC-1001"},
                    tool_names=["enterprise_get_ticket_status"],
                ),
                workflow(
                    "daily_ops_brief",
                    "Daily Operations Brief",
                    enabled=True,
                    default_inputs={"department": "support"},
                    tool_names=["enterprise_metrics"],
                ),
                workflow(
                    "policy_review",
                    "Policy Review",
                    enabled=False,
                    default_inputs={
                        "department": "support",
                        "policy_keyword": "remote",
                    },
                    tool_names=[
                        "enterprise_lookup_policy",
                        "enterprise_metrics",
                    ],
                ),
            ],
            "globex": [
                workflow(
                    "support_followup",
                    "Globex Support Follow-up",
                    enabled=False,
                    default_inputs={"ticket_id": "GBX-1001"},
                    tool_names=["enterprise_get_ticket_status"],
                ),
            ],
        }
        self.created_by: dict[str, str] = {}
        self.save_calls = 0

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
        self.save_calls += 1


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


class BlankIdAuditEventWriter(AuditEventWriter):
    def append_audit_event(self, record):
        return replace(super().append_audit_event(record), id="")


def build_service(
    *,
    audit_writer: AuditEventWriter,
) -> tuple[PlatformWorkflowTemplateService, WorkflowTemplateRepository]:
    repository = WorkflowTemplateRepository()
    return (
        PlatformWorkflowTemplateService(
            repository=repository,
            audit_event_writer=audit_writer,
            now=lambda: "2026-07-23T02:00:00+00:00",
        ),
        repository,
    )


def enable_templates(service: PlatformWorkflowTemplateService) -> None:
    service.enable_disabled_templates(
        actor="acme:admin",
        tenant="acme",
    )


def expected_payload(workflow_record: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "workflow_type": workflow_record["workflow_type"],
        "name": workflow_record["name"],
        "description": workflow_record["description"],
        "enabled": True,
        "default_input_keys": sorted(workflow_record["default_inputs"].keys()),
        "step_count": len(workflow_record["steps"]),
        "tool_names": [step["tool_name"] for step in workflow_record["steps"]],
        "updated_by": "acme:admin",
    }


def check_enable_audit_contract() -> list[str]:
    audit_writer = AuditEventWriter()
    service, repository = build_service(audit_writer=audit_writer)
    enabled_workflows, workflows = service.enable_disabled_templates(
        actor="acme:admin",
        tenant="acme",
    )

    errors: list[str] = []
    enabled_by_type = {
        item["workflow_type"]: item for item in enabled_workflows
    }
    if set(enabled_by_type) != {"support_followup", "policy_review"}:
        errors.append("only disabled request-tenant workflows must be enabled")
    persisted_by_type = {item["workflow_type"]: item for item in workflows}
    for workflow_type in ("support_followup", "policy_review"):
        persisted = persisted_by_type[workflow_type]
        if persisted.get("enabled") is not True:
            errors.append(f"enabled workflow {workflow_type} must persist enabled=true")
        if persisted.get("updated_at") != "2026-07-23T02:00:00+00:00":
            errors.append(f"enabled workflow {workflow_type} must persist updated_at")
        if persisted.get("updated_by") != "acme:admin":
            errors.append(f"enabled workflow {workflow_type} must persist request actor")

    unchanged = persisted_by_type["daily_ops_brief"]
    if unchanged.get("updated_at") != "2026-07-22T00:00:00+00:00":
        errors.append("already-enabled workflow timestamp must remain unchanged")
    if unchanged.get("updated_by") != "acme:operator":
        errors.append("already-enabled workflow actor must remain unchanged")
    if repository.created_by.get("acme") != "acme:admin":
        errors.append("workflow enable persistence must use the authenticated actor")
    if repository.saved["globex"][0]["enabled"] is not False:
        errors.append("workflow enable must preserve other tenant records")

    if len(audit_writer.records) != 2:
        return errors + [
            "workflow enable must append exactly one audit event per changed template"
        ]
    events_by_target = {event.target_id: event for event in audit_writer.records}
    if set(events_by_target) != {"support_followup", "policy_review"}:
        errors.append("workflow enable audits must target every changed template")
        return errors

    for workflow_type, event in events_by_target.items():
        expected_fields = {
            "tenant_id": "acme",
            "actor_user_id": "acme:admin",
            "event_type": "workflow_template.enabled",
            "target_type": "workflow_template",
            "target_id": workflow_type,
            "created_at": "2026-07-23T02:00:00+00:00",
        }
        for field, expected in expected_fields.items():
            if getattr(event, field) != expected:
                errors.append(f"audit {workflow_type} {field} must equal {expected!r}")
        if event.payload != expected_payload(persisted_by_type[workflow_type]):
            errors.append(
                f"audit {workflow_type} payload must contain normalized enable evidence"
            )

    save_calls = repository.save_calls
    event_count = len(audit_writer.records)
    enabled_again, _ = service.enable_disabled_templates(
        actor="acme:admin",
        tenant="acme",
    )
    if enabled_again:
        errors.append("no-op workflow enable must return no changed templates")
    if repository.save_calls != save_calls:
        errors.append("no-op workflow enable must not rewrite template persistence")
    if len(audit_writer.records) != event_count:
        errors.append("no-op workflow enable must not append audit events")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service, _ = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        enable_templates(failing_service)
    except PlatformWorkflowTemplateServiceError as exc:
        if exc.status_code != 500:
            errors.append("audit persistence failure must surface as HTTP 500")
    else:
        errors.append("audit persistence failure must fail closed")

    blank_id_service, _ = build_service(audit_writer=BlankIdAuditEventWriter())
    try:
        enable_templates(blank_id_service)
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
        '    @router.post("/enterprise/platform/ops/tasks/{task_code}/resolve")'
    )
    route_end = api_source.index(
        '    @router.patch("/enterprise/platform/workflows/{workflow_type}")',
        route_start,
    )
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    tenant_start = route_source.index("tenant = _request_tenant(")
    context_start = route_source.index("status_service.resolve_ops_task_context(")
    enable_start = route_source.index("enable_disabled_templates(")
    if not identity_start < tenant_start < context_start < enable_start:
        errors.append("workflow enable must resolve identity and tenant before mutation")

    context_end = route_source.index("\n            )", context_start)
    context_call = route_source[context_start:context_end]
    if "actor=identity.user_id," not in context_call:
        errors.append("ops task context must receive the authenticated actor")
    if "user_id=identity.user_id," not in context_call:
        errors.append("ops task context must receive the authenticated user id")

    enable_end = route_source.index("\n            )", enable_start)
    enable_call = route_source[enable_start:enable_end]
    if 'actor=resolve_context["actor"],' not in enable_call:
        errors.append("workflow enable must receive the normalized request actor")
    if "tenant=tenant," not in enable_call:
        errors.append("workflow enable must receive the authenticated request tenant")

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
    if "check_phase6_workflow_template_enable_actor_audit.py" not in gate_source:
        errors.append(
            "Phase 6 backend gate must run the workflow template enable audit check"
        )
    return errors


def main() -> int:
    errors = check_enable_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(
                f"[phase6-workflow-template-enable-actor-audit] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-workflow-template-enable-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
