#!/usr/bin/env python3
"""Check PostgreSQL knowledge response service composition stays explicit."""

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


def _knowledge_response_assignment(tree: ast.AST) -> ast.Assign | None:
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "knowledge_response_service":
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
    build_service = _function_node(
        tree,
        "build_postgres_knowledge_response_service",
    )
    build_configured = _function_node(
        tree,
        "build_configured_postgres_knowledge_response_service",
    )
    if build_service is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_postgres_knowledge_response_service(database)",
        )
    else:
        for name in (
            "PlatformKnowledgeResponseService",
            "PostgresRetrievalEventWriteRepository",
            "PostgresAuditEventWriteRepository",
        ):
            if not _references_name(build_service, name):
                errors.append(
                    "build_postgres_knowledge_response_service must compose "
                    f"{name}",
                )

    if build_configured is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_configured_postgres_knowledge_response_service()",
        )
    else:
        if not _calls_name(build_configured, "create_configured_postgres_database"):
            errors.append(
                "configured knowledge response service factory must use the "
                "configured PostgreSQL database boundary",
            )
        if not _calls_name(
            build_configured,
            "build_postgres_knowledge_response_service",
        ):
            errors.append(
                "configured knowledge response service factory must delegate "
                "to the PostgreSQL response service factory",
            )

    source = FACTORY_MODULE.read_text(encoding="utf-8")
    for forbidden in ("SQLite", "sqlite", "FastAPI", "APIRouter"):
        if forbidden in source:
            errors.append(
                "knowledge response service factory must stay PostgreSQL-only "
                f"and API-free; found {forbidden}",
            )
    return errors


def _check_main_not_wiring_response_service() -> list[str]:
    tree = _parse_module(MAIN_MODULE)
    assignment = _knowledge_response_assignment(tree)
    if assignment is None:
        return ["backend/main.py must assign knowledge_response_service"]

    errors: list[str] = []
    if not _calls_name(
        assignment,
        "build_configured_postgres_knowledge_response_service",
    ):
        errors.append(
            "backend/main.py knowledge_response_service must delegate "
            "to services.composition",
        )

    for name in (
        "_build_retrieval_event_write_repository",
        "_build_audit_event_write_repository",
        "PostgresRetrievalEventWriteRepository",
        "PostgresAuditEventWriteRepository",
    ):
        if _references_name(assignment, name):
            errors.append(
                "backend/main.py knowledge_response_service must not directly "
                f"wire {name}",
            )
    return errors


def main() -> int:
    errors = [
        *_check_factory_contract(),
        *_check_main_not_wiring_response_service(),
    ]

    print("Phase 3 PostgreSQL knowledge response composition gate")
    print("- factory: backend/services/composition.py")
    print("- service: PlatformKnowledgeResponseService")
    print("- persistence: PostgreSQL retrieval and audit event writers")
    print("- API/main direct response event wiring: blocked")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL knowledge response composition is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
