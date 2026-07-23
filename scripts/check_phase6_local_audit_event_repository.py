#!/usr/bin/env python3
"""Validate the local JSONL audit repository contract."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.audit_events import (  # noqa: E402
    AuditEventRecord,
    JsonlAuditEventRepository,
)


def event(
    event_id: str,
    *,
    tenant_id: str = "acme",
    actor_user_id: str = "alice",
    event_type: str = "agent.run.completed",
    target_type: str = "agent_run",
    target_id: str = "run-1",
    created_at: str = "2026-07-23T00:00:00+00:00",
) -> AuditEventRecord:
    return AuditEventRecord(
        id=event_id,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        target_type=target_type,
        target_id=target_id,
        payload={"event_id": event_id},
        created_at=created_at,
    )


def check_persistence_idempotency_and_conflicts() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        path = Path(temp_dir) / "audit" / "events.jsonl"
        repository = JsonlAuditEventRepository(path)
        original = event("event-1")
        if repository.append_audit_event(original) != original:
            errors.append("JSONL append must return the persisted audit event")

        reloaded = JsonlAuditEventRepository(path)
        if reloaded.get_audit_event(
            tenant_id="acme", audit_event_id="event-1"
        ) != original:
            errors.append("JSONL audit events must survive repository reloads")
        if reloaded.append_audit_event(original) != original:
            errors.append("duplicate identical audit event ids must be idempotent")
        if len(path.read_text(encoding="utf-8").splitlines()) != 1:
            errors.append("idempotent audit event appends must not duplicate JSONL rows")

        conflicts = (
            event("event-1", event_type="agent.run.failed"),
            event("event-1", created_at="2026-07-23T00:00:01+00:00"),
        )
        for conflict in conflicts:
            try:
                reloaded.append_audit_event(conflict)
            except ValueError:
                continue
            errors.append("duplicate audit event ids with conflicting content must fail")
    return errors


def check_scoping_filtering_sorting_and_limit() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as temp_dir:
        repository = JsonlAuditEventRepository(Path(temp_dir) / "events.jsonl")
        records = (
            event("event-a", created_at="2026-07-23T00:00:00+00:00"),
            event(
                "event-c",
                actor_user_id="bob",
                event_type="approval.decided",
                target_type="approval",
                target_id="approval-1",
                created_at="2026-07-23T00:00:01+00:00",
            ),
            event(
                "event-b",
                actor_user_id="bob",
                event_type="approval.decided",
                target_type="approval",
                target_id="approval-1",
                created_at="2026-07-23T00:00:01+00:00",
            ),
            event("other-tenant", tenant_id="other"),
        )
        for record in records:
            repository.append_audit_event(record)

        visible = repository.list_audit_events(tenant_id="acme")
        if [record.id for record in visible] != ["event-c", "event-b", "event-a"]:
            errors.append("JSONL list must isolate tenants and sort by created_at then id")
        filtered = repository.list_audit_events(
            tenant_id="acme",
            event_type="approval.decided",
            actor_user_id="bob",
            target_type="approval",
            target_id="approval-1",
        )
        if [record.id for record in filtered] != ["event-c", "event-b"]:
            errors.append("JSONL list must apply event, actor, and target filters")
        targeted = repository.list_for_target(
            tenant_id="acme", target_type="approval", target_id="approval-1"
        )
        if [record.id for record in targeted] != ["event-c", "event-b"]:
            errors.append("JSONL target lookup must preserve tenant-scoped filtering")
        if repository.get_audit_event(
            tenant_id="other", audit_event_id="event-a"
        ) is not None:
            errors.append("JSONL get must not expose audit events across tenants")
        if len(repository.list_audit_events(tenant_id="acme", limit=2)) != 2:
            errors.append("JSONL list must enforce the requested result limit")
        if len(repository.list_audit_events(tenant_id="acme", limit=0)) != 1:
            errors.append("JSONL list must clamp non-positive limits to one result")
    return errors


def check_corrupt_jsonl_fails_closed() -> list[str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        path = Path(temp_dir) / "events.jsonl"
        path.write_text('{"id":"broken"}\n', encoding="utf-8")
        try:
            JsonlAuditEventRepository(path).list_audit_events(tenant_id="acme")
        except ValueError as exc:
            if str(exc) == "Invalid audit event JSONL at line 1.":
                return []
            return ["corrupt JSONL errors must identify the invalid line"]
    return ["corrupt audit event JSONL must fail closed"]


def check_phase6_gate_wires_check() -> list[str]:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_local_audit_event_repository.py" not in source:
        return ["Phase 6 backend gate must run the local audit repository check"]
    return []


def main() -> int:
    errors: list[str] = []
    errors.extend(check_persistence_idempotency_and_conflicts())
    errors.extend(check_scoping_filtering_sorting_and_limit())
    errors.extend(check_corrupt_jsonl_fails_closed())
    errors.extend(check_phase6_gate_wires_check())
    if errors:
        for error in errors:
            print(f"[phase6-local-audit-repository] {error}", file=sys.stderr)
        return 1
    print("[phase6-local-audit-repository] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
