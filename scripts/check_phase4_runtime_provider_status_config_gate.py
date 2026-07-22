#!/usr/bin/env python3
"""Check PostgreSQL runtime provider status exposes the config gate safely."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))


@dataclass(frozen=True)
class ProviderRecord:
    id: str
    name: str
    provider_type: str
    mode: str
    status: str
    capabilities: dict[str, bool]
    config_ref: str | None


class ProviderReader:
    def __init__(self, provider: ProviderRecord) -> None:
        self._provider = provider
        self.calls: list[dict[str, Any]] = []

    def list_providers(
        self,
        *,
        status: str | None = None,
        provider_type: str | None = None,
        limit: int = 50,
    ) -> list[ProviderRecord]:
        self.calls.append(
            {
                "status": status,
                "provider_type": provider_type,
                "limit": limit,
            },
        )
        if status is not None and self._provider.status != status:
            return []
        if (
            provider_type is not None
            and self._provider.provider_type != provider_type
        ):
            return []
        return [self._provider][:limit]


class FailingProviderReader:
    def list_providers(
        self,
        *,
        status: str | None = None,
        provider_type: str | None = None,
        limit: int = 50,
    ) -> list[ProviderRecord]:
        raise RuntimeError(
            f"database password leaked for {status}/{provider_type}/{limit}",
        )


def _build_status_service(
    provider: ProviderRecord,
    *,
    provider_reader: Any | None = None,
) -> Any:
    from runtime import describe_runtime_provider_health
    from services.platform_status import PlatformStatusService

    return PlatformStatusService(
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
        runtime_provider_reader=provider_reader or ProviderReader(provider),
    )


def _runtime_provider_snapshot(provider: ProviderRecord) -> dict[str, Any]:
    status_service = _build_status_service(provider)
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
        raise AssertionError(f"runtime_provider must be a dict: {payload}")
    return runtime_provider


def _assert_pg_provider_query_is_agentscope_scoped() -> None:
    provider = ProviderRecord(
        id="agentscope-platform-adapter",
        name="AgentScope Platform Adapter",
        provider_type="agentscope",
        mode="local-service",
        status="active",
        capabilities={"tenant_context": True, "tool_routing": True},
        config_ref=None,
    )
    provider_reader = ProviderReader(provider)
    status_service = _build_status_service(provider, provider_reader=provider_reader)
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

    if not isinstance(payload.get("runtime_provider"), dict):
        raise AssertionError(f"runtime provider snapshot missing: {payload}")
    if not provider_reader.calls:
        raise AssertionError("runtime provider reader was not called")
    last_call = provider_reader.calls[-1]
    expected_call = {
        "status": "active",
        "provider_type": "agentscope",
        "limit": 1,
    }
    if last_call != expected_call:
        raise AssertionError(
            "runtime provider query must load one active AgentScope provider: "
            f"{provider_reader.calls}",
        )


def _assert_pg_provider_read_error_is_observable() -> None:
    provider = ProviderRecord(
        id="agentscope-platform-adapter",
        name="AgentScope Platform Adapter",
        provider_type="agentscope",
        mode="local-service",
        status="active",
        capabilities={"tenant_context": True, "tool_routing": True},
        config_ref=None,
    )
    status_service = _build_status_service(
        provider,
        provider_reader=FailingProviderReader(),
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
        raise AssertionError(f"runtime provider snapshot missing: {payload}")
    checks = runtime_provider.get("checks")
    if not isinstance(checks, dict):
        raise AssertionError(f"runtime provider checks missing: {runtime_provider}")
    if checks.get("postgres_runtime_provider_record") is not False:
        raise AssertionError(f"PG record read failure must be visible: {runtime_provider}")
    if checks.get("postgres_runtime_provider_read_error") is not True:
        raise AssertionError(f"PG read error check missing: {runtime_provider}")
    if "database password leaked" in repr(runtime_provider):
        raise AssertionError("runtime provider status must not expose PG error details")


def _assert_pg_provider_missing_record_is_observable() -> None:
    provider = ProviderRecord(
        id="openai-runtime",
        name="OpenAI Runtime",
        provider_type="openai",
        mode="remote",
        status="active",
        capabilities={"tenant_context": True},
        config_ref=None,
    )
    runtime_provider = _runtime_provider_snapshot(provider)

    checks = runtime_provider.get("checks")
    if not isinstance(checks, dict):
        raise AssertionError(f"runtime provider checks missing: {runtime_provider}")
    if checks.get("postgres_runtime_provider_record") is not False:
        raise AssertionError(f"missing PG agentscope record must be visible: {runtime_provider}")
    if checks.get("postgres_runtime_provider_missing") is not True:
        raise AssertionError(f"missing PG provider check missing: {runtime_provider}")
    if runtime_provider.get("provider") != "agentscope":
        raise AssertionError(
            f"missing PG record should fall back to adapter health only: {runtime_provider}",
        )


def _assert_pg_provider_config_ref_gate() -> None:
    secret_ref = "secret://agentscope/runtime-token"
    runtime_provider = _runtime_provider_snapshot(
        ProviderRecord(
            id="agentscope-platform-adapter",
            name="AgentScope Platform Adapter",
            provider_type="agentscope",
            mode="local-service",
            status="active",
            capabilities={"tenant_context": True, "tool_routing": True},
            config_ref=secret_ref,
        ),
    )

    checks = runtime_provider.get("checks")
    if not isinstance(checks, dict):
        raise AssertionError(f"runtime provider checks missing: {runtime_provider}")
    gate = runtime_provider.get("provider_native_invocation")
    if not isinstance(gate, dict):
        raise AssertionError(f"provider native gate missing: {runtime_provider}")

    expected_checks = {
        "postgres_runtime_provider_record": True,
        "provider_native_config_ready": False,
        "provider_invocation_wired": False,
    }
    for key, expected in expected_checks.items():
        if checks.get(key) is not expected:
            raise AssertionError(f"{key} should be {expected}: {runtime_provider}")

    if runtime_provider.get("provider_id") != "agentscope-platform-adapter":
        raise AssertionError(f"provider id mismatch: {runtime_provider}")
    if runtime_provider.get("provider") != "agentscope":
        raise AssertionError(f"provider type mismatch: {runtime_provider}")
    if gate.get("id") != "agentscope_provider_native_invocation_config":
        raise AssertionError(f"provider native gate id mismatch: {gate}")
    if gate.get("configured_keys") != ["agentscope_runtime_auth_ref"]:
        raise AssertionError(f"configured keys should not expose values: {gate}")
    if gate.get("missing_keys") != ["agentscope_runtime_url"]:
        raise AssertionError(f"missing keys mismatch: {gate}")
    if secret_ref in repr(runtime_provider):
        raise AssertionError("runtime provider status must not expose config_ref value")


def _assert_pg_provider_config_ref_not_passed_to_gate() -> None:
    import services.platform_status as platform_status

    secret_ref = "secret://agentscope/runtime-token"
    captured_metadata: dict[str, Any] | None = None
    original_gate = platform_status.describe_provider_native_invocation_config_gate

    def capture_gate(agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        nonlocal captured_metadata
        captured_metadata = agent_metadata
        return original_gate(agent_metadata)

    platform_status.describe_provider_native_invocation_config_gate = capture_gate
    try:
        gate = platform_status.PlatformStatusService._runtime_provider_native_invocation(
            ProviderRecord(
                id="agentscope-platform-adapter",
                name="AgentScope Platform Adapter",
                provider_type="agentscope",
                mode="local-service",
                status="active",
                capabilities={"tenant_context": True, "tool_routing": True},
                config_ref=secret_ref,
            ),
        )
    finally:
        platform_status.describe_provider_native_invocation_config_gate = original_gate

    if gate.get("configured_keys") != ["agentscope_runtime_auth_ref"]:
        raise AssertionError(f"config ref should mark auth ref configured: {gate}")
    if captured_metadata is None:
        raise AssertionError("runtime provider gate metadata was not captured")
    if secret_ref in repr(captured_metadata):
        raise AssertionError("config_ref value must not be passed into runtime gate")
    config = captured_metadata.get("runtime_provider_config")
    if not isinstance(config, dict):
        raise AssertionError(f"runtime provider config metadata missing: {captured_metadata}")
    if config.get("agentscope_runtime_auth_ref") != "<configured>":
        raise AssertionError(
            f"runtime provider gate should receive only configured sentinel: {config}",
        )


def _assert_pg_provider_without_config_ref_gate() -> None:
    runtime_provider = _runtime_provider_snapshot(
        ProviderRecord(
            id="agentscope-platform-adapter",
            name="AgentScope Platform Adapter",
            provider_type="agentscope",
            mode="local-service",
            status="active",
            capabilities={"tenant_context": True, "tool_routing": True},
            config_ref=None,
        ),
    )

    gate = runtime_provider.get("provider_native_invocation")
    if not isinstance(gate, dict):
        raise AssertionError(f"provider native gate missing: {runtime_provider}")
    if gate.get("configured_keys") != []:
        raise AssertionError(f"configured keys should be empty: {gate}")
    if gate.get("missing_keys") != [
        "agentscope_runtime_url",
        "agentscope_runtime_auth_ref",
    ]:
        raise AssertionError(f"missing keys mismatch: {gate}")


def main() -> int:
    _assert_pg_provider_query_is_agentscope_scoped()
    _assert_pg_provider_read_error_is_observable()
    _assert_pg_provider_missing_record_is_observable()
    _assert_pg_provider_config_ref_gate()
    _assert_pg_provider_config_ref_not_passed_to_gate()
    _assert_pg_provider_without_config_ref_gate()
    print("Phase 4 runtime provider status config gate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
