#!/usr/bin/env python3
"""Check Phase 3 knowledge retrieval event and audit persistence wiring."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_MODULE = ROOT / "backend" / "api" / "knowledge.py"
SERVICE_MODULE = ROOT / "backend" / "services" / "knowledge.py"
RETRIEVAL_EVENTS_MODULE = ROOT / "backend" / "persistence" / "retrieval_events.py"
AUDIT_EVENTS_MODULE = ROOT / "backend" / "persistence" / "audit_events.py"
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
    retrieval_events_source = _read(RETRIEVAL_EVENTS_MODULE)
    audit_events_source = _read(AUDIT_EVENTS_MODULE)
    main_source = _read(MAIN_MODULE)

    for needle in (
        "retrieval_event_writer: RetrievalEventWriter | None = None",
        "audit_event_writer: AuditEventWriter | None = None",
        "RetrievalEventRecord(",
        "AuditEventRecord(",
        "append_retrieval_event",
        "persisted_event = self._retrieval_event_writer.append_retrieval_event",
        "event_id=persisted_event.id",
        "created_at=persisted_event.created_at",
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

    for needle in (
        "def append_retrieval_event(",
        ") -> RetrievalEventRecord:",
        "RETURNING id, tenant_id, agent_run_id, knowledge_base_id",
        "row = cursor.fetchone()",
        "Retrieval event insert did not return a row.",
        "return _retrieval_event_from_row(dict(row))",
    ):
        _assert_contains(
            retrieval_events_source,
            needle,
            "PostgreSQL retrieval event write repository",
        )

    for needle in (
        "def append_audit_event(",
        ") -> AuditEventRecord:",
        "RETURNING id, tenant_id, actor_user_id, event_type",
        "resource_type AS target_type",
        "resource_id AS target_id",
        "metadata AS payload",
        "row = cursor.fetchone()",
        "Audit event upsert did not return a row.",
        "return _audit_event_from_row(dict(row))",
    ):
        _assert_contains(
            audit_events_source,
            needle,
            "PostgreSQL audit event write repository",
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
