#!/usr/bin/env python3
"""Check PostgreSQL knowledge readiness service composition stays explicit."""

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
    build_service = _function_node(
        tree,
        "build_postgres_knowledge_document_readiness_service",
    )
    build_configured = _function_node(
        tree,
        "build_configured_postgres_knowledge_document_readiness_service",
    )
    if build_service is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_postgres_knowledge_document_readiness_service(database)",
        )
    else:
        for name in (
            "PlatformKnowledgeDocumentReadinessService",
            "PostgresKnowledgeBaseReadRepository",
            "PostgresDocumentReadRepository",
            "PostgresDocumentChunkReadRepository",
            "PostgresEmbeddingRecordReadRepository",
            "PostgresModelConfigReadRepository",
        ):
            if not _references_name(build_service, name):
                errors.append(
                    "build_postgres_knowledge_document_readiness_service must "
                    f"compose {name}",
                )

    if build_configured is None:
        errors.append(
            "backend/services/composition.py must define "
            "build_configured_postgres_knowledge_document_readiness_service()",
        )
    else:
        if not _calls_name(build_configured, "create_configured_postgres_database"):
            errors.append(
                "configured knowledge readiness service factory must use the "
                "configured PostgreSQL database boundary",
            )
        if not _calls_name(
            build_configured,
            "build_postgres_knowledge_document_readiness_service",
        ):
            errors.append(
                "configured knowledge readiness service factory must delegate "
                "to the PostgreSQL service factory",
            )

    source = FACTORY_MODULE.read_text(encoding="utf-8")
    for forbidden in ("SQLite", "sqlite", "FastAPI", "APIRouter"):
        if forbidden in source:
            errors.append(
                "knowledge readiness service factory must stay PostgreSQL-only "
                f"and API-free; found {forbidden}",
            )
    return errors


def _check_main_not_wiring_readiness_service() -> list[str]:
    tree = _parse_module(MAIN_MODULE)
    readiness_builder = _function_node(
        tree,
        "_build_knowledge_document_readiness_service",
    )
    if readiness_builder is None:
        return [
            "backend/main.py must define "
            "_build_knowledge_document_readiness_service",
        ]

    errors: list[str] = []
    if not _calls_name(
        readiness_builder,
        "build_configured_postgres_knowledge_document_readiness_service",
    ):
        errors.append(
            "backend/main.py _build_knowledge_document_readiness_service must "
            "delegate to services.composition",
        )

    for name in (
        "PostgresKnowledgeBaseReadRepository",
        "PostgresDocumentReadRepository",
        "PostgresDocumentChunkReadRepository",
        "PostgresEmbeddingRecordReadRepository",
        "PostgresModelConfigReadRepository",
    ):
        if _references_name(readiness_builder, name):
            errors.append(
                "backend/main.py _build_knowledge_document_readiness_service "
                f"must not directly wire {name}",
            )
    return errors


def main() -> int:
    errors = [
        *_check_factory_contract(),
        *_check_main_not_wiring_readiness_service(),
    ]

    print("Phase 3 PostgreSQL knowledge readiness composition gate")
    print("- factory: backend/services/composition.py")
    print("- service: PlatformKnowledgeDocumentReadinessService")
    print("- persistence: PostgreSQL read repositories")
    print("- API/main direct readiness wiring: blocked")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL knowledge readiness composition is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
