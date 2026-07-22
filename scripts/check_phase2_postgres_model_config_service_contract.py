#!/usr/bin/env python3
"""Check PostgreSQL model config service write and audit contract."""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVICE_MODULE = ROOT / "backend" / "services" / "model_configs.py"
BACKEND_DIR = ROOT / "backend"
PERSISTENCE_MODULE = ROOT / "backend" / "persistence" / "model_configs.py"


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _class_node(tree: ast.AST, class_name: str) -> ast.ClassDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    return None


def _function_names(class_node: ast.ClassDef) -> set[str]:
    return {
        node.name
        for node in class_node.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


def _calls_method(tree: ast.AST, method_name: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == method_name:
                return True
    return False


def _contains_string(path: Path, token: str) -> bool:
    return token in path.read_text(encoding="utf-8")


def _python_modules_under(path: Path) -> list[Path]:
    return sorted(
        module
        for module in path.rglob("*.py")
        if "__pycache__" not in module.parts and module != PERSISTENCE_MODULE
    )


def _calls_upsert_model_config(path: Path) -> bool:
    tree = _parse_module(path)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Attribute) and node.func.attr == "upsert_model_config":
            return True
        if isinstance(node.func, ast.Name) and node.func.id == "upsert_model_config":
            return True
    return False


def _check_service_contract() -> list[str]:
    errors: list[str] = []
    if not SERVICE_MODULE.exists():
        return ["missing backend/services/model_configs.py service contract"]

    tree = _parse_module(SERVICE_MODULE)
    service = _class_node(tree, "PlatformModelConfigService")
    if service is None:
        errors.append("backend/services/model_configs.py must define PlatformModelConfigService")
    else:
        methods = _function_names(service)
        for method_name in ("upsert_model_config", "_append_model_config_audit_event"):
            if method_name not in methods:
                errors.append(
                    "PlatformModelConfigService must define "
                    f"{method_name}",
                )

    for class_name in (
        "ModelConfigWriteCommand",
        "ModelConfigWriteRepository",
        "AuditEventWriteRepository",
    ):
        if _class_node(tree, class_name) is None:
            errors.append(f"backend/services/model_configs.py must define {class_name}")

    for token in (
        "ModelConfigRecord(",
        "AuditEventRecord(",
        "append_audit_event(",
        "PostgreSQL audit event write did not return a persisted id.",
        "target_type=\"model_config\"",
        "event_type=\"model_config.upserted\"",
        "config_ref_configured",
    ):
        if not _contains_string(SERVICE_MODULE, token):
            errors.append(
                "PlatformModelConfigService must preserve write/audit contract: "
                f"{token}",
            )

    if not _calls_method(tree, "upsert_model_config"):
        errors.append("PlatformModelConfigService must call upsert_model_config")
    if not _calls_method(tree, "append_audit_event"):
        errors.append("PlatformModelConfigService must call append_audit_event")

    return errors


def _check_no_direct_api_write_exposure() -> list[str]:
    errors: list[str] = []
    allowed = {SERVICE_MODULE}
    offenders = [
        module
        for module in _python_modules_under(BACKEND_DIR)
        if module not in allowed and _calls_upsert_model_config(module)
    ]
    for offender in offenders:
        errors.append(
            "PostgreSQL model config writes must go through "
            f"backend/services/model_configs.py, not {offender.relative_to(ROOT)}",
        )
    return errors


def main() -> int:
    errors = [
        *_check_service_contract(),
        *_check_no_direct_api_write_exposure(),
    ]

    print("Phase 2 PostgreSQL model config service contract gate")
    print("- service: backend/services/model_configs.py")
    print("- write path: PlatformModelConfigService.upsert_model_config")
    print("- audit event: model_config.upserted")
    print("- direct API/main write exposure: blocked")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL model config writes are service-mediated and audited.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
