#!/usr/bin/env python3
"""Validate the Phase 6 tool-call audit evidence contract."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT_SOURCE = ROOT / "backend" / "audit.py"
MAIN_SOURCE = ROOT / "backend" / "main.py"
PERSISTENCE_SOURCE = ROOT / "backend" / "persistence" / "tool_calls.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.audit import ToolAuditLogger  # noqa: E402
from backend.persistence import ToolCallRecord  # noqa: E402


SENSITIVE_VALUE_FIXTURE = "audit-sensitive-value"


class RecordingToolCallWriter:
    def __init__(self, *, failure: Exception | None = None) -> None:
        self.records: list[ToolCallRecord] = []
        self.failure = failure

    def append_tool_call(self, record: ToolCallRecord) -> ToolCallRecord:
        if self.failure is not None:
            raise self.failure
        self.records.append(record)
        return record


def capture(
    logger: ToolAuditLogger,
    *,
    call,
):
    return logger.capture(
        user_id="acme:alice",
        tenant="acme",
        agent_id="agent-support",
        session_id="session-42",
        tool_name="crm_lookup",
        connector="crm:production",
        inputs={
            "customer_id": "customer-7",
            "api_key": SENSITIVE_VALUE_FIXTURE,
            "context": {"password": SENSITIVE_VALUE_FIXTURE},
        },
        call=call,
    )


def check_success_audit() -> list[str]:
    writer = RecordingToolCallWriter()
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = ToolAuditLogger(
            Path(tmpdir) / "tool_calls.jsonl",
            tool_call_writer=writer,
            production_mode=True,
        )
        result = capture(
            logger,
            call=lambda: {
                "source": "crm",
                "tenant": "acme",
                "found": True,
                "customer": {"token": SENSITIVE_VALUE_FIXTURE},
            },
        )

    errors: list[str] = []
    if result.get("customer", {}).get("token") != SENSITIVE_VALUE_FIXTURE:
        errors.append("audit capture must preserve the successful tool result")
    if len(writer.records) != 1:
        return errors + ["successful tool call must append exactly one audit record"]

    record = writer.records[0]
    expected_bindings = {
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": "agent-support",
        "session_id": "session-42",
        "tool_name": "crm_lookup",
        "connector": "crm:production",
    }
    if record.tenant_id != expected_bindings.pop("tenant_id"):
        errors.append("audit record must bind the tenant")
    for key, expected in expected_bindings.items():
        if record.inputs.get(key) != expected:
            errors.append(f"audit record must bind {key}")
    if not record.id or not record.created_at or record.completed_at != record.created_at:
        errors.append("audit record must bind a persisted id and completion timestamp")
    if record.inputs.get("arguments", {}).get("api_key") != "<redacted>":
        errors.append("sensitive tool inputs must be redacted")
    if SENSITIVE_VALUE_FIXTURE in repr(record.inputs) or SENSITIVE_VALUE_FIXTURE in repr(record.result):
        errors.append("audit payload must not persist raw sensitive input or result values")
    if record.result != {
        "success": True,
        "duration_ms": record.result.get("duration_ms"),
        "result": {
            "type": "object",
            "source": "crm",
            "tenant": "acme",
            "found": True,
        },
    }:
        errors.append("successful tool audit must persist only the result summary contract")
    return errors


def check_failure_audit() -> list[str]:
    writer = RecordingToolCallWriter()
    with tempfile.TemporaryDirectory() as tmpdir:
        logger = ToolAuditLogger(
            Path(tmpdir) / "tool_calls.jsonl",
            tool_call_writer=writer,
            production_mode=True,
        )

        def fail():
            raise ValueError(f"upstream rejected token {SENSITIVE_VALUE_FIXTURE}")

        try:
            capture(logger, call=fail)
        except ValueError as exc:
            if SENSITIVE_VALUE_FIXTURE not in str(exc):
                return ["audit capture must re-raise the original tool failure"]
        else:
            return ["failed tool call must re-raise its original failure"]

    if len(writer.records) != 1:
        return ["failed tool call must append exactly one audit record"]
    record = writer.records[0]
    errors: list[str] = []
    if record.result.get("success") is not False:
        errors.append("failed tool audit must bind success=false")
    if record.result.get("error") != {"type": "ValueError"}:
        errors.append("failed tool audit must persist only the exception type summary")
    if SENSITIVE_VALUE_FIXTURE in repr(record.inputs) or SENSITIVE_VALUE_FIXTURE in repr(record.result):
        errors.append("failed tool audit must not persist exception or input secrets")
    return errors


def check_production_fail_closed() -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        audit_path = Path(tmpdir) / "tool_calls.jsonl"
        missing_writer = ToolAuditLogger(audit_path, production_mode=True)
        try:
            capture(missing_writer, call=lambda: "ok")
        except RuntimeError as exc:
            if "writer is required" not in str(exc):
                errors.append("missing production writer error must be operator clear")
        else:
            errors.append("production audit must fail closed without a writer")

        failing_writer = ToolAuditLogger(
            audit_path,
            tool_call_writer=RecordingToolCallWriter(
                failure=RuntimeError("database unavailable")
            ),
            production_mode=True,
        )
        try:
            capture(failing_writer, call=lambda: "ok")
        except RuntimeError as exc:
            if "write failed in production mode" not in str(exc):
                errors.append("production write failure must be operator clear")
        else:
            errors.append("production audit write failure must fail closed")
        if audit_path.exists():
            errors.append("production audit failures must not fall back to JSONL")
    return errors


def check_development_jsonl_fallback() -> list[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        audit_path = Path(tmpdir) / "tool_calls.jsonl"
        logger = ToolAuditLogger(audit_path, production_mode=False)
        capture(logger, call=lambda: {"source": "crm", "credential": SENSITIVE_VALUE_FIXTURE})
        event = json.loads(audit_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if event.get("tenant") != "acme" or event.get("success") is not True:
        errors.append("development JSONL fallback must retain scoped audit evidence")
    if SENSITIVE_VALUE_FIXTURE in repr(event):
        errors.append("development JSONL fallback must retain audit redaction")
    return errors


def check_production_wiring_and_gate() -> list[str]:
    audit_source = AUDIT_SOURCE.read_text(encoding="utf-8")
    main_source = MAIN_SOURCE.read_text(encoding="utf-8")
    persistence_source = PERSISTENCE_SOURCE.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "tool_call_writer=build_tool_call_write_repository()" not in main_source:
        errors.append("production composition must inject the PostgreSQL audit writer")
    if "tool_call_reader=build_tool_call_read_repository()" not in main_source:
        errors.append("production composition must inject the PostgreSQL audit reader")
    if "if self._production_mode" not in audit_source or "JSONL remains a local" not in audit_source:
        errors.append("JSONL must remain an explicit non-production fallback")
    if "_validate_write_result(record, persisted)" not in persistence_source:
        errors.append("PostgreSQL audit writes must validate the persisted record")
    if "scripts/check_phase6_tool_call_audit.py" not in gate_source:
        errors.append("Phase 6 backend gate must run the tool-call audit check")
    return errors


def main() -> int:
    errors = (
        check_success_audit()
        + check_failure_audit()
        + check_production_fail_closed()
        + check_development_jsonl_fallback()
        + check_production_wiring_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-tool-call-audit] {error}", file=sys.stderr)
        return 1
    print("[phase6-tool-call-audit] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
