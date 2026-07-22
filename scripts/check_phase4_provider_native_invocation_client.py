#!/usr/bin/env python3
"""Validate the Phase 4 provider-native invocation client seam."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Mapping


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    AGENTSCOPE_PLATFORM_ADAPTER,
    AgentScopeRuntimeAdapter,
    RuntimeContext,
    RuntimeInvocationRequest,
    build_agentscope_provider_native_invocation_envelope,
    normalize_runtime_invocation_result,
)


READY_RUNTIME_CONFIG = {
    "agentscope_runtime_url": "http://agentscope-runtime.internal:18080",
    "agentscope_runtime_auth_ref": "secret://agentscope/runtime-token",
}


class FakeProviderClient:
    def __init__(self, response: Mapping[str, Any]) -> None:
        self.response = response
        self.calls: list[Mapping[str, Any]] = []

    async def invoke(self, envelope: Mapping[str, Any]) -> Mapping[str, Any]:
        self.calls.append(envelope)
        return self.response


def _adapter(client: FakeProviderClient) -> AgentScopeRuntimeAdapter:
    return AgentScopeRuntimeAdapter(
        id=AGENTSCOPE_PLATFORM_ADAPTER.id,
        name=AGENTSCOPE_PLATFORM_ADAPTER.name,
        provider=AGENTSCOPE_PLATFORM_ADAPTER.provider,
        mode=AGENTSCOPE_PLATFORM_ADAPTER.mode,
        description=AGENTSCOPE_PLATFORM_ADAPTER.description,
        capabilities=AGENTSCOPE_PLATFORM_ADAPTER.capabilities,
        provider_client=client,
    )


def _request(*, with_config: bool = True) -> RuntimeInvocationRequest:
    metadata: dict[str, Any] = {
        "runtime_invocation_id": "runtime-invocation-provider-native-1",
    }
    if with_config:
        metadata["runtime_provider_config"] = READY_RUNTIME_CONFIG
    return RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-provider-native-1",
            agent_id="agent-enterprise-support",
            agent_name="Enterprise Support",
        ),
        question="Summarize the support policy.",
        instructions="Use governed enterprise knowledge only.",
        tools=("knowledge.search",),
        knowledge_base_ids=("kb-support",),
        memory_enabled=True,
        metadata=metadata,
    )


def assert_provider_native_envelope_contract() -> None:
    request = _request()
    adapter_metadata = AGENTSCOPE_PLATFORM_ADAPTER.describe(
        {
            "agent_id": request.context.agent_id,
            "agent_name": request.context.agent_name,
            "runtime_provider_config": READY_RUNTIME_CONFIG,
        },
    )
    envelope = build_agentscope_provider_native_invocation_envelope(
        request=request,
        runtime_adapter=adapter_metadata,
    )

    assert envelope["provider_id"] == AGENTSCOPE_PLATFORM_ADAPTER.id
    assert envelope["provider"] == "agentscope"
    assert envelope["endpoint"] == READY_RUNTIME_CONFIG["agentscope_runtime_url"]
    assert envelope["auth_ref"] == READY_RUNTIME_CONFIG["agentscope_runtime_auth_ref"]
    assert envelope["request"]["context"]["tenant"] == "acme"
    assert envelope["request"]["question"] == request.question
    audit_config = envelope["audit"]["request"]["metadata"]["runtime_provider_config"]
    assert audit_config == {
        "agentscope_runtime_url": "<configured>",
        "agentscope_runtime_auth_ref": "<configured>",
    }


async def assert_provider_client_success_result() -> None:
    client = FakeProviderClient(
        {
            "answer": "Use the enterprise support policy.",
            "status": "completed",
            "evidence": {"tenant": "acme", "provider_trace_id": "trace-1"},
            "provider_run_id": "agentscope-run-1",
            "latency_ms": 42,
            "token_usage": {"input": 10, "output": 12},
            "raw": {"trace_id": "trace-1"},
        },
    )
    adapter = _adapter(client)
    result = await adapter.invoke(_request())
    normalized = normalize_runtime_invocation_result(
        result.to_dict(),
        adapter.describe(
            {
                "agent_id": "agent-enterprise-support",
                "agent_name": "Enterprise Support",
                "runtime_provider_config": READY_RUNTIME_CONFIG,
            },
        ),
    )

    assert len(client.calls) == 1
    assert client.calls[0]["endpoint"] == READY_RUNTIME_CONFIG["agentscope_runtime_url"]
    assert normalized["status"] == "completed"
    assert normalized["provider_run_id"] == "agentscope-run-1"
    assert normalized["runtime_invocation_id"] == "runtime-invocation-provider-native-1"
    assert normalized["raw"]["runtime_bridge"]["type"] == "agentscope_provider_native_invocation"
    assert normalized["raw"]["runtime_bridge"]["provider_invocation_wired"] is True
    raw_text = repr(normalized["raw"])
    assert READY_RUNTIME_CONFIG["agentscope_runtime_auth_ref"] not in raw_text
    assert READY_RUNTIME_CONFIG["agentscope_runtime_url"] not in raw_text


async def assert_provider_client_failure_result() -> None:
    client = FakeProviderClient(
        {
            "answer": "",
            "status": "failed",
            "error": "provider rejected governed request",
            "raw": {"trace_id": "trace-failed"},
        },
    )
    adapter = _adapter(client)
    result = await adapter.invoke(_request())
    normalized = normalize_runtime_invocation_result(
        result.to_dict(),
        adapter.describe(
            {
                "agent_id": "agent-enterprise-support",
                "agent_name": "Enterprise Support",
                "runtime_provider_config": READY_RUNTIME_CONFIG,
            },
        ),
    )

    assert normalized["status"] == "failed"
    assert normalized["error"] == "provider rejected governed request"
    assert normalized["raw"]["runtime_error"] == {
        "message": "provider rejected governed request",
        "status": "failed",
    }


async def assert_missing_config_blocks_provider_client() -> None:
    client = FakeProviderClient({"answer": "should not run", "status": "completed"})
    adapter = _adapter(client)
    result = await adapter.invoke(_request(with_config=False))
    normalized = normalize_runtime_invocation_result(
        result.to_dict(),
        adapter.describe(
            {
                "agent_id": "agent-enterprise-support",
                "agent_name": "Enterprise Support",
            },
        ),
    )

    assert client.calls == []
    assert normalized["status"] == "failed"
    assert "requires configured runtime URL" in normalized["error"]
    assert normalized["raw"]["runtime_bridge"]["type"] == "agentscope_provider_native_config_blocked"


def assert_wired_health_reflects_client_and_config() -> None:
    client = FakeProviderClient({"answer": "ok", "status": "completed"})
    adapter = _adapter(client)
    health = adapter.health({"runtime_provider_config": READY_RUNTIME_CONFIG})
    assert health["ready"] is True
    assert health["status"] == "ready"
    assert health["checks"]["provider_native_config_ready"] is True
    assert health["checks"]["provider_invocation_wired"] is True


async def main_async() -> None:
    assert_provider_native_envelope_contract()
    await assert_provider_client_success_result()
    await assert_provider_client_failure_result()
    await assert_missing_config_blocks_provider_client()
    assert_wired_health_reflects_client_and_config()
    print("Phase 4 provider-native invocation client seam passed.")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
