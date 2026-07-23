#!/usr/bin/env python3
"""Validate fail-closed created-time types for memory-item reads."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
MEMORY_ITEMS = ROOT / "backend" / "persistence" / "memory_items.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.persistence.memory_items import (  # noqa: E402
    PostgresMemoryItemReadRepository,
)


def memory_row(*, created_at: Any) -> dict[str, Any]:
    return {
        "id": "memory-1",
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": None,
        "session_id": None,
        "content": "typed created time",
        "source_run_id": None,
        "metadata": {},
        "expires_at": None,
        "created_at": created_at,
    }


class FakeCursor:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def execute(self, _query: str, _parameters: tuple[Any, ...]) -> None:
        return None

    def fetchall(self) -> list[dict[str, Any]]:
        return [self._row]

    def fetchone(self) -> dict[str, Any]:
        return self._row


class FakeConnection:
    def __init__(self, row: dict[str, Any]) -> None:
        self._cursor = FakeCursor(row)

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self._cursor


class FakePostgresDatabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self._row = row

    def connect(self) -> FakeConnection:
        return FakeConnection(self._row)


def read_operations(created_at: Any) -> tuple[Callable[[], Any], ...]:
    repository = PostgresMemoryItemReadRepository(
        FakePostgresDatabase(memory_row(created_at=created_at))
    )
    return (
        lambda: repository.list_memory_items(tenant_id="acme"),
        lambda: repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="memory-1",
        ),
    )


def check_malformed_created_at_types_fail_closed() -> list[str]:
    errors: list[str] = []
    for label, created_at in (("integer", 7), ("list", [])):
        for operation_name, operation in zip(
            ("list", "get"), read_operations(created_at), strict=True
        ):
            try:
                operation()
            except ValueError as exc:
                if str(exc) != "Memory item memory-1 has an invalid created time.":
                    errors.append(
                        f"{operation_name} {label} created time must raise the stable error"
                    )
            except TypeError:
                errors.append(
                    f"{operation_name} {label} created time must normalize to ValueError"
                )
            else:
                errors.append(
                    f"{operation_name} must reject {label} returned created times"
                )
    return errors


def check_supported_created_at_types_are_accepted() -> list[str]:
    errors: list[str] = []
    created_at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    for operation_name, operation in zip(
        ("list", "get"), read_operations(created_at), strict=True
    ):
        try:
            result = operation()
        except ValueError:
            errors.append(f"{operation_name} must accept string created times")
            continue
        if result is None or result == []:
            errors.append(f"{operation_name} must return records with string created times")
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_read_created_at(", maxsplit=1
    )[1].split("\n\nclass ", maxsplit=1)[0]
    if "except (TypeError, ValueError)" not in validator_source:
        errors.append("read created-time validation must normalize non-string values")
    check_name = "check_phase6_memory_item_read_created_at_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the read created-time type check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_created_at_types_fail_closed(),
        *check_supported_created_at_types_are_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-created-at-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-created-at-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
