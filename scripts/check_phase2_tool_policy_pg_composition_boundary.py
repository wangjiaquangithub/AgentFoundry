#!/usr/bin/env python3
"""Check tool policy PostgreSQL wiring stays behind service composition."""

from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN_MODULE = ROOT / "backend" / "main.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"
TOOLS_SERVICE_MODULE = ROOT / "backend" / "services" / "tools.py"


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _function_node(tree: ast.AST, function_name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return node
    return None


def _calls_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
            if child.func.id == name:
                return True
    return False


def _references_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Name) and child.id == name:
            return True
    return False


def _check_tools_service_boundary() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(TOOLS_SERVICE_MODULE)
    source = TOOLS_SERVICE_MODULE.read_text(encoding="utf-8")

    if "PostgresToolPolicyWriteThroughRepository" in source:
        errors.append(
            "backend/services/tools.py must not reference "
            "PostgresToolPolicyWriteThroughRepository; inject a repository selector",
        )

    init = None
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "PlatformToolPolicyService":
            init = next(
                (
                    item
                    for item in node.body
                    if isinstance(item, ast.FunctionDef) and item.name == "__init__"
                ),
                None,
            )
            break

    if init is None:
        errors.append("PlatformToolPolicyService.__init__ was not found.")
    elif not any(
        arg.arg == "tool_policy_repository_selector"
        for arg in init.args.kwonlyargs
    ):
        errors.append(
            "PlatformToolPolicyService.__init__ must accept "
            "tool_policy_repository_selector",
        )

    return errors


def _check_composition_boundary() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(COMPOSITION_MODULE)
    selector = _function_node(tree, "build_tool_policy_repository_selector")
    postgres_factory = _function_node(
        tree,
        "build_configured_postgres_tool_policy_repository",
    )

    if selector is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_tool_policy_repository_selector()",
        )
    elif not _references_name(selector, "ToolPolicyRepositoryProtocol"):
        errors.append(
            "build_tool_policy_repository_selector() must return the "
            "tool policy repository protocol",
        )

    if postgres_factory is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_configured_postgres_tool_policy_repository()",
        )
    elif not _references_name(
        postgres_factory,
        "PostgresToolPolicyWriteThroughRepository",
    ):
        errors.append(
            "build_configured_postgres_tool_policy_repository() must construct "
            "PostgresToolPolicyWriteThroughRepository",
        )

    return errors


def _check_main_wiring() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(MAIN_MODULE)
    policy_service_factory = _function_node(tree, "_platform_tool_policy_service")

    if policy_service_factory is None:
        errors.append("backend/main.py must define _platform_tool_policy_service().")
    elif not _calls_name(
        policy_service_factory,
        "build_tool_policy_repository_selector",
    ):
        errors.append(
            "_platform_tool_policy_service() must inject "
            "build_tool_policy_repository_selector()",
        )

    if _calls_name(tree, "build_tool_governance_write_repository"):
        errors.append(
            "backend/main.py must not wire tool governance writer directly into "
            "PlatformToolPolicyService",
        )

    return errors


def main() -> int:
    errors = (
        _check_tools_service_boundary()
        + _check_composition_boundary()
        + _check_main_wiring()
    )
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("Phase 2 tool policy PostgreSQL composition boundary passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
