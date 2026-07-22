#!/usr/bin/env python3
"""Check Phase 3 knowledge APIs reject local storage as production backing."""

from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"

EXPECTED_GUARDS = {
    "ingest_enterprise_knowledge_document": "ingestion requires PostgreSQL",
    "list_enterprise_knowledge_bases": "base reads require PostgreSQL",
    "read_enterprise_knowledge_base_detail": "base reads require PostgreSQL",
    "upsert_enterprise_knowledge_base": "base writes require PostgreSQL",
    "list_enterprise_knowledge_embedding_records": (
        "embedding record reads require PostgreSQL"
    ),
    "upsert_enterprise_knowledge_embedding_record": (
        "embedding record writes require PostgreSQL"
    ),
    "list_enterprise_knowledge_retrieval_events": (
        "retrieval event reads require PostgreSQL"
    ),
    "read_enterprise_knowledge_retrieval_event_detail": (
        "retrieval event reads require PostgreSQL"
    ),
    "retrieve_enterprise_knowledge": "retrieval requires PostgreSQL",
    "read_enterprise_knowledge_readiness": "readiness requires PostgreSQL",
    "list_enterprise_knowledge_documents": "document reads require PostgreSQL",
    "read_enterprise_knowledge_document_detail": "document reads require PostgreSQL",
    "upsert_enterprise_knowledge_document": "document writes require PostgreSQL",
    "upsert_enterprise_knowledge_document_chunk": (
        "document chunk writes require PostgreSQL"
    ),
}

FORBIDDEN_API_TERMS = (
    "DevKnowledgeRepository",
    "PlatformDevKnowledgeService",
    "PLATFORM_DEV_KNOWLEDGE_PATH",
    "platform_dev_knowledge",
    "backend.data",
    "sqlite3",
    "JSONL",
    "jsonl",
)


def _fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def _constant_strings(node: ast.AST) -> list[str]:
    return [
        value.value
        for value in ast.walk(node)
        if isinstance(value, ast.Constant) and isinstance(value.value, str)
    ]


def _raises_postgres_storage_guard(function: ast.AsyncFunctionDef) -> bool:
    for node in ast.walk(function):
        if not isinstance(node, ast.Raise) or node.exc is None:
            continue
        if not isinstance(node.exc, ast.Call):
            continue
        if not isinstance(node.exc.func, ast.Name) or node.exc.func.id != "HTTPException":
            continue

        status_code = None
        detail = ""
        for keyword in node.exc.keywords:
            if keyword.arg == "status_code" and isinstance(keyword.value, ast.Constant):
                status_code = keyword.value.value
            if keyword.arg == "detail":
                detail = "".join(_constant_strings(keyword.value))

        has_postgres_requirement = (
            "requires PostgreSQL" in detail or "require PostgreSQL" in detail
        )
        if (
            status_code == 503
            and has_postgres_requirement
            and "Local JSON or SQLite storage is not a production" in detail
        ):
            return True
    return False


def main() -> int:
    source = API_MODULE.read_text(encoding="utf-8")
    for term in FORBIDDEN_API_TERMS:
        if term in source:
            _fail(f"knowledge API must not reference local storage term {term!r}")

    tree = ast.parse(source, filename=str(API_MODULE))
    functions = {
        node.name: node for node in ast.walk(tree) if isinstance(node, ast.AsyncFunctionDef)
    }

    missing_functions = sorted(set(EXPECTED_GUARDS) - set(functions))
    if missing_functions:
        _fail("knowledge API is missing route functions: " + ", ".join(missing_functions))

    missing_guards = [
        f"{function_name} ({label})"
        for function_name, label in EXPECTED_GUARDS.items()
        if not _raises_postgres_storage_guard(functions[function_name])
    ]
    if missing_guards:
        _fail(
            "knowledge API routes are missing PostgreSQL production guards: "
            + ", ".join(missing_guards)
        )

    print("OK: Phase 3 knowledge APIs reject local storage in production paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
