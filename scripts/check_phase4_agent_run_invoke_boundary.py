#!/usr/bin/env python3
"""Validate that platform agent runs use the runtime invoke boundary."""

from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
AGENT_RUNTIME_API_PATH = REPO_ROOT / "backend" / "api" / "agent_runtime.py"
AGENT_RUN_SERVICE_PATH = REPO_ROOT / "backend" / "services" / "agent_runs.py"


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


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


def _find_class(tree: ast.Module, name: str) -> ast.ClassDef:
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == name:
            return node
    raise AssertionError(f"{name} class is missing")


def _find_function(tree: ast.AST, name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"{name} function is missing")


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    return _attribute_path(node.func)


def _assert_route_dependency_contract(tree: ast.Module) -> None:
    dependency_class = _find_class(tree, "AgentRuntimeRouteDependencies")
    fields = {
        node.target.id
        for node in dependency_class.body
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name)
    }
    if "invoke_runtime_adapter_from_payload" not in fields:
        raise AssertionError("agent runtime route dependency missing invoke boundary")


def _assert_route_uses_service_boundary(tree: ast.Module) -> None:
    route = _find_function(tree, "run_enterprise_agent")
    references = {
        path
        for node in ast.walk(route)
        for path in [_attribute_path(node)]
        if path is not None
    }
    required = {
        "deps.invoke_runtime_adapter_from_payload",
        "agent_run_service.invoke_runtime_adapter_from_execution_context",
    }
    missing = sorted(required - references)
    if missing:
        raise AssertionError(f"agent run route missing invoke references: {missing}")

    direct_runtime_calls = {
        "invoke_runtime_adapter",
        "invoke_runtime_adapter_from_payload",
    }
    for node in ast.walk(route):
        if not isinstance(node, ast.Call):
            continue
        call_name = _call_name(node)
        if call_name in direct_runtime_calls:
            raise AssertionError(
                f"agent run route directly calls runtime boundary: {call_name}"
            )


def _assert_route_has_no_runtime_imports(tree: ast.Module) -> None:
    forbidden = {"runtime", "backend.runtime", "agentscope"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            modules = [node.module or ""]
        else:
            continue
        for module in modules:
            if any(module == item or module.startswith(f"{item}.") for item in forbidden):
                raise AssertionError(
                    f"agent runtime API directly imports forbidden module: {module}"
                )


def _assert_service_invokes_injected_boundary(tree: ast.Module) -> None:
    helper = _find_function(tree, "invoke_runtime_adapter_from_execution_context")
    if not isinstance(helper, ast.AsyncFunctionDef):
        raise AssertionError("runtime invoke service helper must be async")

    calls = [node for node in ast.walk(helper) if isinstance(node, ast.Call)]
    if not any(_call_name(call) == "invoke_runtime_adapter_from_payload" for call in calls):
        raise AssertionError("service helper does not call injected invoke boundary")

    source = ast.get_source_segment(
        AGENT_RUN_SERVICE_PATH.read_text(encoding="utf-8"),
        helper,
    ) or ""
    required = (
        'execution_context["runtime_invocation_request"]',
        'agent_metadata=execution_context["agent_metadata"]',
    )
    missing = [snippet for snippet in required if snippet not in source]
    if missing:
        raise AssertionError(f"service helper missing context forwarding: {missing}")


def _assert_finalizers_preserve_boundary_result(tree: ast.Module) -> None:
    for name in ("finalize_routed_response", "finalize_unrouted_response"):
        function = _find_function(tree, name)
        source = ast.get_source_segment(
            AGENT_RUN_SERVICE_PATH.read_text(encoding="utf-8"),
            function,
        ) or ""
        if "runtime_boundary_result" not in source:
            raise AssertionError(f"{name} does not persist runtime boundary result")


def main() -> None:
    api_tree = _parse(AGENT_RUNTIME_API_PATH)
    service_tree = _parse(AGENT_RUN_SERVICE_PATH)
    _assert_route_dependency_contract(api_tree)
    _assert_route_has_no_runtime_imports(api_tree)
    _assert_route_uses_service_boundary(api_tree)
    _assert_service_invokes_injected_boundary(service_tree)
    _assert_finalizers_preserve_boundary_result(service_tree)
    print("phase 4.9 agent run invoke boundary checks passed")


if __name__ == "__main__":
    main()
