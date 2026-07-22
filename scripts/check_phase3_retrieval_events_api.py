#!/usr/bin/env python3
"""Check Phase 3 backend knowledge retrieval event read API wiring.

This is intentionally static: it verifies the production retrieval event read
path is wired to PostgreSQL-backed repositories without opening a database.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class _APIRouter:
    def post(self, *_: Any, **__: Any) -> Any:
        def decorator(func: Any) -> Any:
            return func

        return decorator


class _HTTPException(Exception):
    def __init__(self, *, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


fastapi_stub = types.ModuleType("fastapi")
fastapi_stub.APIRouter = _APIRouter
fastapi_stub.HTTPException = _HTTPException
fastapi_stub.Request = object
sys.modules.setdefault("fastapi", fastapi_stub)

from backend.api.knowledge import _retrieval_event_payload

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

    for field in (
        '"hit_count"',
        '"production_knowledge_hit_count"',
        '"dev_fallback_knowledge_hit_count"',
        '"dev_fallback_knowledge_used"',
        '"knowledge_base_ids"',
        '"document_ids"',
        '"hit_provenance"',
        '"retrieval_event_store": "postgresql"',
    ):
        _assert_contains(api_source, field, "retrieval event evidence payload")

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

    payload = _retrieval_event_payload(
        SimpleNamespace(
            id="ret_1",
            tenant_id="acme",
            agent_run_id="run_1",
            knowledge_base_id="kb_support",
            query="approval evidence",
            hits=[
                {
                    "knowledge_base_id": "kb_support",
                    "document_id": "doc_policy",
                    "chunk_id": "chunk_policy_1",
                    "chunk_index": 0,
                    "source_uri": "postgres://knowledge/doc_policy",
                    "metadata": {"source_type": "postgres"},
                },
                {
                    "knowledge_base_id": "kb_support",
                    "document_id": "doc_policy",
                    "chunk_id": "chunk_policy_2",
                    "chunk_index": 1,
                    "source_uri": "postgres://knowledge/doc_policy",
                    "metadata": {"source_type": "postgres"},
                },
                {
                    "knowledge_base_id": "kb_support",
                    "document_id": "doc_dev",
                    "chunk_id": "chunk_dev_1",
                    "chunk_index": 0,
                    "source": "dev://knowledge/doc_dev",
                    "metadata": {"dev_fallback": True},
                },
            ],
            created_at="2026-01-01T00:00:00+00:00",
        )
    )
    expected_payload = {
        "hit_count": 3,
        "production_knowledge_hit_count": 2,
        "dev_fallback_knowledge_hit_count": 1,
        "dev_fallback_knowledge_used": True,
        "knowledge_base_ids": ["kb_support"],
        "document_ids": ["doc_policy", "doc_dev"],
        "retrieval_event_store": "postgresql",
    }
    for key, expected in expected_payload.items():
        if payload.get(key) != expected:
            _fail(
                "retrieval event payload field "
                f"{key!r} expected {expected!r}, got {payload.get(key)!r}"
            )
    expected_provenance = {
        "knowledge_base_id": "kb_support",
        "document_id": "doc_policy",
        "chunk_id": "chunk_policy_1",
        "chunk_index": 0,
        "source": "postgres://knowledge/doc_policy",
        "source_type": "postgres",
        "dev_fallback": False,
    }
    if payload["hit_provenance"][0] != expected_provenance:
        _fail("retrieval event payload must expose hit provenance")

    print("OK: Phase 3 retrieval event API is wired to PostgreSQL reads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
