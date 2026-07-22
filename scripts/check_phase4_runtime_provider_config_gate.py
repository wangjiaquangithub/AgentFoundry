#!/usr/bin/env python3
"""Validate the phase 4 provider-native runtime config gate."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


EXPECTED_REQUIRED_KEYS = [
    "agentscope_runtime_url",
    "agentscope_runtime_auth_ref",
]


def _assert_gate(
    payload: dict[str, Any],
    *,
    ready: bool,
    configured_keys: list[str],
    missing_keys: list[str],
) -> None:
    if payload.get("id") != "agentscope_provider_native_invocation_config":
        raise AssertionError(f"unexpected config gate id: {payload}")
    if payload.get("required_keys") != EXPECTED_REQUIRED_KEYS:
        raise AssertionError(f"unexpected required config keys: {payload}")
    if payload.get("configured_keys") != configured_keys:
        raise AssertionError(f"unexpected configured config keys: {payload}")
    if payload.get("missing_keys") != missing_keys:
        raise AssertionError(f"unexpected missing config keys: {payload}")
    if payload.get("ready") is not ready:
        raise AssertionError(f"unexpected config gate readiness: {payload}")
    message = payload.get("message")
    if not isinstance(message, str) or "invocation" not in message:
        raise AssertionError(f"config gate should explain invocation readiness: {payload}")


def main() -> None:
    from runtime import describe_provider_native_invocation_config_gate
    from runtime import describe_runtime_adapter, describe_runtime_provider_health

    blocked_gate = describe_provider_native_invocation_config_gate()
    _assert_gate(
        blocked_gate,
        ready=False,
        configured_keys=[],
        missing_keys=EXPECTED_REQUIRED_KEYS,
    )

    partially_configured_gate = describe_provider_native_invocation_config_gate(
        {
            "runtime_provider_config": {
                "agentscope_runtime_url": "http://127.0.0.1:18080",
                "agentscope_runtime_auth_ref": "",
            },
        },
    )
    _assert_gate(
        partially_configured_gate,
        ready=False,
        configured_keys=["agentscope_runtime_url"],
        missing_keys=["agentscope_runtime_auth_ref"],
    )

    ready_gate = describe_provider_native_invocation_config_gate(
        {
            "runtime_provider_config": {
                "agentscope_runtime_url": "http://127.0.0.1:18080",
                "agentscope_runtime_auth_ref": "secret://agentscope/runtime-token",
            },
        },
    )
    _assert_gate(
        ready_gate,
        ready=True,
        configured_keys=EXPECTED_REQUIRED_KEYS,
        missing_keys=[],
    )

    adapter_payload = describe_runtime_adapter()
    _assert_gate(
        adapter_payload["provider_native_invocation"],
        ready=False,
        configured_keys=[],
        missing_keys=EXPECTED_REQUIRED_KEYS,
    )

    health_payload = describe_runtime_provider_health()
    checks = health_payload.get("checks")
    if not isinstance(checks, dict):
        raise AssertionError(f"runtime health checks must be an object: {health_payload}")
    if checks.get("provider_native_config_ready") is not False:
        raise AssertionError(
            "runtime health must not claim provider-native config is ready by default",
        )
    if checks.get("provider_invocation_wired") is not False:
        raise AssertionError(
            "runtime health must not claim provider invocation is wired",
        )

    configured_health = describe_runtime_provider_health(
        {
            "runtime_provider_config": {
                "agentscope_runtime_url": "http://127.0.0.1:18080",
                "agentscope_runtime_auth_ref": "secret://agentscope/runtime-token",
            },
        },
    )
    configured_checks = configured_health.get("checks")
    if not isinstance(configured_checks, dict):
        raise AssertionError(
            f"configured runtime health checks must be an object: {configured_health}",
        )
    if configured_checks.get("provider_native_config_ready") is not True:
        raise AssertionError(
            "configured runtime health should expose ready config references",
        )
    if configured_checks.get("provider_invocation_wired") is not True:
        raise AssertionError(
            "configured runtime health should wire provider invocation when config is ready",
        )

    print("Phase 4 runtime provider config gate passed.")


if __name__ == "__main__":
    main()
