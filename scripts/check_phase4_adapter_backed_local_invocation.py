#!/usr/bin/env python3
"""Validate phase 4.3 adapter-backed local runtime invocation wiring."""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


BACKEND_ROOT = REPO_ROOT / "backend"
MAIN_PATH = BACKEND_ROOT / "main.py"
RUNTIME_PATH = BACKEND_ROOT / "runtime.py"
AGENT_RUNS_PATH = BACKEND_ROOT / "services" / "agent_runs.py"
AGENT_RUNTIME_API_PATH = BACKEND_ROOT / "api" / "agent_runtime.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _parse(path: Path) -> ast.Module:
    return ast.parse(_read(path), filename=str(path))


def _assert_no_direct_agentscope_imports() -> None:
    for path in (RUNTIME_PATH, AGENT_RUNS_PATH, AGENT_RUNTIME_API_PATH):
        tree = _parse(path)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "agentscope" or alias.name.startswith("agentscope."):
                        raise AssertionError(f"{path} directly imports AgentScope")
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                if module == "agentscope" or module.startswith("agentscope."):
                    raise AssertionError(f"{path} directly imports AgentScope")


def _runtime_imported_names(tree: ast.Module) -> set[str]:
    imported: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom):
            continue
        if node.module not in {"runtime", "backend.runtime"}:
            continue
        for alias in node.names:
            imported.add(alias.asname or alias.name)
    return imported


def _keyword_value_name(node: ast.keyword) -> str | None:
    value = node.value
    if isinstance(value, ast.Name):
        return value.id
    if isinstance(value, ast.Attribute):
        return value.attr
    return None


def _assert_main_uses_adapter_backed_builder() -> None:
    tree = _parse(MAIN_PATH)
    imported = _runtime_imported_names(tree)

    if "build_adapter_backed_local_invocation_result_payload" not in imported:
        raise AssertionError("backend/main.py does not import the adapter-backed runtime builder")

    if "build_runtime_invocation_result_payload" in imported:
        raise AssertionError("backend/main.py still imports the raw runtime payload builder")

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        func_name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", "")
        if func_name != "AgentRuntimeRouteDependencies":
            continue
        for keyword in node.keywords:
            if keyword.arg != "build_runtime_invocation_result_payload":
                continue
            injected = _keyword_value_name(keyword)
            if injected == "build_adapter_backed_local_invocation_result_payload":
                return
            raise AssertionError(
                "AgentRuntimeRouteDependencies does not inject the adapter-backed runtime builder"
            )

    raise AssertionError("backend/main.py does not configure AgentRuntimeRouteDependencies")


def _assert_runtime_builder_uses_adapter_registry() -> None:
    source = _read(RUNTIME_PATH)
    required = (
        "def build_adapter_backed_local_invocation_result_payload",
        "get_runtime_adapter(agent_metadata)",
        ".describe(agent_metadata)",
        "\"runtime_bridge\"",
        "\"provider_invocation_wired\": False",
    )
    missing = [text for text in required if text not in source]
    if missing:
        raise AssertionError(f"runtime adapter-backed builder is missing: {missing}")


def _sample_payload() -> dict[str, Any]:
    from backend.runtime import build_adapter_backed_local_invocation_result_payload

    return build_adapter_backed_local_invocation_result_payload(
        agent_metadata={
            "agent_id": "agent-enterprise-support",
            "agent_name": "Enterprise Support",
            "runtime": {
                "provider": "agentscope",
                "mode": "local-service",
            },
        },
        runtime_invocation_id="runtime-invocation-phase-4-3",
        agent_run_id="run-phase-4-3",
        status="completed",
        answer="ok",
        evidence={"source": "phase-4-3-check"},
        raw={"existing": True},
    )


def _assert_sample_payload() -> None:
    payload = _sample_payload()
    raw = payload["raw"]

    assert payload["runtime_invocation_id"] == "runtime-invocation-phase-4-3"
    assert payload["agent_run_id"] == "run-phase-4-3"
    assert payload["status"] == "completed"
    assert payload["answer"] == "ok"
    assert payload["evidence"] == {"source": "phase-4-3-check"}
    assert payload["provider_id"] == "agentscope-platform-adapter"
    assert payload["provider"] == "agentscope"
    assert payload["mode"] == "local-service"
    assert raw["existing"] is True
    assert raw["runtime_bridge"]["type"] == "agentfoundry_local_service_completion"
    assert raw["runtime_bridge"]["adapter_id"] == "agentscope-platform-adapter"
    assert raw["runtime_bridge"]["provider_invocation_wired"] is False


def main() -> None:
    _assert_no_direct_agentscope_imports()
    _assert_main_uses_adapter_backed_builder()
    _assert_runtime_builder_uses_adapter_registry()
    _assert_sample_payload()
    print("phase 4.3 adapter-backed local runtime invocation checks passed")


if __name__ == "__main__":
    main()
