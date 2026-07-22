#!/usr/bin/env python3
"""Check that production tool-call audit writes are PostgreSQL authoritative."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.audit import ToolAuditLogger
from backend.persistence import ToolCallRecord


class FailingToolCallWriter:
    def append_tool_call(self, record: ToolCallRecord) -> ToolCallRecord:
        raise RuntimeError("database unavailable")


def _capture(logger: ToolAuditLogger) -> str:
    return logger.capture(
        user_id="acme_alice",
        tenant="acme",
        agent_id="agent-support",
        session_id="session-1",
        tool_name="crm_lookup",
        connector="crm",
        inputs={"customer_id": "cust-1", "api_key": "secret"},
        call=lambda: "ok",
    )


def _check_production_write_failure_fails_closed() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        audit_path = Path(tmpdir) / "audit.jsonl"
        logger = ToolAuditLogger(
            audit_path,
            tool_call_writer=FailingToolCallWriter(),
            production_mode=True,
        )
        try:
            _capture(logger)
        except RuntimeError as exc:
            message = str(exc)
            if "PostgreSQL tool audit write failed in production mode" not in message:
                errors.append(f"production failure message is not operator clear: {message}")
        else:
            errors.append("production audit write failure must fail closed")

        if audit_path.exists():
            errors.append("production audit write failure must not fall back to JSONL")
    return errors


def _check_production_missing_writer_fails_closed() -> list[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = ToolAuditLogger(Path(tmpdir) / "audit.jsonl", production_mode=True)
        try:
            _capture(logger)
        except RuntimeError as exc:
            if "PostgreSQL tool audit writer is required in production mode" in str(exc):
                return []
            return [f"missing-writer failure message is not operator clear: {exc}"]
        return ["production audit writes must require a PostgreSQL writer"]


def _check_development_fallback_remains_available() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        audit_path = Path(tmpdir) / "audit.jsonl"
        logger = ToolAuditLogger(
            audit_path,
            tool_call_writer=FailingToolCallWriter(),
            production_mode=False,
        )
        result = _capture(logger)
        if result != "ok":
            errors.append("development fallback must preserve the tool call result")
        if not audit_path.exists():
            errors.append("development fallback must write JSONL when PostgreSQL is down")
        else:
            content = audit_path.read_text(encoding="utf-8")
            if '"tenant": "acme"' not in content:
                errors.append("development fallback JSONL must retain tenant scope")
            if "secret" in content:
                errors.append("development fallback JSONL must redact sensitive inputs")
    return errors


def main() -> int:
    errors = [
        *_check_production_write_failure_fails_closed(),
        *_check_production_missing_writer_fails_closed(),
        *_check_development_fallback_remains_available(),
    ]

    print("Phase 2 PostgreSQL tool audit authority gate")
    print("- production write failure: fail closed")
    print("- production writer dependency: required")
    print("- development JSONL fallback: retained")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: tool-call audit writes are PostgreSQL-authoritative in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
