#!/usr/bin/env python3
"""Validate config-driven AgentScope HTTP provider client wiring."""

from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    AGENTSCOPE_PLATFORM_ADAPTER,
    build_runtime_provider_invocation_client,
    describe_runtime_provider_health,
    get_runtime_adapter,
)
from backend.runtime_provider_clients import AgentScopeProviderHttpInvocationClient  # noqa: E402


READY_RUNTIME_CONFIG = {
    "agentscope_runtime_url": "http://agentscope-runtime.internal:18080",
    "agentscope_runtime_auth_ref": "secret://agentscope/runtime-token",
}


def main() -> None:
    default_adapter = get_runtime_adapter()
    if default_adapter is not AGENTSCOPE_PLATFORM_ADAPTER:
        raise AssertionError("default runtime adapter should stay unwired without config")
    if build_runtime_provider_invocation_client() is not None:
        raise AssertionError("provider HTTP client should require ready runtime config")

    default_health = describe_runtime_provider_health()
    if default_health["ready"] is not False:
        raise AssertionError(f"default runtime health should stay degraded: {default_health}")
    if default_health["checks"]["provider_invocation_wired"] is not False:
        raise AssertionError(
            f"default runtime health must not claim provider wiring: {default_health}",
        )

    metadata = {"runtime_provider_config": READY_RUNTIME_CONFIG}
    provider_client = build_runtime_provider_invocation_client(metadata)
    if not isinstance(provider_client, AgentScopeProviderHttpInvocationClient):
        raise AssertionError(
            "ready runtime config should build the AgentScope HTTP provider client",
        )

    configured_adapter = get_runtime_adapter(metadata)
    if configured_adapter is AGENTSCOPE_PLATFORM_ADAPTER:
        raise AssertionError("configured runtime adapter should be an isolated instance")
    if not isinstance(
        configured_adapter.provider_client,
        AgentScopeProviderHttpInvocationClient,
    ):
        raise AssertionError("get_runtime_adapter should wire the config-built client")

    configured_health = describe_runtime_provider_health(metadata)
    if configured_health["ready"] is not True:
        raise AssertionError(
            f"configured runtime health should be provider-ready: {configured_health}",
        )
    checks = configured_health["checks"]
    if checks["provider_native_config_ready"] is not True:
        raise AssertionError(f"configured runtime config should be ready: {configured_health}")
    if checks["provider_invocation_wired"] is not True:
        raise AssertionError(
            f"configured runtime health should expose provider wiring: {configured_health}",
        )

    print("Phase 4 config-driven provider HTTP wiring passed.")


if __name__ == "__main__":
    main()
