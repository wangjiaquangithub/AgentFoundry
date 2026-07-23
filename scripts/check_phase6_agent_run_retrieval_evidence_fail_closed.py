#!/usr/bin/env python3
"""Validate fail-closed agent-run knowledge retrieval evidence persistence."""

from __future__ import annotations

import asyncio
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.knowledge import (  # noqa: E402
    PlatformKnowledgeResponseService,
    PlatformKnowledgeRetrievalServiceError,
)


class ProductionKnowledge:
    async def search(self, **_: Any) -> list[Any]:
        return [
            SimpleNamespace(
                chunk=SimpleNamespace(
                    content=SimpleNamespace(type="text", text="Approval evidence."),
                    source="postgres://knowledge/doc_support",
                    chunk_index=0,
                    total_chunks=1,
                    metadata={"source_type": "postgres"},
                ),
                score=0.91,
                document_id="doc_support",
            )
        ]


class DevKnowledge:
    def search(self, **_: Any) -> list[dict[str, Any]]:
        return []


class EventWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records: list[Any] = []

    def append_retrieval_event(self, record: Any) -> Any:
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


class AuditWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.failure = failure
        self.records: list[Any] = []

    def append_audit_event(self, record: Any) -> Any:
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def build_service(
    *,
    event_writer: EventWriter | None = None,
    audit_writer: AuditWriter | None = None,
    include_event_writer: bool = True,
    include_audit_writer: bool = True,
    include_now: bool = True,
) -> PlatformKnowledgeResponseService:
    return PlatformKnowledgeResponseService(
        retrieval_event_writer=(
            (event_writer or EventWriter()) if include_event_writer else None
        ),
        audit_event_writer=(
            (audit_writer or AuditWriter()) if include_audit_writer else None
        ),
        now=(lambda: "2026-07-23T00:00:00+00:00") if include_now else None,
    )


async def retrieve(service: PlatformKnowledgeResponseService):
    return await service.search_agent_knowledge_bases(
        knowledge_base_service=ProductionKnowledge(),
        dev_knowledge_service=DevKnowledge(),
        dev_knowledge_provider="agentfoundry-dev-local",
        user_id="acme:alice",
        tenant="acme",
        question="approval evidence",
        knowledge_base_ids=["kb_support"],
        agent_run_id="run_phase6_agent_retrieval_fail_closed",
        allow_dev_fallback=False,
    )


async def expect_service_error(
    service: PlatformKnowledgeResponseService,
    label: str,
) -> list[str]:
    try:
        await retrieve(service)
    except PlatformKnowledgeRetrievalServiceError as exc:
        if exc.status_code != 500:
            return [f"{label} must surface as HTTP 500"]
        return []
    return [f"{label} must fail closed"]


async def check_success_contract() -> list[str]:
    event_writer = EventWriter()
    audit_writer = AuditWriter()
    hits, knowledge_error, readiness = await retrieve(
        build_service(event_writer=event_writer, audit_writer=audit_writer),
    )
    errors: list[str] = []
    if knowledge_error is not None or readiness["status"] != "ready" or len(hits) != 1:
        errors.append("successful agent-run retrieval must still return persisted evidence")
    if len(event_writer.records) != 1 or len(audit_writer.records) != 1:
        errors.append(
            "successful agent-run retrieval must persist one event and one audit record"
        )
    return errors


async def check_failure_contract() -> list[str]:
    errors: list[str] = []
    for failure in (RuntimeError("event unavailable"), ValueError("event rejected")):
        errors += await expect_service_error(
            build_service(event_writer=EventWriter(failure=failure)),
            "agent-run retrieval event persistence failure",
        )
    for failure in (RuntimeError("audit unavailable"), ValueError("audit rejected")):
        errors += await expect_service_error(
            build_service(audit_writer=AuditWriter(failure=failure)),
            "agent-run retrieval audit persistence failure",
        )

    blank_event_writer = EventWriter()
    original_event_append = blank_event_writer.append_retrieval_event

    def append_event_without_id(record: Any) -> Any:
        return replace(original_event_append(record), id="")

    blank_event_writer.append_retrieval_event = append_event_without_id
    errors += await expect_service_error(
        build_service(event_writer=blank_event_writer),
        "blank persisted agent-run retrieval event id",
    )

    blank_audit_writer = AuditWriter()
    original_audit_append = blank_audit_writer.append_audit_event

    def append_audit_without_id(record: Any) -> Any:
        return replace(original_audit_append(record), id="")

    blank_audit_writer.append_audit_event = append_audit_without_id
    errors += await expect_service_error(
        build_service(audit_writer=blank_audit_writer),
        "blank persisted agent-run retrieval audit id",
    )

    for kwargs, label in (
        ({"include_event_writer": False}, "missing agent-run retrieval event writer"),
        ({"include_audit_writer": False}, "missing agent-run retrieval audit writer"),
        ({"include_now": False}, "missing agent-run retrieval timestamp provider"),
    ):
        errors += await expect_service_error(build_service(**kwargs), label)
    return errors


def check_route_and_gate() -> list[str]:
    api_source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "except PlatformKnowledgeRetrievalServiceError as exc:" not in api_source:
        errors.append("agent runtime route must preserve retrieval service HTTP semantics")
    if "_raise_service_error(exc)" not in api_source:
        errors.append("agent-run retrieval infrastructure failures must map to HTTP 500")
    if "check_phase6_agent_run_retrieval_evidence_fail_closed.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the agent-run retrieval fail-closed check")
    return errors


async def main() -> int:
    errors = await check_success_contract()
    errors += await check_failure_contract()
    errors += check_route_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-agent-run-retrieval-fail-closed] {error}", file=sys.stderr)
        return 1
    print("[phase6-agent-run-retrieval-fail-closed] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
