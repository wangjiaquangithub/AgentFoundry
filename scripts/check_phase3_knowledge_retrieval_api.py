#!/usr/bin/env python3
"""Check Phase 3 backend knowledge retrieval API wiring.

This static check verifies the production retrieval API is wired through
PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "knowledge.py"
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
    service_source = _read(SERVICE_MODULE)
    main_source = _read(MAIN_MODULE)

    _assert_contains(
        schema_source,
        "class EnterpriseKnowledgeRetrieveRequest",
        "knowledge retrieval request schema",
    )
    _assert_contains(
        api_source,
        '"/enterprise/platform/knowledge/retrieve"',
        "knowledge retrieval endpoint",
    )
    _assert_contains(
        api_source,
        "Production knowledge retrieval requires PostgreSQL",
        "PostgreSQL-only unavailable guard",
    )
    _assert_contains(
        service_source,
        "class PlatformKnowledgeRetrievalService",
        "knowledge retrieval service",
    )
    _assert_contains(
        service_source,
        '"deterministic_lexical"',
        "honest retrieval mode marker",
    )
    _assert_contains(
        main_source,
        "create_knowledge_retrieval_router",
        "main router include",
    )
    _assert_contains(
        main_source,
        "_build_knowledge_retrieval_service",
        "main retrieval service builder",
    )

    for repository_name in (
        "PostgresKnowledgeBaseReadRepository",
        "PostgresDocumentReadRepository",
        "PostgresDocumentChunkReadRepository",
    ):
        _assert_contains(
            main_source,
            repository_name,
            "main PostgreSQL retrieval repository wiring",
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
            _fail(f"knowledge retrieval API must not use {term!r}")

    print("OK: Phase 3 knowledge retrieval API is wired to PostgreSQL reads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
