#!/usr/bin/env python3
"""Check Phase 3 backend knowledge document API wiring.

This is intentionally static: it verifies the production document path is
wired to PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"
COMPOSITION_MODULE = ROOT / "backend" / "services" / "composition.py"
DOCUMENTS_MODULE = ROOT / "backend" / "persistence" / "documents.py"


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
    documents_source = _read(DOCUMENTS_MODULE)

    for schema_name in (
        "class EnterpriseKnowledgeDocumentsRequest",
        "class EnterpriseKnowledgeDocumentDetailRequest",
        "class EnterpriseKnowledgeDocumentUpsertRequest",
    ):
        _assert_contains(schema_source, schema_name, "knowledge document schemas")

    for endpoint in (
        '"/enterprise/platform/knowledge/documents"',
        '"/enterprise/platform/knowledge/documents/detail"',
        '"/enterprise/platform/knowledge/documents/upsert"',
    ):
        _assert_contains(api_source, endpoint, "knowledge document endpoint")

    _assert_contains(
        api_source,
        "Production knowledge document reads require PostgreSQL",
        "PostgreSQL-only unavailable guard",
    )
    _assert_contains(
        api_source,
        "list_documents",
        "knowledge document list repository call",
    )
    _assert_contains(
        api_source,
        "get_document",
        "knowledge document detail repository call",
    )
    _assert_contains(
        api_source,
        "list_document_chunks",
        "knowledge document chunk repository call",
    )
    _assert_contains(
        api_source,
        "Production knowledge document writes require PostgreSQL",
        "PostgreSQL-only write unavailable guard",
    )
    _assert_contains(
        api_source,
        "DocumentRecord(",
        "knowledge document upsert record construction",
    )
    _assert_contains(
        api_source,
        "upsert_document",
        "knowledge document upsert repository call",
    )
    _assert_contains(
        main_source,
        "create_knowledge_documents_router",
        "main router include",
    )

    for repository_name in (
        "PostgresDocumentReadRepository",
        "PostgresDocumentWriteRepository",
        "PostgresDocumentChunkReadRepository",
    ):
        _assert_contains(
            composition_source,
            repository_name,
            "composition PostgreSQL document repository wiring",
        )
    _assert_contains(
        documents_source,
        "WHERE documents.tenant_id = EXCLUDED.tenant_id",
        "tenant-safe document upsert conflict guard",
    )
    _assert_contains(
        documents_source,
        "RETURNING id, tenant_id, knowledge_base_id",
        "document upsert persisted record return",
    )

    forbidden_api_terms = {
        "SQLiteDocument",
        "SQLiteKnowledge",
        "create_sqlite",
        "jsonl",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
    }
    for term in forbidden_api_terms:
        if term in api_source:
            _fail(f"knowledge document API must not use {term!r}")

    print("OK: Phase 3 knowledge document API is wired to PostgreSQL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
