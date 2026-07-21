#!/usr/bin/env python3
"""Check Phase 3 backend knowledge embedding record API wiring.

This check is intentionally static: it verifies the production embedding record
path is wired to PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"


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

    for schema_name in (
        "class EnterpriseKnowledgeEmbeddingRecordsRequest",
        "class EnterpriseKnowledgeEmbeddingRecordUpsertRequest",
    ):
        _assert_contains(schema_source, schema_name, "embedding record schemas")

    for endpoint in (
        '"/enterprise/platform/knowledge/embedding-records"',
        '"/enterprise/platform/knowledge/embedding-records/upsert"',
    ):
        _assert_contains(api_source, endpoint, "embedding record endpoint")

    for phrase in (
        "Production knowledge embedding record reads require PostgreSQL",
        "Production knowledge embedding record writes require PostgreSQL",
    ):
        _assert_contains(api_source, phrase, "PostgreSQL-only unavailable guard")

    for call in (
        "list_embedding_records",
        "append_embedding_record",
        "EmbeddingRecord(",
    ):
        _assert_contains(api_source, call, "embedding record repository call")

    for wiring in (
        "create_knowledge_embedding_records_router",
        "KnowledgeEmbeddingRecordsRouteDependencies",
        "PostgresEmbeddingRecordReadRepository",
        "PostgresEmbeddingRecordWriteRepository",
        "_build_knowledge_embedding_record_read_repository",
        "_build_knowledge_embedding_record_write_repository",
    ):
        _assert_contains(main_source, wiring, "main PostgreSQL embedding wiring")

    forbidden_api_terms = {
        "SQLiteEmbedding",
        "create_sqlite",
        "jsonl",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
    }
    for term in forbidden_api_terms:
        if term in api_source:
            _fail(f"embedding record API must not use {term!r}")

    print("OK: Phase 3 embedding records API is wired to PostgreSQL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
