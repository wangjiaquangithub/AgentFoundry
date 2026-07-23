#!/usr/bin/env python3
"""Validate fail-closed transaction handling for memory-item write results."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from types import TracebackType
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.memory_items import (  # noqa: E402
    MemoryItemRecord,
    PostgresMemoryItemWriteRepository,
)


def memory_record() -> MemoryItemRecord:
    return MemoryItemRecord(
        id="item-1",
        tenant_id="acme",
        user_id="acme:alice",
        agent_id="agent-support",
        session_id="session-1",
        content="remember this",
        source_run_id="run-1",
        metadata={"kind": "preference"},
        expires_at=None,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def memory_row(record: MemoryItemRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "user_id": record.user_id,
        "agent_id": record.agent_id,
        "session_id": record.session_id,
        "content": record.content,
        "source_run_id": record.source_run_id,
        "metadata": record.metadata,
        "expires_at": record.expires_at,
        "created_at": record.created_at,
    }


class FakeCursor:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchone(self) -> dict[str, Any] | None:
        return self._row


class FakeConnection:
    def __init__(self, database: FakePostgresDatabase) -> None:
        self._database = database

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(
        self,
        exception_type: type[BaseException] | None,
        _exception: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self._database.exit_exception_type = exception_type
        return None

    def cursor(self) -> FakeCursor:
        return FakeCursor(self._database.row)


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.exit_exception_type: type[BaseException] | None = None

    def transaction(self) -> FakeConnection:
        return FakeConnection(self)


def check_invalid_results_fail_inside_transaction() -> list[str]:
    record = memory_record()
    mismatched_row = memory_row(record)
    mismatched_row["content"] = "unexpected content"
    errors: list[str] = []
    for label, row in (("missing", None), ("mismatched", mismatched_row)):
        database = FakePostgresDatabase(row)
        try:
            PostgresMemoryItemWriteRepository(database).append_memory_item(record)
        except ValueError:
            pass
        else:
            errors.append(f"{label} write result must fail closed")
        if database.exit_exception_type is not ValueError:
            errors.append(
                f"{label} write result must raise before the transaction exits"
            )
    return errors


def check_valid_result_exits_cleanly() -> list[str]:
    record = memory_record()
    database = FakePostgresDatabase(memory_row(record))
    persisted = PostgresMemoryItemWriteRepository(database).append_memory_item(record)
    errors: list[str] = []
    if persisted != record:
        errors.append("valid write result must be returned unchanged")
    if database.exit_exception_type is not None:
        errors.append("valid write result must allow a clean transaction exit")
    return errors


def check_gate_registration() -> list[str]:
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    check_name = "check_phase6_memory_item_write_result_transaction_fail_closed.py"
    if check_name not in gate_source:
        return ["Phase 6 backend gate must run the write-result transaction check"]
    return []


def main() -> int:
    errors = [
        *check_invalid_results_fail_inside_transaction(),
        *check_valid_result_exits_cleanly(),
        *check_gate_registration(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-write-result-transaction] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-write-result-transaction] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
