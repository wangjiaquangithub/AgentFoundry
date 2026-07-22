#!/usr/bin/env python3
"""Check Phase 3 backend knowledge readiness API wiring.

This is intentionally static: it verifies the production readiness read path is
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

    _assert_contains(
        schema_source,
        "class EnterpriseKnowledgeReadinessRequest",
        "knowledge readiness request schema",
    )
    _assert_contains(
        api_source,
        '"/enterprise/platform/knowledge/readiness"',
        "knowledge readiness endpoint",
    )
    _assert_contains(
        api_source,
        "PlatformKnowledgeDocumentReadinessService",
        "knowledge readiness router",
    )
    _assert_contains(
        api_source,
        "Production knowledge readiness requires PostgreSQL",
        "PostgreSQL-only unavailable guard",
    )
    _assert_contains(
        api_source,
        "build_readiness",
        "knowledge readiness service call",
    )
    _assert_contains(
        main_source,
        "create_knowledge_readiness_router",
        "main router include",
    )
    _assert_contains(
        main_source,
        "_build_knowledge_document_readiness_service",
        "main readiness service builder",
    )

    for repository_name in (
        "PostgresKnowledgeBaseReadRepository",
        "PostgresDocumentReadRepository",
        "PostgresDocumentChunkReadRepository",
        "PostgresEmbeddingRecordReadRepository",
        "PostgresModelConfigReadRepository",
    ):
        _assert_contains(
            composition_source,
            repository_name,
            "composition PostgreSQL readiness repository wiring",
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
            _fail(f"knowledge readiness API must not use {term!r}")

    print("OK: Phase 3 knowledge readiness API is wired to PostgreSQL reads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
