#!/usr/bin/env python3
"""Check workflow template audit events align with the PG template tenant."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from backend.persistence import AuditEventRecord
from backend.services.workflows import PlatformWorkflowTemplateService


class MemoryWorkflowTemplateRepository:
    def __init__(self) -> None:
        self.saved: list[dict[str, Any]] = []

    def exists(self) -> bool:
        return bool(self.saved)

    def list(self) -> list[dict[str, Any]]:
        return list(self.saved)

    def save_all(self, workflows: list[dict[str, Any]]) -> None:
        self.saved = [dict(workflow) for workflow in workflows]


class MemoryAuditEventWriter:
    def __init__(self) -> None:
        self.events: list[AuditEventRecord] = []

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        self.events.append(record)
        return record


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def _template() -> dict[str, Any]:
    return {
        "workflow_type": "daily_ops_brief",
        "name": "Daily Ops Brief",
        "description": "Auditable daily operations brief.",
        "enabled": True,
        "default_inputs": {"department": "engineering"},
        "steps": [{"id": "metrics", "tool_name": "enterprise_metrics"}],
    }


def main() -> None:
    audit_writer = MemoryAuditEventWriter()
    service = PlatformWorkflowTemplateService(
        repository=MemoryWorkflowTemplateRepository(),
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-22T00:00:00+00:00",
    )

    service.import_templates_payload([_template()], mode="replace")

    _require(len(audit_writer.events) == 1, "Expected one import audit event.")
    default_event = audit_writer.events[0]
    _require(
        default_event.tenant_id == "acme",
        "Workflow template audit events must use the template tenant.",
    )
    _require(
        default_event.actor_user_id == "acme:alice",
        "Workflow template audit fallback actor must be a seeded tenant user.",
    )

    service.import_templates_payload(
        [_template()],
        mode="merge",
        actor="acme:bob",
    )
    explicit_actor_event = audit_writer.events[-1]
    _require(
        explicit_actor_event.actor_user_id == "acme:bob",
        "Workflow template import audit must preserve an explicit actor.",
    )

    print("phase2 workflow template audit tenant alignment ok")


if __name__ == "__main__":
    main()
