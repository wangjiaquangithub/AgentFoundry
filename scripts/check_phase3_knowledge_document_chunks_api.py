#!/usr/bin/env python3
"""Check Phase 3 backend knowledge document chunk write API wiring.

This is intentionally static: it verifies the production chunk write path is
wired to PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"
CHUNKS_MODULE = ROOT / "backend" / "persistence" / "document_chunks.py"


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
    chunks_source = _read(CHUNKS_MODULE)

    _assert_contains(
        schema_source,
        "class EnterpriseKnowledgeDocumentChunkUpsertRequest",
        "knowledge document chunk upsert schema",
    )
    _assert_contains(
        api_source,
        '"/enterprise/platform/knowledge/document-chunks/upsert"',
        "knowledge document chunk upsert endpoint",
    )
    _assert_contains(
        api_source,
        "Production knowledge document chunk writes require PostgreSQL",
        "PostgreSQL-only chunk write unavailable guard",
    )
    _assert_contains(
        api_source,
        "DocumentChunkRecord(",
        "knowledge document chunk record construction",
    )
    _assert_contains(
        api_source,
        "append_document_chunk",
        "knowledge document chunk write repository call",
    )
    _assert_contains(
        main_source,
        "_build_knowledge_document_chunk_write_repository",
        "main PostgreSQL chunk write repository builder",
    )
    _assert_contains(
        main_source,
        "PostgresDocumentChunkWriteRepository",
        "main PostgreSQL chunk write repository wiring",
    )
    _assert_contains(
        chunks_source,
        "RETURNING id, tenant_id, document_id",
        "document chunk upsert persisted record return",
    )

    forbidden_api_terms = {
        "SQLiteDocumentChunk",
        "SQLiteKnowledge",
        "create_sqlite",
        "jsonl",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
    }
    for term in forbidden_api_terms:
        if term in api_source:
            _fail(f"knowledge document chunk API must not use {term!r}")

    print("OK: Phase 3 knowledge document chunk write API is wired to PostgreSQL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
