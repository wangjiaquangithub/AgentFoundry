#!/usr/bin/env python3
"""Validate authenticated actor audit evidence for Agent run clears."""

from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.agent_runs import (  # noqa: E402
    PlatformAgentRunService,
    PlatformAgentRunServiceError,
)


class AgentRunRepository:
    def __init__(self, *, deleted_count: int = 2) -> None:
        self.deleted_count = deleted_count
        self.filters = None

    def delete(self, **filters):
        self.filters = filters
        return self.deleted_count


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
    repository: AgentRunRepository,
    writer: AuditEventWriter,
) -> PlatformAgentRunService:
    return PlatformAgentRunService(
        repository=repository,
        audit_event_writer=writer,
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def check_clear_audit_contract() -> list[str]:
    repository = AgentRunRepository()
    writer = AuditEventWriter()
    service = build_service(repository, writer)
    result = service.clear_runs(
        actor_user_id="acme:admin",
        tenant="acme",
        user_id="acme:alice",
        session_id="session-1",
    )

    errors: list[str] = []
    if result != {"deleted_count": 2}:
        errors.append("clear result must return the repository deleted count")
    expected_filters = {
        "agent_id": None,
        "tenant": "acme",
        "user_id": "acme:alice",
        "session_id": "session-1",
    }
    if repository.filters != expected_filters:
        errors.append("clear must preserve tenant-scoped repository filters")
    if len(writer.records) != 1:
        return errors + ["clear must append exactly one audit event"]

    event = writer.records[0]
    expected_fields = {
        "tenant_id": "acme",
        "actor_user_id": "acme:admin",
        "event_type": "agent_run.cleared",
        "target_type": "agent_run_collection",
        "target_id": "acme",
        "created_at": "2026-07-23T00:00:00+00:00",
    }
    for field, expected in expected_fields.items():
        if getattr(event, field) != expected:
            errors.append(f"audit {field} must equal {expected!r}")

    expected_payload = {
        "schema_version": 1,
        "tenant": "acme",
        "filters": {
            "user_id": "acme:alice",
            "session_id": "session-1",
        },
        "deleted_count": 2,
    }
    if event.payload != expected_payload:
        errors.append("audit payload must contain only clear command evidence")
    return errors


def check_audit_fail_closed() -> list[str]:
    errors: list[str] = []
    service = build_service(
        AgentRunRepository(),
        AuditEventWriter(failure=RuntimeError("audit unavailable")),
    )
    try:
        service.clear_runs(actor_user_id="acme:admin", tenant="acme")
    except PlatformAgentRunServiceError as exc:
        if exc.status_code != 500:
            errors.append("audit failure must surface as HTTP 500")
    else:
        errors.append("audit failure must fail closed")

    blank_id_writer = AuditEventWriter()
    original_append = blank_id_writer.append_audit_event

    def append_without_id(record):
        return replace(original_append(record), id="")

    blank_id_writer.append_audit_event = append_without_id
    try:
        build_service(AgentRunRepository(), blank_id_writer).clear_runs(
            actor_user_id="acme:admin",
            tenant="acme",
        )
    except PlatformAgentRunServiceError as exc:
        if exc.status_code != 500:
            errors.append("blank audit id must surface as HTTP 500")
    else:
        errors.append("blank audit id must fail closed")
    return errors


def check_route_and_gate() -> list[str]:
    source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    route_start = source.index(
        '    @router.delete("/enterprise/platform/agent/runs")'
    )
    route = source[route_start : source.index("    return router", route_start)]
    if "identity = get_request_identity(request)" not in route:
        errors.append("clear route must resolve the canonical request identity")
    if 'actor_user_id=identity.user_id or "",' not in route:
        errors.append("clear route must pass the authenticated actor to the service")
    if "check_phase6_agent_run_clear_actor_audit.py" not in gate:
        errors.append("Phase 6 backend gate must run this check")
    return errors


def main() -> int:
    errors = (
        check_clear_audit_contract()
        + check_audit_fail_closed()
        + check_route_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-clear-actor-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-clear-actor-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
