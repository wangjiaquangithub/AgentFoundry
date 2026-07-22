#!/usr/bin/env python3
"""Check that platform status exposes PostgreSQL-first data-layer status."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(ROOT))


def _build_snapshot(database_config_status: Any) -> dict[str, Any]:
    from services.platform_status import PlatformStatusService

    service = PlatformStatusService(
        list_approval_records=lambda **_kwargs: [],
        load_workflow_runs=lambda **_kwargs: [],
        load_workflow_templates=lambda: [],
        load_agents=lambda: [],
        load_memories=lambda **_kwargs: [],
        runtime_context=lambda _user_id: {
            "tenant": "acme",
            "connector_label": "Acme Enterprise Gateway",
            "connector_source": "saved_config",
            "saved_config_enabled": True,
        },
        identity_metadata=lambda _user_id, tenant: [
            {"user_id": "acme:alice", "tenant": tenant, "role": "admin"},
        ],
        tenant_workspaces=lambda **_kwargs: {"acme": {"tenant": "acme"}},
        agent_run_repository=SimpleNamespace(
            list=lambda **_kwargs: [],
            list_runs=lambda **_kwargs: [],
        ),
        audit_logger=SimpleNamespace(
            path=BACKEND_DIR / "data" / "audit",
            enabled=True,
            recent=lambda limit=12: [],
            query=lambda **_kwargs: [],
        ),
        audit_event_reader=SimpleNamespace(list_audit_events=lambda **_kwargs: []),
        retrieval_event_reader=None,
        tool_policy=SimpleNamespace(
            mode="audit",
            describe_for_user=lambda _tenant, _user_id, _tools: [],
        ),
        connector_health=lambda: {"status": "ok"},
        runtime_provider_health=lambda: {
            "provider": "local",
            "mode": "adapter",
            "status": "pending",
            "ready": False,
            "message": "Runtime provider invocation wiring is pending.",
            "checks": {
                "adapter_configured": True,
                "provider_invocation_wired": False,
                "direct_agentscope_dependency": False,
            },
        },
        agent_readiness=lambda _agent: {"status": "ready", "issues": []},
        enterprise_tool_names=[],
        enterprise_tool_catalog={},
        approval_required_tools=set(),
        approval_required_workflows=set(),
        database_config_status=database_config_status,
    )

    return service.platform_snapshot(
        platform_version="contract-test",
        data_dir=BACKEND_DIR / "data",
        runtime={
            "tenant": "acme",
            "connector_label": "Acme Enterprise Gateway",
            "connector_source": "saved_config",
            "saved_config_enabled": True,
        },
        tenant="acme",
        user_id="acme:alice",
        identities=[{"user_id": "acme:alice", "tenant": "acme", "role": "admin"}],
        tenant_workspaces={"acme": {"tenant": "acme"}},
        subagent_templates=[],
    )


def _database_status(payload: dict[str, Any]) -> dict[str, Any]:
    storage = payload.get("storage")
    if not isinstance(storage, dict):
        raise AssertionError(f"platform status missing storage payload: {payload}")
    database = storage.get("database")
    if not isinstance(database, dict):
        raise AssertionError(f"platform status missing storage.database: {payload}")
    return database


def _assert_no_secret_leak(database: dict[str, Any]) -> None:
    rendered = repr(database)
    leaked_fragments = (
        "secret",
        "agentfoundry:agentfoundry",
        "agentfoundry:secret",
        "localhost:5432",
        "mysql://",
        "postgresql://agentfoundry",
        "sqlite:////tmp",
    )
    leaked = [fragment for fragment in leaked_fragments if fragment in rendered]
    if leaked:
        raise AssertionError(f"database status must not expose credentials: {database}")


def main() -> int:
    from backend.persistence import inspect_configured_database_status

    cases = (
        (
            "unconfigured",
            lambda: inspect_configured_database_status({}),
            "unconfigured",
            False,
        ),
        (
            "postgresql",
            lambda: inspect_configured_database_status(
                {
                    "AGENTFOUNDRY_DATABASE_URL": (
                        "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
                    )
                },
            ),
            "postgresql",
            True,
        ),
        (
            "sqlite",
            lambda: inspect_configured_database_status(
                {"AGENTFOUNDRY_DATABASE_URL": "sqlite:////tmp/agentfoundry-local-dev.db"},
            ),
            "sqlite",
            False,
        ),
        (
            "unsupported",
            lambda: inspect_configured_database_status(
                {"AGENTFOUNDRY_DATABASE_URL": "mysql://agentfoundry:secret@localhost/db"},
            ),
            "unsupported",
            False,
        ),
        (
            "spoofed_sqlite_operator_ready",
            lambda: {
                "env_var": "AGENTFOUNDRY_DATABASE_URL",
                "deployment_env_var": "AGENTFOUNDRY_ENV",
                "production_mode": True,
                "configured": True,
                "scheme": "sqlite",
                "backend": "sqlite",
                "required_backend": "postgresql",
                "production_ready": True,
                "driver_package": None,
                "driver_available": False,
                "runtime_ready": True,
                "operator_ready": True,
                "message": "sqlite:// is only for explicit local development compatibility.",
            },
            "sqlite",
            False,
        ),
    )

    for label, status_factory, expected_backend, expected_ready in cases:
        database = _database_status(_build_snapshot(status_factory))
        if database.get("backend") != expected_backend:
            raise AssertionError(
                f"{label} backend should be {expected_backend}: {database}",
            )
        if database.get("required_backend") != "postgresql":
            raise AssertionError(
                f"{label} should expose PostgreSQL as required backend: {database}",
            )
        if database.get("production_ready") is not expected_ready:
            raise AssertionError(
                f"{label} production_ready should be {expected_ready}: {database}",
            )
        if not isinstance(database.get("operator_ready"), bool):
            raise AssertionError(f"{label} should expose boolean operator_ready: {database}")
        if not isinstance(database.get("runtime_ready"), bool):
            raise AssertionError(f"{label} should expose boolean runtime_ready: {database}")
        if not isinstance(database.get("driver_available"), bool):
            raise AssertionError(f"{label} should expose boolean driver_available: {database}")
        checks = database.get("checks")
        if not isinstance(checks, dict):
            raise AssertionError(f"{label} should expose database readiness checks: {database}")
        expected_checks = {
            "configured",
            "postgresql_backend",
            "production_database_backend",
            "driver_available",
            "runtime_ready",
            "production_mode",
            "production_system_of_record",
            "local_compatibility_only",
        }
        missing_checks = expected_checks.difference(checks)
        if missing_checks:
            raise AssertionError(
                f"{label} database checks missing {sorted(missing_checks)}: {database}",
            )
        non_boolean_checks = [
            key
            for key in expected_checks
            if not isinstance(checks.get(key), bool)
        ]
        if non_boolean_checks:
            raise AssertionError(
                f"{label} database checks must be booleans: {database}",
            )
        if database.get("env_var") != "AGENTFOUNDRY_DATABASE_URL":
            raise AssertionError(f"{label} should expose the config env var: {database}")
        if expected_backend == "postgresql":
            if database.get("driver_package") != "psycopg":
                raise AssertionError(
                    f"{label} should expose psycopg as the PostgreSQL driver: {database}",
                )
            if database.get("runtime_ready") is not database.get("driver_available"):
                raise AssertionError(
                    f"{label} runtime_ready should follow driver availability: {database}",
                )
            if database.get("operator_ready") is not database.get("runtime_ready"):
                raise AssertionError(
                    f"{label} operator_ready should require runtime readiness: {database}",
                )
            if checks.get("postgresql_backend") is not True:
                raise AssertionError(
                    f"{label} should mark PostgreSQL backend check true: {database}",
                )
            if database.get("production_system_of_record") is not database.get("operator_ready"):
                raise AssertionError(
                    f"{label} production system of record should require operator readiness: {database}",
                )
            expected_boundary = (
                "postgresql_production"
                if database.get("operator_ready")
                else "local_development_compatibility"
            )
            if database.get("storage_boundary") != expected_boundary:
                raise AssertionError(
                    f"{label} storage_boundary should be {expected_boundary}: {database}",
                )
        elif database.get("driver_package") is not None or database.get("driver_available"):
            raise AssertionError(
                f"{label} should not expose a production database driver: {database}",
            )
        else:
            if database.get("operator_ready") is not False:
                raise AssertionError(
                    f"{label} should not be operator-ready without PostgreSQL: {database}",
                )
            if checks.get("postgresql_backend") is not False:
                raise AssertionError(
                    f"{label} should mark PostgreSQL backend check false: {database}",
                )
            if database.get("production_system_of_record") is not False:
                raise AssertionError(
                    f"{label} must not claim production system-of-record status: {database}",
                )
            if database.get("local_compatibility_only") is not True:
                raise AssertionError(
                    f"{label} should be marked local compatibility only: {database}",
                )
            if database.get("storage_boundary") != "local_development_compatibility":
                raise AssertionError(
                    f"{label} should expose local compatibility boundary: {database}",
                )
        _assert_no_secret_leak(database)

    print("Phase 2 platform database status contract passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
