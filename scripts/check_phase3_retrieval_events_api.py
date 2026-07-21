#!/usr/bin/env python3
"""Check Phase 3 backend knowledge retrieval event read API wiring.

This is intentionally static: it verifies the production retrieval event read
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
        "class EnterpriseKnowledgeRetrievalEventsRequest",
        "class EnterpriseKnowledgeRetrievalEventDetailRequest",
    ):
        _assert_contains(schema_source, schema_name, "retrieval event schemas")

    for endpoint in (
        '"/enterprise/platform/knowledge/retrieval-events"',
        '"/enterprise/platform/knowledge/retrieval-events/detail"',
    ):
        _assert_contains(api_source, endpoint, "retrieval event endpoint")

    _assert_contains(
        api_source,
        "Production knowledge retrieval event reads require PostgreSQL",
        "PostgreSQL-only unavailable guard",
    )
    _assert_contains(
        api_source,
        "list_retrieval_events",
        "retrieval event list repository call",
    )
    _assert_contains(
        api_source,
        "get_retrieval_event",
        "retrieval event detail repository call",
    )
    _assert_contains(
        main_source,
        "create_knowledge_retrieval_events_router",
        "main router include",
    )
    _assert_contains(
        main_source,
        "PostgresRetrievalEventReadRepository",
        "main PostgreSQL retrieval event read repository wiring",
    )

    forbidden_api_terms = {
        "SQLiteRetrieval",
        "SQLiteKnowledge",
        "create_sqlite",
        "jsonl",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
    }
    for term in forbidden_api_terms:
        if term in api_source:
            _fail(f"retrieval event API must not use {term!r}")

    print("OK: Phase 3 retrieval event API is wired to PostgreSQL reads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
