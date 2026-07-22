#!/usr/bin/env python3
"""Check PostgreSQL model config service composition stays explicit."""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FACTORY_MODULE = ROOT / "backend" / "services" / "composition.py"
MAIN_MODULE = ROOT / "backend" / "main.py"


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _function_node(tree: ast.AST, function_name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return node
    return None


def _references_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Name) and child.id == name:
            return True
    return False


def _calls_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
            if child.func.id == name:
                return True
    return False


def _check_factory_contract() -> list[str]:
    errors: list[str] = []
    if not FACTORY_MODULE.exists():
        return ["missing backend/services/composition.py"]

    tree = _parse_module(FACTORY_MODULE)
    build_service = _function_node(tree, "build_postgres_model_config_service")
    build_configured = _function_node(
        tree,
        "build_configured_postgres_model_config_service",
    )
    build_selector = _function_node(tree, "build_model_config_service")
    if build_service is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_postgres_model_config_service(database)",
        )
    else:
        for name in (
            "PlatformModelConfigService",
            "PostgresModelConfigWriteRepository",
            "PostgresAuditEventWriteRepository",
        ):
            if not _references_name(build_service, name):
                errors.append(
                    "build_postgres_model_config_service must compose "
                    f"{name}",
                )

    if build_configured is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_configured_postgres_model_config_service()",
        )
    else:
        if not _calls_name(build_configured, "create_configured_postgres_database"):
            errors.append(
                "configured model config service factory must use the configured "
                "PostgreSQL database boundary",
            )
        if not _calls_name(build_configured, "build_postgres_model_config_service"):
            errors.append(
                "configured model config service factory must delegate to the "
                "PostgreSQL service factory",
            )

    if build_selector is None:
        errors.append(
            "backend/services/composition.py must define build_model_config_service() "
            "as the production model config service selector",
        )
    elif not _calls_name(
        build_selector,
        "build_configured_postgres_model_config_service",
    ):
        errors.append(
            "model config service selector must delegate to the configured "
            "PostgreSQL service factory",
        )

    source = FACTORY_MODULE.read_text(encoding="utf-8")
    for forbidden in ("SQLite", "sqlite", "FastAPI", "APIRouter"):
        if forbidden in source:
            errors.append(
                "model config service factory must stay PostgreSQL-only and "
                f"API-free; found {forbidden}",
            )
    return errors


def _check_main_not_wiring_write_repository() -> list[str]:
    tree = _parse_module(MAIN_MODULE)
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == "PostgresModelConfigWriteRepository":
            return [
                "backend/main.py must not directly wire "
                "PostgresModelConfigWriteRepository",
            ]
    return []


def main() -> int:
    errors = [
        *_check_factory_contract(),
        *_check_main_not_wiring_write_repository(),
    ]

    print("Phase 2 PostgreSQL model config service factory gate")
    print("- factory: backend/services/composition.py")
    print("- service: PlatformModelConfigService")
    print("- persistence: PostgreSQL write repository plus audit writer")
    print("- API/main direct write wiring: blocked")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL model config service composition is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
