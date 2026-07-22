#!/usr/bin/env python3
"""Check PostgreSQL model config API route service boundary."""

from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTE_MODULE = ROOT / "backend" / "api" / "model_configs.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _string_constants(tree: ast.AST) -> set[str]:
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }


def _class_names(tree: ast.AST) -> set[str]:
    return {node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)}


def _imported_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
    return names


def _calls_attribute(tree: ast.AST, attribute_name: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == attribute_name:
                return True
    return False


def _calls_name(tree: ast.AST, name: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id == name:
                return True
    return False


def _attribute_names(tree: ast.AST) -> set[str]:
    return {
        node.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute)
    }


def _check_route_module() -> list[str]:
    errors: list[str] = []
    if not ROUTE_MODULE.exists():
        return ["backend/api/model_configs.py must define the model config route"]

    tree = _parse_module(ROUTE_MODULE)
    constants = _string_constants(tree)
    imports = _imported_names(tree)

    if "ModelConfigRouteDependencies" not in _class_names(tree):
        errors.append("model config route must declare ModelConfigRouteDependencies")
    if "EnterpriseModelConfigUpsertRequest" not in imports:
        errors.append("model config route must use the API request schema")
    if "ModelConfigApiCommandInput" not in imports:
        errors.append("model config route must convert API input to ModelConfigApiCommandInput")
    if "PlatformModelConfigServiceError" not in imports:
        errors.append("model config route must translate service errors")
    if "/enterprise/platform/model-configs/upsert" not in constants:
        errors.append("model config route must expose the upsert endpoint")
    if not _calls_attribute(tree, "model_config_service"):
        errors.append("model config route must obtain service from route dependencies")
    if not _calls_attribute(tree, "upsert_model_config_from_api"):
        errors.append("model config route must call the service API boundary")
    if "PostgresModelConfigWriteRepository" in imports:
        errors.append("model config route must not instantiate PostgreSQL repositories directly")
    if "SQLite" in constants or "sqlite" in constants:
        errors.append("model config route must not provide SQLite as a production fallback")

    return errors


def _check_schema_module() -> list[str]:
    tree = _parse_module(SCHEMA_MODULE)
    if "EnterpriseModelConfigUpsertRequest" not in _class_names(tree):
        return ["backend/api/schemas.py must define EnterpriseModelConfigUpsertRequest"]
    return []


def _check_main_module() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(MAIN_MODULE)
    imports = _imported_names(tree)

    if "create_model_config_router" not in imports:
        errors.append("backend/main.py must import create_model_config_router")
    if "ModelConfigRouteDependencies" not in imports:
        errors.append("backend/main.py must import ModelConfigRouteDependencies")
    if "build_configured_postgres_model_config_service" not in imports:
        errors.append("backend/main.py must import the configured PostgreSQL service builder")
    if not _calls_name(tree, "create_model_config_router"):
        errors.append("backend/main.py must mount the model config router")
    if "tenant_hint_from_user_id" not in _attribute_names(tree) and (
        "tenant_hint_from_user_id" not in _string_constants(tree)
    ):
        source = MAIN_MODULE.read_text(encoding="utf-8")
        if "tenant_hint_from_user_id=tenant_hint_from_user_id" not in source:
            errors.append("backend/main.py must wire tenant boundary into the route")

    return errors


def main() -> int:
    errors = [*_check_route_module(), *_check_schema_module(), *_check_main_module()]

    print("Phase 2 PostgreSQL model config API route gate")
    print("- route: /enterprise/platform/model-configs/upsert")
    print("- persistence: PostgreSQL service boundary only")
    print("- response: secret-safe service payload")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: model config API route is wired through the PostgreSQL service boundary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
