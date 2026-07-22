#!/usr/bin/env python3
"""Check PostgreSQL knowledge repository providers live in composition."""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FACTORY_MODULE = ROOT / "backend" / "services" / "composition.py"
MAIN_MODULE = ROOT / "backend" / "main.py"

REPOSITORY_FACTORIES = {
    "build_configured_postgres_knowledge_base_read_repository": (
        "PostgresKnowledgeBaseReadRepository",
    ),
    "build_configured_postgres_knowledge_base_write_repository": (
        "PostgresKnowledgeBaseWriteRepository",
    ),
    "build_configured_postgres_knowledge_document_read_repository": (
        "PostgresDocumentReadRepository",
    ),
    "build_configured_postgres_knowledge_document_write_repository": (
        "PostgresDocumentWriteRepository",
    ),
    "build_configured_postgres_knowledge_document_chunk_read_repository": (
        "PostgresDocumentChunkReadRepository",
    ),
    "build_configured_postgres_knowledge_document_chunk_write_repository": (
        "PostgresDocumentChunkWriteRepository",
    ),
    "build_configured_postgres_knowledge_embedding_record_read_repository": (
        "PostgresEmbeddingRecordReadRepository",
    ),
    "build_configured_postgres_knowledge_embedding_record_write_repository": (
        "PostgresEmbeddingRecordWriteRepository",
    ),
}

MAIN_BUILDERS = {
    "_build_knowledge_base_read_repository": (
        "build_configured_postgres_knowledge_base_read_repository",
    ),
    "_build_knowledge_base_write_repository": (
        "build_configured_postgres_knowledge_base_write_repository",
    ),
    "_build_knowledge_document_read_repository": (
        "build_configured_postgres_knowledge_document_read_repository",
    ),
    "_build_knowledge_document_write_repository": (
        "build_configured_postgres_knowledge_document_write_repository",
    ),
    "_build_knowledge_document_chunk_read_repository": (
        "build_configured_postgres_knowledge_document_chunk_read_repository",
    ),
    "_build_knowledge_document_chunk_write_repository": (
        "build_configured_postgres_knowledge_document_chunk_write_repository",
    ),
    "_build_knowledge_embedding_record_read_repository": (
        "build_configured_postgres_knowledge_embedding_record_read_repository",
    ),
    "_build_knowledge_embedding_record_write_repository": (
        "build_configured_postgres_knowledge_embedding_record_write_repository",
    ),
}

FORBIDDEN_MAIN_DIRECT_WIRING = (
    "PostgresKnowledgeBaseReadRepository",
    "PostgresKnowledgeBaseWriteRepository",
    "PostgresDocumentReadRepository",
    "PostgresDocumentWriteRepository",
    "PostgresDocumentChunkReadRepository",
    "PostgresDocumentChunkWriteRepository",
    "PostgresEmbeddingRecordReadRepository",
    "PostgresEmbeddingRecordWriteRepository",
    "create_configured_postgres_database",
)


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _function_node(tree: ast.AST, function_name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return node
    return None


def _references_name(node: ast.AST, name: str) -> bool:
    return any(
        isinstance(child, ast.Name) and child.id == name for child in ast.walk(node)
    )


def _calls_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
            if child.func.id == name:
                return True
    return False


def _check_composition_factories() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(FACTORY_MODULE)
    source = FACTORY_MODULE.read_text(encoding="utf-8")

    for factory_name, repository_names in REPOSITORY_FACTORIES.items():
        factory = _function_node(tree, factory_name)
        if factory is None:
            errors.append(f"backend/services/composition.py must define {factory_name}")
            continue

        if not _calls_name(factory, "create_configured_postgres_database"):
            errors.append(f"{factory_name} must use configured PostgreSQL database")

        for repository_name in repository_names:
            if not _calls_name(factory, repository_name):
                errors.append(f"{factory_name} must return {repository_name}(database)")

    for forbidden in ("SQLite", "sqlite", "FastAPI", "APIRouter"):
        if forbidden in source:
            errors.append(
                "knowledge repository factories must stay PostgreSQL-only "
                f"and API-free; found {forbidden}",
            )

    return errors


def _check_main_builders_delegate() -> list[str]:
    errors: list[str] = []
    tree = _parse_module(MAIN_MODULE)

    for builder_name, factory_names in MAIN_BUILDERS.items():
        builder = _function_node(tree, builder_name)
        if builder is None:
            errors.append(f"backend/main.py must define {builder_name}")
            continue

        expected_factory = factory_names[0]
        if not _calls_name(builder, expected_factory):
            errors.append(f"backend/main.py {builder_name} must delegate to {expected_factory}")

        for forbidden in FORBIDDEN_MAIN_DIRECT_WIRING:
            if _references_name(builder, forbidden):
                errors.append(
                    f"backend/main.py {builder_name} must not directly wire {forbidden}",
                )

    return errors


def main() -> int:
    errors = [
        *_check_composition_factories(),
        *_check_main_builders_delegate(),
    ]

    print("Phase 3 PostgreSQL knowledge repository composition gate")
    print("- factories: backend/services/composition.py")
    print("- API dependency builders: backend/main.py")
    print("- production persistence: PostgreSQL repositories")
    print("- main direct repository wiring: blocked")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL knowledge repository providers are composed explicitly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
