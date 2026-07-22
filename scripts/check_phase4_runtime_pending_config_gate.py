#!/usr/bin/env python3
"""Check pending runtime invocations carry the config gate without secrets."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    RuntimeContext,
    RuntimeInvocationRequest,
    get_runtime_adapter,
    invoke_runtime_adapter,
)


async def assert_direct_adapter_pending_result_uses_request_config_gate() -> None:
    adapter = get_runtime_adapter()
    secret_ref = "secret://agentscope/runtime-token"
    runtime_url = "https://agentscope-runtime.internal"
    request = RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-pending-config-gate",
            agent_id="agent-support",
            agent_name="Support Agent",
        ),
        question="Summarize runtime config readiness.",
        metadata={
            "runtime_invocation_id": "runtime-invocation-pending-config-gate",
            "runtime_provider_config": {
                "agentscope_runtime_url": runtime_url,
                "agentscope_runtime_auth_ref": secret_ref,
            },
        },
    )

    result = await adapter.invoke(request)
    payload = result.to_dict()
    runtime_bridge = payload["raw"]["runtime_bridge"]
    gate = runtime_bridge["provider_native_invocation"]

    assert gate["ready"] is True
    assert gate["configured_keys"] == [
        "agentscope_runtime_url",
        "agentscope_runtime_auth_ref",
    ]
    assert gate["missing_keys"] == []
    assert runtime_bridge["provider_invocation_wired"] is False
    assert runtime_url not in repr(payload)
    assert secret_ref not in repr(payload)
    request_snapshot = payload["raw"]["request"]
    assert request_snapshot["metadata"]["runtime_provider_config"] == {
        "agentscope_runtime_url": "<configured>",
        "agentscope_runtime_auth_ref": "<configured>",
    }


async def assert_runtime_helper_passes_agent_metadata_to_pending_result() -> None:
    runtime_url = "https://agentscope-runtime.internal"
    request = RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:bob",
            session_id="session-helper-config-gate",
            agent_id="agent-knowledge",
            agent_name="Knowledge Agent",
        ),
        question="Report runtime provider gate state.",
        metadata={"runtime_invocation_id": "runtime-invocation-helper-config-gate"},
    )

    payload = await invoke_runtime_adapter(
        request,
        agent_metadata={
            "agent_id": "agent-knowledge",
            "agent_name": "Knowledge Agent",
            "runtime_provider_config": {
                "agentscope_runtime_url": runtime_url,
                "agentscope_runtime_auth_ref": "",
            },
        },
    )

    gate = payload["raw"]["runtime_bridge"]["provider_native_invocation"]
    assert gate["ready"] is False
    assert gate["configured_keys"] == ["agentscope_runtime_url"]
    assert gate["missing_keys"] == ["agentscope_runtime_auth_ref"]
    assert payload["provider_id"] == "agentscope-platform-adapter"
    assert payload["raw"]["runtime_bridge"]["provider_invocation_wired"] is False
    assert runtime_url not in repr(payload)


async def main_async() -> None:
    await assert_direct_adapter_pending_result_uses_request_config_gate()
    await assert_runtime_helper_passes_agent_metadata_to_pending_result()
    print("phase 4 runtime pending config gate ok")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
