#!/usr/bin/env python3
"""Check that production tool-call audit reads are PostgreSQL authoritative."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.audit import ToolAuditLogger


class FailingToolCallReader:
    def list_tool_calls(self, *, tenant_id: str, limit: int = 20) -> list[object]:
        raise RuntimeError("database unavailable")


def _check_production_read_failure_fails_closed() -> list[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = ToolAuditLogger(
            Path(tmpdir) / "audit.jsonl",
            tool_call_reader=FailingToolCallReader(),
            production_mode=True,
        )
        try:
            logger.query(tenant="acme", limit=10)
        except RuntimeError as exc:
            if "PostgreSQL tool audit read failed in production mode" in str(exc):
                return []
            return [f"read-failure message is not operator clear: {exc}"]
        return ["production audit read failure must fail closed"]


def _check_production_missing_reader_fails_closed() -> list[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = ToolAuditLogger(Path(tmpdir) / "audit.jsonl", production_mode=True)
        try:
            logger.query(tenant="acme", limit=10)
        except RuntimeError as exc:
            if "PostgreSQL tool audit reader is required in production mode" in str(exc):
                return []
            return [f"missing-reader message is not operator clear: {exc}"]
        return ["production tenant-scoped audit reads must require a PostgreSQL reader"]


def _check_development_jsonl_read_remains_available() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        audit_path = Path(tmpdir) / "audit.jsonl"
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        audit_path.write_text(
            (
                '{"tenant":"acme","user_id":"acme_alice","tool_name":"crm_lookup",'
                '"success":true,"timestamp":"2026-01-01T00:00:00Z"}\n'
            ),
            encoding="utf-8",
        )
        logger = ToolAuditLogger(
            audit_path,
            production_mode=False,
        )
        events = logger.query(tenant="acme", user_id="acme_alice", limit=10)
        if len(events) != 1:
            errors.append("development mode must retain JSONL audit reads without PostgreSQL")
        elif events[0].get("tool_name") != "crm_lookup":
            errors.append("development fallback must preserve filtered audit event data")
    return errors


def main() -> int:
    errors = [
        *_check_production_read_failure_fails_closed(),
        *_check_production_missing_reader_fails_closed(),
        *_check_development_jsonl_read_remains_available(),
    ]

    print("Phase 2 PostgreSQL tool audit read authority gate")
    print("- production read failure: fail closed")
    print("- production reader dependency: required for tenant-scoped reads")
    print("- development JSONL read compatibility: retained")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: tool-call audit reads are PostgreSQL-authoritative in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
