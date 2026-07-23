#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for platform Agent archives."""

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


def check_archive_audit_contract() -> list[str]:
    audit_writer = AuditEventWriter()
    service = build_service(audit_writer=audit_writer)
    response = service.archive_agent_response_payload(
        "agent_acme",
        user_id="acme:alice",
        tenant="acme",
    )

    errors: list[str] = []
    archived_agent = response["agent"]
    if archived_agent["tenant"] != "acme":
        errors.append("Agent archive must persist within the request tenant")
    if archived_agent["status"] != "archived":
        errors.append("Agent archive must persist the archived status")
    if archived_agent["created_by"] != "acme:system":
        errors.append("Agent archive must preserve the original creator")
    acme_agents = service.list_agents(tenant="acme")
    if len(acme_agents) != 1 or service.response(acme_agents[0]) != archived_agent:
        errors.append("Agent archive must preserve the request-tenant registry record")
    globex_agents = service.list_agents(tenant="globex")
    if globex_agents != [build_agent("agent_globex", "globex")]:
        errors.append("Agent archive must preserve other tenant records")
    if len(audit_writer.records) != 1:
        return errors + ["Agent archive must append exactly one audit event"]

    event = audit_writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:alice",
        "event_type": "platform_agent.archived",
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
        "agent_id": "agent_acme",
        "tenant": "acme",
        "template_id": "knowledge-assistant",
        "name": "acme Knowledge Assistant",
        "status": "archived",
        "tool_names": ["enterprise_search"],
        "knowledge_base_ids": ["kb_support"],
        "memory_enabled": True,
        "workflow_enabled": True,
        "model_config_id": "model_primary",
        "allowed_user_count": 0,
        "allowed_role_count": 0,
        "updated_by": "acme:alice",
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain the normalized Agent archive evidence")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    failing_service = build_service(
        audit_writer=AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        failing_service.archive_agent_response_payload(
            "agent_acme",
            user_id="acme:alice",
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
        build_service(audit_writer=blank_id_writer).archive_agent_response_payload(
            "agent_acme",
            user_id="acme:alice",
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
        '    @router.delete("/enterprise/platform/agents/{agent_id}")',
    )
    route_end = api_source.index("    return router", route_start)
    route_source = api_source[route_start:route_end]
    identity_start = route_source.index("identity = get_request_identity(request)")
    tenant_start = route_source.index("tenant = _request_tenant(")
    service_start = route_source.index("agent_service = deps.agent_service()")
    mutation_start = route_source.index(
        "return agent_service.archive_agent_response_payload(",
    )
    if not identity_start < tenant_start < service_start < mutation_start:
        errors.append("Agent archive must resolve identity and tenant before mutation")
    mutation_source = route_source[mutation_start:]
    expected_call = (
        "agent_id,\n"
        "                user_id=identity.user_id,\n"
        "                tenant=tenant,"
    )
    if expected_call not in mutation_source:
        errors.append("Agent archive mutation must receive the authenticated actor and tenant")

    composition_start = main_source.index("def _platform_agent_service()")
    composition_end = main_source.index(
        "def _raise_platform_agent_service_error(",
        composition_start,
    )
    composition_source = main_source[composition_start:composition_end]
    if "audit_event_writer=audit_event_write_repository" not in composition_source:
        errors.append("production Agent service must inject the audit event writer")
    if "check_phase6_agent_archive_actor_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the Agent archive audit check")
    return errors


def main() -> int:
    errors = check_archive_audit_contract()
    errors += check_audit_fail_closed()
    errors += check_route_composition_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-agent-archive-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-archive-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
