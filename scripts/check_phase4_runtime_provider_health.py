#!/usr/bin/env python3
"""Validate the phase 4 runtime provider health contract."""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


EXPECTED_CAPABILITIES = {
    "tenant_context",
    "tool_routing",
    "approval_gate",
    "knowledge_retrieval",
    "long_term_memory",
    "run_evidence",
}


def _assert_no_direct_agentscope_import(path: Path) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported_names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            imported_names = [node.module or ""]
        else:
            continue

        direct_imports = [
            name for name in imported_names if name == "agentscope" or name.startswith("agentscope.")
        ]
        if direct_imports:
            raise AssertionError(f"{path} imports AgentScope directly: {direct_imports}")


def _assert_health_payload(payload: dict[str, Any], label: str) -> None:
    required_fields = {
        "provider_id",
        "provider",
        "mode",
        "status",
        "ready",
        "message",
        "capabilities",
        "checks",
    }
    missing_fields = required_fields - payload.keys()
    if missing_fields:
        raise AssertionError(f"{label} missing fields: {sorted(missing_fields)}")

    expected_values = {
        "provider_id": "agentscope-platform-adapter",
        "provider": "agentscope",
        "mode": "local-service",
        "status": "degraded",
        "ready": False,
    }
    for field, expected in expected_values.items():
        if payload.get(field) != expected:
            raise AssertionError(
                f"{label} {field} mismatch: expected {expected!r}, got {payload.get(field)!r}",
            )

    capabilities = payload.get("capabilities")
    if not isinstance(capabilities, list) or not EXPECTED_CAPABILITIES.issubset(
        set(capabilities),
    ):
        raise AssertionError(f"{label} capabilities mismatch: {payload}")

    checks = payload.get("checks")
    if not isinstance(checks, dict):
        raise AssertionError(f"{label} checks must be an object: {payload}")
    if checks.get("adapter_configured") is not True:
        raise AssertionError(f"{label} adapter_configured check must be true: {payload}")
    if checks.get("provider_invocation_wired") is not False:
        raise AssertionError(
            f"{label} must not claim provider invocation is wired: {payload}",
        )
    if checks.get("direct_agentscope_dependency") is not False:
        raise AssertionError(
            f"{label} must not expose a direct AgentScope dependency: {payload}",
        )

    message = payload.get("message")
    if not isinstance(message, str) or "pending" not in message:
        raise AssertionError(f"{label} should explain pending invocation extraction: {payload}")


def main() -> None:
    _assert_no_direct_agentscope_import(BACKEND_DIR / "runtime.py")
    _assert_no_direct_agentscope_import(BACKEND_DIR / "services" / "platform_status.py")

    from runtime import describe_runtime_provider_health

    _assert_health_payload(
        describe_runtime_provider_health(),
        "runtime provider health",
    )

    from services.platform_status import PlatformStatusService

    status_service = PlatformStatusService(
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
        audit_event_reader=None,
        retrieval_event_reader=None,
        tool_policy=SimpleNamespace(
            mode="audit",
            describe_for_user=lambda _tenant, _user_id, _tools: [],
        ),
        connector_health=lambda: {"status": "ok"},
        runtime_provider_health=describe_runtime_provider_health,
        agent_readiness=lambda _agent: {"ready": True},
        enterprise_tool_names=[],
        enterprise_tool_catalog={},
        approval_required_tools=set(),
        approval_required_workflows=set(),
    )
    payload = status_service.platform_snapshot(
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
    runtime_provider = payload.get("runtime_provider")
    if not isinstance(runtime_provider, dict):
        raise AssertionError(f"platform status missing runtime_provider: {payload}")
    _assert_health_payload(runtime_provider, "platform status runtime_provider")

    print("Phase 4 runtime provider health contract passed.")


if __name__ == "__main__":
    main()
