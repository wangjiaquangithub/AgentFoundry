#!/usr/bin/env python3
"""Check that platform audit reads are PostgreSQL authoritative in production."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from backend.services.platform_status import PlatformStatusService


class FailingAuditEventReader:
    def list_audit_events(
        self,
        *,
        tenant_id: str,
        event_type: str | None = None,
        actor_user_id: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        limit: int = 50,
    ) -> list[Any]:
        raise RuntimeError("database unavailable")


def _service(
    *,
    production_mode: bool,
    audit_event_reader: Any | None = None,
) -> PlatformStatusService:
    audit_logger = SimpleNamespace(
        path=ROOT / "backend" / "data" / "audit.jsonl",
        enabled=True,
        query=lambda **_: [{"source": "jsonl_query"}],
        recent=lambda **_: [{"source": "jsonl_recent"}],
    )
    return PlatformStatusService(
        list_approval_records=lambda **_: [],
        load_workflow_runs=lambda **_: [],
        load_workflow_templates=lambda: [],
        load_agents=lambda: [],
        load_memories=lambda **_: [],
        runtime_context=lambda _: {
            "tenant": "acme",
            "connector_label": "Acme",
            "connector_source": "test",
            "saved_config_enabled": False,
        },
        identity_metadata=lambda *_: [],
        tenant_workspaces=lambda **_: {},
        agent_run_repository=None,
        audit_logger=audit_logger,
        audit_event_reader=audit_event_reader,
        retrieval_event_reader=None,
        tool_policy=SimpleNamespace(mode="test", describe_for_user=lambda *_: {}),
        connector_health=lambda: {},
        runtime_provider_health=lambda: {},
        agent_readiness=lambda _: {},
        enterprise_tool_names=[],
        enterprise_tool_catalog={},
        approval_required_tools=set(),
        approval_required_workflows=set(),
        database_config_status=lambda: {
            "production_mode": production_mode,
            "configured": production_mode,
            "backend": "postgresql" if production_mode else "unconfigured",
            "required_backend": "postgresql",
            "production_ready": production_mode,
            "driver_available": production_mode,
            "runtime_ready": production_mode,
            "operator_ready": production_mode,
            "message": "test",
        },
    )


def _expect_runtime_error(label: str, func: Any, fragment: str) -> list[str]:
    try:
        func()
    except RuntimeError as exc:
        if fragment in str(exc):
            return []
        return [f"{label} error must mention {fragment!r}: {exc}"]
    return [f"{label} must fail closed in production mode"]


def _check_production_missing_reader_fails_closed() -> list[str]:
    service = _service(production_mode=True)
    return [
        *_expect_runtime_error(
            "tenant platform audit query without PostgreSQL reader",
            lambda: service._query_audit_events(tenant="acme", limit=10),
            "PostgreSQL platform audit event reader is required in production mode",
        ),
        *_expect_runtime_error(
            "recent platform audit query without PostgreSQL reader",
            lambda: service._recent_audit_events(tenants=["acme"], limit=10),
            "PostgreSQL platform audit event reader is required in production mode",
        ),
    ]


def _check_production_reader_failure_fails_closed() -> list[str]:
    service = _service(
        production_mode=True,
        audit_event_reader=FailingAuditEventReader(),
    )
    return [
        *_expect_runtime_error(
            "tenant platform audit PostgreSQL read failure",
            lambda: service._query_audit_events(tenant="acme", limit=10),
            "PostgreSQL platform audit event read failed in production mode",
        ),
        *_expect_runtime_error(
            "recent platform audit PostgreSQL read failure",
            lambda: service._recent_audit_events(tenants=["acme"], limit=10),
            "PostgreSQL platform audit event read failed in production mode",
        ),
    ]


def _check_development_jsonl_read_remains_available() -> list[str]:
    service = _service(production_mode=False)
    query_events = service._query_audit_events(tenant="acme", limit=10)
    recent_events = service._recent_audit_events(tenants=["acme"], limit=10)
    errors: list[str] = []
    if query_events != [{"source": "jsonl_query"}]:
        errors.append("development platform audit query must retain JSONL fallback")
    if recent_events != [{"source": "jsonl_recent"}]:
        errors.append("development recent platform audit must retain JSONL fallback")
    return errors


def main() -> int:
    errors = [
        *_check_production_missing_reader_fails_closed(),
        *_check_production_reader_failure_fails_closed(),
        *_check_development_jsonl_read_remains_available(),
    ]

    print("Phase 2 PostgreSQL platform audit read authority gate")
    print("- production reader dependency: required for tenant-scoped reads")
    print("- production read failure: fail closed")
    print("- development JSONL read compatibility: retained")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: platform audit reads are PostgreSQL-authoritative in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
