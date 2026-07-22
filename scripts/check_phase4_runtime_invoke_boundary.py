#!/usr/bin/env python3
"""Validate phase 4.8 runtime adapter invoke boundary."""

from __future__ import annotations

import asyncio
import ast
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

RUNTIME_PATH = REPO_ROOT / "backend" / "runtime.py"


def _parse_runtime() -> ast.Module:
    return ast.parse(RUNTIME_PATH.read_text(encoding="utf-8"), filename=str(RUNTIME_PATH))


def _find_async_function(tree: ast.Module, name: str) -> ast.AsyncFunctionDef:
    for node in tree.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name:
            return node
    raise AssertionError(f"{name} function is missing")


def _attribute_path(node: ast.AST) -> str | None:
    parts: list[str] = []
    current = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        parts.append(current.id)
        return ".".join(reversed(parts))
    return None


def assert_runtime_invoke_helper_contract() -> None:
    tree = _parse_runtime()
    helper = _find_async_function(tree, "invoke_runtime_adapter")
    referenced = {
        path
        for node in ast.walk(helper)
        for path in [_attribute_path(node)]
        if path is not None
    }
    required = {
        "selected_adapter.describe",
        "selected_adapter.invoke",
    }
    missing = sorted(required - referenced)
    if missing:
        raise AssertionError(f"runtime invoke helper missing references: {missing}")

    called_names = {
        node.func.id
        for node in ast.walk(helper)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }
    if "normalize_runtime_invocation_result" not in called_names:
        raise AssertionError("runtime invoke helper does not normalize adapter results")


async def assert_default_adapter_pending_invocation_result() -> None:
    from backend.runtime import (
        build_runtime_invocation_request_payload,
        invoke_runtime_adapter_from_payload,
    )

    request = build_runtime_invocation_request_payload(
        tenant="acme",
        user_id="acme:alice",
        session_id="session-phase-4-8",
        agent_id="agent-enterprise-support",
        agent_name="Enterprise Support",
        question="Summarize runtime adapter state.",
        tools=("knowledge_search",),
        knowledge_base_ids=("kb-enterprise-handbook",),
        memory_enabled=True,
        metadata={"runtime_invocation_id": "runtime-invocation-phase-4-8"},
    )
    result = await invoke_runtime_adapter_from_payload(request)

    assert result["provider_id"] == "agentscope-platform-adapter"
    assert result["provider"] == "agentscope"
    assert result["mode"] == "local-service"
    assert result["runtime_invocation_id"] == "runtime-invocation-phase-4-8"
    assert result["status"] == "failed"
    assert result["error"]
    assert result["evidence"]["tenant"] == "acme"
    assert result["evidence"]["user_id"] == "acme:alice"
    assert result["evidence"]["agent_id"] == "agent-enterprise-support"
    assert result["raw"]["runtime_bridge"]["type"] == "agentscope_adapter_invocation_pending"
    assert result["raw"]["runtime_bridge"]["provider_invocation_wired"] is False


async def assert_invalid_adapter_result_is_rejected() -> None:
    from backend.runtime import (
        RuntimeCapability,
        RuntimeInvocationRequest,
        RuntimeInvocationResult,
        build_runtime_invocation_request_from_payload,
        build_runtime_invocation_request_payload,
        invoke_runtime_adapter,
    )

    class InvalidAdapter:
        id = "invalid-adapter"
        name = "Invalid Adapter"
        provider = "invalid"
        mode = "test"
        description = "Invalid runtime adapter fixture."
        capabilities = (
            RuntimeCapability(
                id="run_evidence",
                name="Run Evidence",
                description="Fixture capability.",
            ),
        )

        def describe(self, _agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
            return {
                "id": self.id,
                "name": self.name,
                "provider": self.provider,
                "mode": self.mode,
                "description": self.description,
                "capabilities": ["run_evidence"],
                "capability_details": [
                    capability.to_dict() for capability in self.capabilities
                ],
                "agent_id": "agent-invalid",
                "agent_name": "Invalid Agent",
            }

        def health(self, _agent_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
            raise NotImplementedError

        async def invoke(
            self,
            _request: RuntimeInvocationRequest,
        ) -> RuntimeInvocationResult:
            return RuntimeInvocationResult(
                answer="invalid",
                status="completed",
                evidence={},
                provider_id="unexpected-provider-id",
                provider="unexpected-provider",
                mode="unexpected-mode",
                raw={},
            )

    request = build_runtime_invocation_request_from_payload(
        build_runtime_invocation_request_payload(
            tenant="acme",
            user_id="acme:alice",
            session_id="session-invalid",
            agent_id="agent-invalid",
            question="Invalid adapter result.",
        ),
    )

    try:
        await invoke_runtime_adapter(request, runtime_adapter=InvalidAdapter())
    except ValueError as exc:
        assert "does not match adapter metadata" in str(exc)
    else:
        raise AssertionError("runtime invoke helper accepted mismatched adapter result")


async def main_async() -> None:
    assert_runtime_invoke_helper_contract()
    await assert_default_adapter_pending_invocation_result()
    await assert_invalid_adapter_result_is_rejected()
    print("phase 4.8 runtime adapter invoke boundary checks passed")


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
