#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for platform Agent updates."""

from __future__ import annotations

import sys
from dataclasses import replace
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENTS_API = BACKEND_DIR / "api" / "agents.py"
MAIN = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from api.schemas import EnterpriseAgentUpdateRequest  # noqa: E402
from scripts.check_phase6_tenant_access_boundary import (  # noqa: E402
    Agents,
    build_agent,
    identity_metadata,
    member_for_user,
    role_for_user,
    tenant_for_user,
)
from services.agents import PlatformAgentService, PlatformAgentServiceError  # noqa: E402


class AuditEventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records = []
        self.failure = failure

    def append_audit_event(self, record):
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def build_service(*, audit_writer: AuditEventWriter) -> PlatformAgentService:
    return PlatformAgentService(
        repository=Agents(
            [
                build_agent("agent_acme", "acme"),
                build_agent("agent_globex", "globex"),
            ],
        ),
        templates=[
            {
                "id": "knowledge-assistant",
                "name": "Knowledge Assistant",
                "description": "Answers with enterprise knowledge.",
                "tools": ["enterprise_search", "ticket_lookup"],
                "capabilities": ["knowledge"],
            },
        ],
        approval_required_tools=set(),
        tenant_for_user=tenant_for_user,
        tenant_hint_from_user_id=lambda user_id: tenant_for_user(user_id),
        identity_metadata=identity_metadata,
        member_for_user=member_for_user,
        role_for_user=role_for_user,
        audit_event_writer=audit_writer,
    )


def update_payload() -> EnterpriseAgentUpdateRequest:
    return EnterpriseAgentUpdateRequest(
        name="Updated Support Agent",
        description="Answers updated support questions.",
        tenant="acme",
        tools=["enterprise_search", "ticket_lookup"],
        knowledge_base_ids=["kb_support", "kb_policy"],
        model_config_id="model_enterprise",
        memory_enabled=False,
        workflow_enabled=False,
        allowed_user_ids=["acme:alice"],
        allowed_roles=["admin", "member"],
    )


def check_update_audit_contract() -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(audit_writer=audit_writer)
    response = service.update_agent_response_payload(
        "agent_acme",
        update_payload(),
        "acme:alice",
        tenant="acme",
    )

    errors: list[str] = []
    updated_agent = response["agent"]
    if updated_agent["tenant"] != "acme":
        errors.append("Agent update must persist within the request tenant")
    if updated_agent["created_by"] != "acme:system":
        errors.append("Agent update must preserve the original creator")
    if updated_agent["name"] != "Updated Support Agent":
        errors.append("Agent update must persist the normalized changes")
    acme_agents = service.list_agents(tenant="acme")
    if [agent["id"] for agent in acme_agents] != ["agent_acme"]:
        errors.append("Agent update must preserve the request-tenant catalog")
    globex_agents = service.list_agents(tenant="globex")
    if globex_agents != [build_agent("agent_globex", "globex")]:
        errors.append("Agent update must preserve other tenant records")
    if len(audit_writer.records) != 1:
        return errors + ["Agent update must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:alice",
        "event_type": "platform_agent.updated",
        "target_type": "platform_agent",
        "target_id": "agent_acme",
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
        "changed_fields": [
            "allowed_roles",
            "allowed_user_ids",
            "description",
            "knowledge_base_ids",
            "memory_enabled",
            "model_config_id",
            "name",
            "tenant",
            "tools",
            "workflow_enabled",
        ],
        "agent_id": "agent_acme",
        "tenant": "acme",
        "template_id": "knowledge-assistant",
        "name": "Updated Support Agent",
        "status": "published",
        "tool_names": ["enterprise_search", "ticket_lookup"],
        "knowledge_base_ids": ["kb_support", "kb_policy"],
        "memory_enabled": False,
        "workflow_enabled": False,
        "model_config_id": "model_enterprise",
        "allowed_user_count": 1,
        "allowed_role_count": 2,
        "updated_by": "acme:alice",
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain the normalized Agent update evidence")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.update_agent_response_payload(
            "agent_acme",
            update_payload(),
            "acme:alice",
            tenant="acme",
        )
    except PlatformAgentServiceError as exc:
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
        build_service(audit_writer=blank_id_writer).update_agent_response_payload(
            "agent_acme",
            update_payload(),
            "acme:alice",
            tenant="acme",
        )
    except PlatformAgentServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank persisted audit id must surface as HTTP 500")
    else:
        errors.append("blank persisted audit id must fail closed")
    return errors


def check_route_composition_and_gate() -> list[str]:
    api_source = AGENTS_API.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []

    route_start = api_source.index(
        '    @router.patch("/enterprise/platform/agents/{agent_id}")',
    )
    route_end = api_source.index(
        '    @router.delete("/enterprise/platform/agents/{agent_id}")',
        route_start,
    )
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    tenant_start = route_source.index("tenant = _request_tenant(")
    request_start = route_source.index(
        "update_request = agent_service.update_request_payload(",
    )
    mutation_start = route_source.index(
        "return agent_service.update_agent_response_payload(",
    )
    if not identity_start < tenant_start < request_start < mutation_start:
        errors.append("Agent update must resolve identity and tenant before mutation")
    if "header_user_id=identity.user_id," not in route_source:
        errors.append("Agent update request must receive the authenticated request actor")
    request_source = route_source[request_start:mutation_start]
    if "tenant=tenant," not in request_source:
        errors.append("Agent update lookup must use the resolved request tenant")
    mutation_source = route_source[mutation_start:]
    expected_call = "agent_id,\n                payload,\n                user_id,\n                tenant=tenant,"
    if expected_call not in mutation_source:
        errors.append("Agent update mutation must receive the resolved actor and tenant")

    composition_start = main_source.index("def _platform_agent_service()")
    composition_end = main_source.index(
        "def _raise_platform_agent_service_error(",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=build_audit_event_write_repository()" not in composition_source:
        errors.append("production Agent service must inject the audit event writer")
    if "check_phase6_agent_update_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the Agent update audit check")
    return errors


def main() -> int:
    errors = check_update_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-agent-update-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-update-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
