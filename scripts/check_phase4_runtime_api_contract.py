#!/usr/bin/env python3
"""Validate phase 4.7 runtime adapter API contract boundaries."""

from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
AGENT_RUNTIME_API_PATH = REPO_ROOT / "backend" / "api" / "agent_runtime.py"

REQUIRED_DEPENDENCIES = {
    "describe_runtime_adapter",
    "build_runtime_invocation_request_payload",
    "build_runtime_invocation_result_payload",
}

REQUIRED_ROUTE_REFERENCES = {
    "deps.describe_runtime_adapter",
    "deps.build_runtime_invocation_request_payload",
    "deps.build_runtime_invocation_result_payload",
    "agent_run_service.resolve_run_agent_context",
    "agent_run_service.build_execution_context_from_agent_context",
    "agent_run_service.finalize_unrouted_run_from_context",
    "agent_run_service.finalize_routed_run_from_context",
}

FORBIDDEN_IMPORT_MODULES = {
    "agentscope",
    "runtime",
    "backend.runtime",
}

FORBIDDEN_DIRECT_CALLS = {
    "describe_runtime_adapter",
    "build_runtime_invocation_request_payload",
    "build_runtime_invocation_result_payload",
    "build_adapter_backed_local_invocation_result_payload",
    "get_runtime_adapter",
    "RuntimeInvocationRequest",
    "RuntimeInvocationResult",
}


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _module_forbidden(module: str) -> bool:
    return any(
        module == forbidden or module.startswith(f"{forbidden}.")
        for forbidden in FORBIDDEN_IMPORT_MODULES
    )


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


def _assert_dependency_contract(tree: ast.Module) -> None:
    dependency_class = _find_class(tree, "AgentRuntimeRouteDependencies")
    fields = {
        node.target.id
        for node in dependency_class.body
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name)
    }
    missing = sorted(REQUIRED_DEPENDENCIES - fields)
    if missing:
        raise AssertionError(f"runtime route dependencies missing fields: {missing}")


def _assert_no_forbidden_imports(tree: ast.Module) -> None:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _module_forbidden(alias.name):
                    raise AssertionError(
                        f"agent runtime API directly imports forbidden module: {alias.name}"
                    )
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if _module_forbidden(module):
                raise AssertionError(
                    f"agent runtime API directly imports forbidden module: {module}"
                )


def _assert_route_uses_injected_runtime_contract(tree: ast.Module) -> None:
    route = _find_function(tree, "run_enterprise_agent")
    referenced = {
        path
        for node in ast.walk(route)
        for path in [_attribute_path(node)]
        if path is not None
    }
    missing = sorted(REQUIRED_ROUTE_REFERENCES - referenced)
    if missing:
        raise AssertionError(f"runtime route missing injected contract references: {missing}")


def _assert_route_has_no_direct_runtime_calls(tree: ast.Module) -> None:
    route = _find_function(tree, "run_enterprise_agent")
    for node in ast.walk(route):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name) and node.func.id in FORBIDDEN_DIRECT_CALLS:
            raise AssertionError(
                f"runtime route directly calls runtime contract: {node.func.id}"
            )


def main() -> None:
    tree = _parse(AGENT_RUNTIME_API_PATH)
    _assert_dependency_contract(tree)
    _assert_no_forbidden_imports(tree)
    _assert_route_uses_injected_runtime_contract(tree)
    _assert_route_has_no_direct_runtime_calls(tree)
    print("phase 4.7 runtime adapter API contract checks passed")


if __name__ == "__main__":
    main()
