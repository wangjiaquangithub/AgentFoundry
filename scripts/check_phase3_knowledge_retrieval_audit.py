#!/usr/bin/env python3
"""Check Phase 3 knowledge retrieval event and audit persistence wiring."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
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
    service_source = _read(SERVICE_MODULE)
    main_source = _read(MAIN_MODULE)

    for needle in (
        "retrieval_event_writer: RetrievalEventWriter | None = None",
        "audit_event_writer: AuditEventWriter | None = None",
        "RetrievalEventRecord(",
        "AuditEventRecord(",
        "append_retrieval_event",
        "append_audit_event",
        '"knowledge_base.retrieved"',
        '"retrieval_mode"',
        '"bound_knowledge_base_ids"',
        '"ready_knowledge_base_ids"',
        '"blocked_knowledge_base_ids"',
    ):
        _assert_contains(
            service_source,
            needle,
            "knowledge retrieval persistence service",
        )

    _assert_contains(
        api_source,
        'user_id=request.headers.get("X-User-ID") or None',
        "knowledge retrieval actor propagation",
    )

    for needle in (
        "retrieval_event_writer=PostgresRetrievalEventWriteRepository(database)",
        "audit_event_writer=PostgresAuditEventWriteRepository(database)",
        "now=now_iso",
    ):
        _assert_contains(
            main_source,
            needle,
            "main PostgreSQL retrieval audit wiring",
        )

    retrieval_builder = main_source.split(
        "def _build_knowledge_retrieval_service", 1
    )[1].split("def _build_knowledge_ingestion_service", 1)[0]
    for forbidden in (
        "SQLite",
        "PLATFORM_DEV_KNOWLEDGE_PATH",
        "DevKnowledgeRepository",
        "PlatformDevKnowledgeService",
        "jsonl",
    ):
        if forbidden in retrieval_builder:
            _fail(
                "knowledge retrieval persistence builder must not use "
                f"{forbidden!r}"
            )

    print("OK: Phase 3 knowledge retrieval writes retrieval and audit events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
