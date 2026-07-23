#!/usr/bin/env python3
"""Check that platform retrieval reads are PostgreSQL authoritative in production."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from backend.services.platform_status import PlatformStatusService


class FailingRetrievalEventReader:
    def list_retrieval_events(
        self,
        *,
        tenant_id: str,
        agent_run_id: str | None = None,
        knowledge_base_id: str | None = None,
        limit: int = 50,
    ) -> list[Any]:
        raise RuntimeError("database unavailable")


def _service(
    *,
    production_mode: bool,
    retrieval_event_reader: Any | None = None,
) -> PlatformStatusService:
    audit_logger = SimpleNamespace(
        path=ROOT / "backend" / "data" / "audit.jsonl",
        enabled=True,
        query=lambda **_: [],
        recent=lambda **_: [],
    )
    return PlatformStatusService(
        list_approval_records=lambda **_: [],
        load_workflow_runs=lambda **_: [],
        load_workflow_templates=lambda **_kwargs: [],
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
        audit_event_reader=SimpleNamespace(list_audit_events=lambda **_: []),
        retrieval_event_reader=retrieval_event_reader,
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
    return _expect_runtime_error(
        "platform retrieval query without PostgreSQL reader",
        lambda: service._query_retrieval_events(tenant="acme", limit=10),
        "PostgreSQL platform retrieval event reader is required in production mode",
    )


def _check_production_reader_failure_fails_closed() -> list[str]:
    service = _service(
        production_mode=True,
        retrieval_event_reader=FailingRetrievalEventReader(),
    )
    return _expect_runtime_error(
        "platform retrieval PostgreSQL read failure",
        lambda: service._query_retrieval_events(tenant="acme", limit=10),
        "PostgreSQL platform retrieval event read failed in production mode",
    )


def _check_development_empty_read_remains_available() -> list[str]:
    service = _service(production_mode=False)
    events = service._query_retrieval_events(tenant="acme", limit=10)
    if events != []:
        return ["development platform retrieval query must retain empty compatibility"]
    return []


def main() -> int:
    errors = [
        *_check_production_missing_reader_fails_closed(),
        *_check_production_reader_failure_fails_closed(),
        *_check_development_empty_read_remains_available(),
    ]

    print("Phase 2 PostgreSQL platform retrieval read authority gate")
    print("- production reader dependency: required for tenant-scoped reads")
    print("- production read failure: fail closed")
    print("- development empty read compatibility: retained")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: platform retrieval reads are PostgreSQL-authoritative in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
