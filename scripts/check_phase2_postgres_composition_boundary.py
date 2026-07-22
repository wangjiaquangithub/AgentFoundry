#!/usr/bin/env python3
"""Check backend main keeps PostgreSQL internals behind service composition."""

from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN_MODULE = ROOT / "backend" / "main.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"


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


def _check_main_boundary() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(MAIN_MODULE)

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "backend.persistence":
            errors.append(
                "backend/main.py must not import backend.persistence directly; "
                "use backend/services/composition.py selectors",
            )
        if isinstance(node, ast.Name) and node.id == "inspect_configured_database_status":
            errors.append(
                "backend/main.py must receive database status inspection from "
                "build_database_config_status_inspector()",
            )

    if not _calls_name(tree, "build_database_config_status_inspector"):
        errors.append(
            "backend/main.py must wire database_config_status through "
            "build_database_config_status_inspector()",
        )

    return errors


def _check_composition_boundary() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(COMPOSITION_MODULE)
    factory = _function_node(tree, "build_database_config_status_inspector")

    if factory is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_database_config_status_inspector()",
        )
    elif not _references_name(factory, "inspect_configured_database_status"):
        errors.append(
            "build_database_config_status_inspector() must select the configured "
            "database status inspector",
        )

    return errors


def main() -> int:
    errors = _check_main_boundary() + _check_composition_boundary()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("Phase 2 PostgreSQL composition boundary passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
