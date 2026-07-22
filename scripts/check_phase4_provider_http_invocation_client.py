#!/usr/bin/env python3
"""Validate the Phase 4 provider-native HTTP invocation client."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Mapping


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    AGENTSCOPE_PLATFORM_ADAPTER,
    RuntimeContext,
    RuntimeInvocationRequest,
    build_agentscope_provider_native_invocation_envelope,
)
from backend.runtime_provider_clients import (  # noqa: E402
    AgentScopeProviderHttpInvocationClient,
    HttpInvocationResponse,
)


AUTH_REF = "secret://agentscope/runtime-token"
TOKEN = "runtime-token-value"
READY_RUNTIME_CONFIG = {
    "agentscope_runtime_url": "http://agentscope-runtime.internal:18080",
    "agentscope_runtime_auth_ref": AUTH_REF,
}


class FakeTransport:
    def __init__(self, response: HttpInvocationResponse) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    def __call__(
        self,
        *,
        url: str,
        body: bytes,
        headers: Mapping[str, str],
        timeout_seconds: float,
    ) -> HttpInvocationResponse:
        self.calls.append(
            {
                "url": url,
                "body": json.loads(body.decode("utf-8")),
                "headers": dict(headers),
                "timeout_seconds": timeout_seconds,
            },
        )
        return self.response


def _request() -> RuntimeInvocationRequest:
    return RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-provider-http-1",
            agent_id="agent-enterprise-support",
            agent_name="Enterprise Support",
        ),
        question="Summarize the support policy.",
        instructions="Use governed enterprise knowledge only.",
        tools=("knowledge.search",),
        knowledge_base_ids=("kb-support",),
        memory_enabled=True,
        metadata={
            "runtime_invocation_id": "runtime-invocation-provider-http-1",
            "runtime_provider_config": READY_RUNTIME_CONFIG,
        },
    )


def _envelope() -> dict[str, Any]:
    request = _request()
    adapter_metadata = AGENTSCOPE_PLATFORM_ADAPTER.describe(
        {
            "agent_id": request.context.agent_id,
            "agent_name": request.context.agent_name,
            "runtime_provider_config": READY_RUNTIME_CONFIG,
        },
    )
    return build_agentscope_provider_native_invocation_envelope(
        request=request,
        runtime_adapter=adapter_metadata,
    )


async def assert_http_success_posts_envelope() -> None:
    provider_payload = {
        "answer": "Use the enterprise support policy.",
        "status": "completed",
        "evidence": {"tenant": "acme", "provider_trace_id": "trace-http-1"},
        "provider_run_id": "agentscope-http-run-1",
        "latency_ms": 25,
        "raw": {"trace_id": "trace-http-1"},
    }
    transport = FakeTransport(
        HttpInvocationResponse(
            status_code=200,
            body=json.dumps(provider_payload).encode("utf-8"),
        ),
    )
    client = AgentScopeProviderHttpInvocationClient(
        secret_resolver=lambda auth_ref: TOKEN if auth_ref == AUTH_REF else None,
        transport=transport,
        timeout_seconds=9,
    )

    result = await client.invoke(_envelope())

    assert result == provider_payload
    assert len(transport.calls) == 1
    call = transport.calls[0]
    assert call["url"] == "http://agentscope-runtime.internal:18080/invoke"
    assert call["headers"]["Accept"] == "application/json"
    assert call["headers"]["Content-Type"] == "application/json"
    assert call["headers"]["Authorization"] == f"Bearer {TOKEN}"
    assert call["timeout_seconds"] == 9
    assert call["body"]["auth_ref"] == AUTH_REF
    assert call["body"]["request"]["context"]["tenant"] == "acme"


async def assert_endpoint_with_path_is_preserved() -> None:
    envelope = _envelope()
    envelope["endpoint"] = "https://runtime.example.com/api/invoke"
    transport = FakeTransport(
        HttpInvocationResponse(
            status_code=200,
            body=b'{"answer":"ok","status":"completed"}',
        ),
    )
    client = AgentScopeProviderHttpInvocationClient(transport=transport)

    await client.invoke(envelope)

    assert transport.calls[0]["url"] == "https://runtime.example.com/api/invoke"
    assert "Authorization" not in transport.calls[0]["headers"]


async def assert_http_failure_is_sanitized() -> None:
    transport = FakeTransport(
        HttpInvocationResponse(
            status_code=503,
            body=json.dumps(
                {
                    "error": f"upstream rejected {AUTH_REF} with {TOKEN}",
                    "raw": {"auth_ref": AUTH_REF, "token": TOKEN},
                },
            ).encode("utf-8"),
        ),
    )
    client = AgentScopeProviderHttpInvocationClient(
        secret_resolver=lambda _auth_ref: TOKEN,
        transport=transport,
    )

    result = await client.invoke(_envelope())

    assert result["status"] == "failed"
    assert result["error"] == "upstream rejected <redacted> with <redacted>"
    raw_text = repr(result["raw"])
    assert AUTH_REF not in raw_text
    assert TOKEN not in raw_text


async def assert_invalid_json_is_sanitized() -> None:
    transport = FakeTransport(
        HttpInvocationResponse(
            status_code=200,
            body=f"not json {AUTH_REF} {TOKEN}".encode("utf-8"),
        ),
    )
    client = AgentScopeProviderHttpInvocationClient(
        secret_resolver=lambda _auth_ref: TOKEN,
        transport=transport,
    )

    result = await client.invoke(_envelope())

    assert result["status"] == "failed"
    assert "not valid JSON" in result["error"]
    raw_text = repr(result["raw"])
    assert AUTH_REF not in raw_text
    assert TOKEN not in raw_text


async def main_async() -> None:
    await assert_http_success_posts_envelope()
    await assert_endpoint_with_path_is_preserved()
    await assert_http_failure_is_sanitized()
    await assert_invalid_json_is_sanitized()
    print("Phase 4 provider-native HTTP invocation client passed.")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
