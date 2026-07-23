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
        self.saved: dict[str, list[dict[str, Any]]] = {}
        self.created_by: dict[str, str] = {}

    def exists(self, *, tenant: str) -> bool:
        return bool(self.saved.get(tenant))

    def list(self, *, tenant: str) -> list[dict[str, Any]]:
        return [dict(workflow) for workflow in self.saved.get(tenant, [])]

    def save_all(
        self,
        workflows: list[dict[str, Any]],
        *,
        tenant: str,
        created_by: str,
    ) -> None:
        self.saved[tenant] = [dict(workflow) for workflow in workflows]
        self.created_by[tenant] = created_by


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
    repository = MemoryWorkflowTemplateRepository()
    service = PlatformWorkflowTemplateService(
        repository=repository,
        audit_event_writer=audit_writer,
        now=lambda: "2026-07-22T00:00:00+00:00",
    )

    service.import_templates_payload(
        [_template()],
        mode="replace",
        tenant="acme",
    )

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
        [{**_template(), "name": "Globex Daily Ops Brief"}],
        mode="replace",
        tenant="globex",
        actor="globex:bob",
    )
    explicit_actor_event = audit_writer.events[-1]
    _require(
        explicit_actor_event.tenant_id == "globex",
        "Workflow template import audit must use the request tenant.",
    )
    _require(
        explicit_actor_event.actor_user_id == "globex:bob",
        "Workflow template import audit must preserve an explicit actor.",
    )
    _require(
        repository.created_by == {
            "acme": "acme:alice",
            "globex": "globex:bob",
        },
        "Workflow template writes must preserve tenant-specific actors.",
    )
    _require(
        service.list_templates(tenant="acme")[0]["name"] == "Daily Ops Brief",
        "Acme workflow templates must not be overwritten by another tenant.",
    )
    _require(
        service.list_templates(tenant="globex", actor="globex:bob")[0]["name"]
        == "Globex Daily Ops Brief",
        "Globex workflow templates must remain isolated from Acme.",
    )

    print("phase2 workflow template audit tenant alignment ok")


if __name__ == "__main__":
    main()
