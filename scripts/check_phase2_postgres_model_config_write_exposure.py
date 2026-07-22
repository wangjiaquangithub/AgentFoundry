#!/usr/bin/env python3
"""Check PostgreSQL model config write exposure state.

This static gate keeps the Phase 2 data-layer boundary explicit: the
PostgreSQL write repository may exist before a stable platform API exposes it,
but that pending exposure must be tracked intentionally.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PERSISTENCE_MODULE = ROOT / "backend" / "persistence" / "model_configs.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "model_configs.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"
BACKEND_DIR = ROOT / "backend"

ALLOWED_MODEL_CONFIG_WRITE_EXPOSURE = {SERVICE_MODULE, COMPOSITION_MODULE}


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _class_node(tree: ast.AST, class_name: str) -> ast.ClassDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    return None


def _public_method_names(class_node: ast.ClassDef) -> set[str]:
    return {
        node.name
        for node in class_node.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and not node.name.startswith("_")
    }


def _python_modules_under(path: Path) -> list[Path]:
    return sorted(
        module
        for module in path.rglob("*.py")
        if "__pycache__" not in module.parts and module != PERSISTENCE_MODULE
    )


def _imports_or_references_write_repository(path: Path) -> bool:
    tree = _parse_module(path)
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == "PostgresModelConfigWriteRepository":
            return True
        if isinstance(node, ast.Attribute) and node.attr == "PostgresModelConfigWriteRepository":
            return True
    return False


def _calls_upsert_model_config(path: Path) -> bool:
    tree = _parse_module(path)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if isinstance(function, ast.Attribute) and function.attr == "upsert_model_config":
            return True
        if isinstance(function, ast.Name) and function.id == "upsert_model_config":
            return True
    return False


def _check_repository_contract() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(PERSISTENCE_MODULE)
    repository = _class_node(tree, "PostgresModelConfigWriteRepository")
    if repository is None:
        return [
            "missing PostgreSQL model config write repository: "
            "backend/persistence/model_configs.py:PostgresModelConfigWriteRepository",
        ]

    methods = _public_method_names(repository)
    if "upsert_model_config" not in methods:
        errors.append(
            "PostgreSQL model config write repository must expose "
            "upsert_model_config(record)",
        )
    return errors


def _check_exposure_state() -> tuple[list[str], bool]:
    errors: list[str] = []
    modules = _python_modules_under(BACKEND_DIR)
    importing_modules = [
        module
        for module in modules
        if _imports_or_references_write_repository(module)
    ]
    calling_modules = [
        module
        for module in modules
        if _calls_upsert_model_config(module)
    ]

    exposed = bool(importing_modules or calling_modules)
    exposed_modules = set(importing_modules) | set(calling_modules)
    unexpected_modules = exposed_modules - ALLOWED_MODEL_CONFIG_WRITE_EXPOSURE

    if not exposed:
        errors.append(
            "PostgreSQL model config write path must be mediated by "
            "backend/services/model_configs.py before API exposure.",
        )
        return errors, exposed

    for module in sorted(unexpected_modules):
        errors.append(
            "PostgreSQL model config write path is exposed outside the approved "
            f"service boundary: {module.relative_to(ROOT)}",
        )

    return errors, exposed


def main() -> int:
    errors = _check_repository_contract()
    exposure_errors, exposed = _check_exposure_state()
    errors.extend(exposure_errors)

    print("Phase 2 PostgreSQL model config write exposure gate")
    print("- repository: PostgresModelConfigWriteRepository.upsert_model_config")
    print(f"- wired outside persistence: {'yes' if exposed else 'no'}")
    print("- approved service boundary: backend/services/model_configs.py")
    print("- approved composition boundary: backend/services/composition.py")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL model config write exposure state is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
