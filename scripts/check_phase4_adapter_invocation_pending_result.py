#!/usr/bin/env python3
"""Validate phase 4.5 adapter invocation pending result contract."""

from __future__ import annotations

import ast
import asyncio
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.runtime import (  # noqa: E402
    RuntimeContext,
    RuntimeInvocationRequest,
    RuntimeInvocationResult,
    get_runtime_adapter,
    normalize_runtime_invocation_result,
)


async def assert_adapter_invoke_returns_pending_result() -> None:
    adapter = get_runtime_adapter()
    request = RuntimeInvocationRequest(
        context=RuntimeContext(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-pending-1",
            agent_id="agent-support",
            agent_name="Support Agent",
        ),
        question="Summarize the runtime boundary.",
        instructions="Answer with cited platform evidence.",
        tools=("knowledge.search",),
        knowledge_base_ids=("kb-handbook",),
        memory_enabled=True,
        metadata={"runtime_invocation_id": "runtime-invocation-pending-1"},
    )

    result = await adapter.invoke(request)

    assert isinstance(result, RuntimeInvocationResult)
    payload = result.to_dict()
    adapter_metadata = adapter.describe(
        {"agent_id": "agent-support", "agent_name": "Support Agent"},
    )
    normalized = normalize_runtime_invocation_result(payload, adapter_metadata)

    assert normalized["status"] == "failed"
    assert normalized["answer"] == ""
    assert normalized["runtime_invocation_id"] == "runtime-invocation-pending-1"
    assert normalized["provider_id"] == adapter.id
    assert normalized["provider"] == adapter.provider
    assert normalized["mode"] == adapter.mode
    assert normalized["evidence"]["tenant"] == "acme"
    assert normalized["evidence"]["user_id"] == "acme:alice"
    assert normalized["evidence"]["agent_id"] == "agent-support"
    assert "pending" in normalized["error"].lower()
    assert normalized["raw"]["runtime_error"] == {
        "message": normalized["error"],
        "status": "failed",
    }
    runtime_bridge = normalized["raw"]["runtime_bridge"]
    assert runtime_bridge["type"] == "agentscope_adapter_invocation_pending"
    assert runtime_bridge["provider_invocation_wired"] is False
    assert runtime_bridge["adapter_id"] == adapter.id
    assert normalized["raw"]["request"]["question"] == request.question


def assert_no_direct_agentscope_dependency() -> None:
    path = REPO_ROOT / "backend" / "runtime.py"
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            imported = [node.module or ""]
        else:
            continue
        assert not any(
            name == "agentscope" or name.startswith("agentscope.")
            for name in imported
        ), f"{path} imports AgentScope directly: {imported}"


def main() -> None:
    asyncio.run(assert_adapter_invoke_returns_pending_result())
    assert_no_direct_agentscope_dependency()
    print("phase 4.5 adapter invocation pending result ok")


if __name__ == "__main__":
    main()
