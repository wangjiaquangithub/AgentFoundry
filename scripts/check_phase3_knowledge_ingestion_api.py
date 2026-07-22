#!/usr/bin/env python3
"""Check Phase 3 backend knowledge ingestion API wiring.

This is intentionally static: it verifies the production write path is wired to
PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SCHEMA_MODULE = ROOT / "backend" / "api" / "schemas.py"
MAIN_MODULE = ROOT / "backend" / "main.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "knowledge_ingestion.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def _assert_contains(source: str, needle: str, label: str) -> None:
    if needle not in source:
        _fail(f"{label} is missing {needle!r}")


def _call_names(path: Path) -> set[str]:
    tree = ast.parse(_read(path))
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name):
            names.add(node.func.id)
        elif isinstance(node.func, ast.Attribute):
            names.add(node.func.attr)
    return names


def _function_source(path: Path, function_name: str) -> str:
    source = _read(path)
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function_name:
            return ast.get_source_segment(source, node) or ""
    _fail(f"{function_name} is missing from {path}")


def main() -> int:
    api_source = _read(API_MODULE)
    schema_source = _read(SCHEMA_MODULE)
    main_source = _read(MAIN_MODULE)
    service_source = _read(SERVICE_MODULE)
    ingestion_router_source = _function_source(
        API_MODULE,
        "create_knowledge_ingestion_router",
    )

    _assert_contains(
        schema_source,
        "class EnterpriseKnowledgeIngestRequest",
        "knowledge ingestion request schema",
    )
    _assert_contains(
        api_source,
        '"/enterprise/platform/knowledge/documents/ingest"',
        "knowledge ingestion endpoint",
    )
    _assert_contains(
        api_source,
        "PlatformKnowledgeIngestionService",
        "knowledge ingestion router",
    )
    _assert_contains(
        api_source,
        "Production knowledge ingestion requires PostgreSQL",
        "PostgreSQL-only unavailable guard",
    )
    _assert_contains(
        main_source,
        "create_knowledge_ingestion_router",
        "main router include",
    )
    _assert_contains(
        main_source,
        "PostgresDocumentWriteRepository",
        "main document write repository wiring",
    )
    _assert_contains(
        main_source,
        "PostgresDocumentChunkWriteRepository",
        "main chunk write repository wiring",
    )
    _assert_contains(
        main_source,
        "PostgresEmbeddingRecordWriteRepository",
        "main embedding cleanup repository wiring",
    )

    forbidden_api_terms = {
        "SQLiteDocument",
        "SQLiteKnowledge",
        "create_sqlite",
        "jsonl",
        "append_embedding_record",
        "vector_ref",
    }
    for term in forbidden_api_terms:
        if term in ingestion_router_source:
            _fail(f"knowledge ingestion API must not use {term!r}")

    service_calls = _call_names(SERVICE_MODULE)
    if "append_embedding_record" in service_calls:
        _fail("ingestion service must not create fake embedding records")

    _assert_contains(
        service_source,
        "embedding_required=True",
        "ingestion service embedding handoff",
    )

    print("OK: Phase 3 knowledge ingestion API is wired to PostgreSQL writes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
