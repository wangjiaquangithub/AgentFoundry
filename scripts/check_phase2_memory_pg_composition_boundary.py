#!/usr/bin/env python3
"""Check platform memory PostgreSQL wiring stays behind service composition."""

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


def _imports_name(tree: ast.AST, name: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.asname == name or alias.name == name for alias in node.names):
                return True
        if isinstance(node, ast.ImportFrom):
            if any(alias.asname == name or alias.name == name for alias in node.names):
                return True
    return False


def _check_composition_boundary() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(COMPOSITION_MODULE)
    factory = _function_node(tree, "build_platform_memory_repository")

    if factory is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_platform_memory_repository()",
        )
        return errors

    if not _references_name(factory, "PlatformMemoryRepository"):
        errors.append(
            "build_platform_memory_repository() must construct "
            "PlatformMemoryRepository",
        )
    if not _calls_name(factory, "build_memory_item_read_repository"):
        errors.append(
            "build_platform_memory_repository() must inject "
            "build_memory_item_read_repository()",
        )
    if not _calls_name(factory, "build_memory_item_write_repository"):
        errors.append(
            "build_platform_memory_repository() must inject "
            "build_memory_item_write_repository()",
        )

    return errors


def _check_main_wiring() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(MAIN_MODULE)

    if not _calls_name(tree, "build_platform_memory_repository"):
        errors.append(
            "backend/main.py must call build_platform_memory_repository()",
        )

    for forbidden in (
        "PlatformMemoryRepository",
        "build_memory_item_read_repository",
        "build_memory_item_write_repository",
    ):
        if _imports_name(tree, forbidden):
            errors.append(f"backend/main.py must not import {forbidden}.")
        if _calls_name(tree, forbidden):
            errors.append(f"backend/main.py must not call {forbidden}().")

    return errors


def main() -> int:
    errors = _check_composition_boundary() + _check_main_wiring()
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("Phase 2 memory PostgreSQL composition boundary passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
