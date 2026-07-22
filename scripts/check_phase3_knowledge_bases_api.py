#!/usr/bin/env python3
"""Check Phase 3 backend knowledge base API wiring.

This check is intentionally static: it verifies the production knowledge base
path is wired to PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"
REPOSITORY_MODULE = ROOT / "backend" / "persistence" / "knowledge_bases.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def _assert_contains(source: str, needle: str, label: str) -> None:
    if needle not in source:
        _fail(f"{label} is missing {needle!r}")


def main() -> int:
    api_source = _read(API_MODULE)
    schema_source = _read(SCHEMA_MODULE)
    main_source = _read(MAIN_MODULE)
    composition_source = _read(COMPOSITION_MODULE)
    repository_source = _read(REPOSITORY_MODULE)

    for schema_name in (
        "class EnterpriseKnowledgeBasesRequest",
        "class EnterpriseKnowledgeBaseDetailRequest",
        "class EnterpriseKnowledgeBaseUpsertRequest",
    ):
        _assert_contains(schema_source, schema_name, "knowledge base schemas")

    for endpoint in (
        '"/enterprise/platform/knowledge/bases"',
        '"/enterprise/platform/knowledge/bases/detail"',
        '"/enterprise/platform/knowledge/bases/upsert"',
    ):
        _assert_contains(api_source, endpoint, "knowledge base endpoint")

    for phrase in (
        "Production knowledge base reads require PostgreSQL",
        "Production knowledge base writes require PostgreSQL",
    ):
        _assert_contains(api_source, phrase, "PostgreSQL-only unavailable guard")

    for call in (
        "list_knowledge_bases",
        "get_knowledge_base",
        "upsert_knowledge_base",
        "KnowledgeBaseRecord(",
    ):
        _assert_contains(api_source, call, "knowledge base repository call")

    for repository_item in (
        "class PostgresKnowledgeBaseWriteRepository",
        "ON CONFLICT (id) DO UPDATE",
        "WHERE knowledge_bases.tenant_id = EXCLUDED.tenant_id",
        "RETURNING id, tenant_id, name, description, status",
    ):
        _assert_contains(
            repository_source,
            repository_item,
            "PostgreSQL knowledge base repository",
        )

    for wiring in (
        "create_knowledge_bases_router",
        "KnowledgeBasesRouteDependencies",
        "_build_knowledge_base_read_repository",
        "_build_knowledge_base_write_repository",
    ):
        _assert_contains(main_source, wiring, "main PostgreSQL knowledge base wiring")

    for wiring in (
        "PostgresKnowledgeBaseReadRepository",
        "PostgresKnowledgeBaseWriteRepository",
        "build_configured_postgres_knowledge_base_read_repository",
        "build_configured_postgres_knowledge_base_write_repository",
    ):
        _assert_contains(
            composition_source,
            wiring,
            "composition PostgreSQL knowledge base wiring",
        )

    forbidden_api_terms = {
        "SQLiteKnowledgeBase",
        "create_sqlite",
        "jsonl",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
    }
    for term in forbidden_api_terms:
        if term in api_source:
            _fail(f"knowledge base API must not use {term!r}")

    print("OK: Phase 3 knowledge bases API is wired to PostgreSQL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
