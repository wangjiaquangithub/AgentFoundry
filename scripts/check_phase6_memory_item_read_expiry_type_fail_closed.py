#!/usr/bin/env python3
"""Validate fail-closed expiry-time types for memory-item reads."""

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


def memory_row(*, expires_at: Any) -> dict[str, Any]:
    return {
        "id": "memory-1",
        "tenant_id": "acme",
        "user_id": "acme:alice",
        "agent_id": None,
        "session_id": None,
        "content": "typed expiry time",
        "source_run_id": None,
        "metadata": {},
        "expires_at": expires_at,
        "created_at": "2026-07-23T00:00:00+00:00",
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


def read_operations(expires_at: Any) -> tuple[Callable[[], Any], ...]:
    repository = PostgresMemoryItemReadRepository(
        FakePostgresDatabase(memory_row(expires_at=expires_at))
    )
    return (
        lambda: repository.list_memory_items(tenant_id="acme"),
        lambda: repository.get_memory_item(
            tenant_id="acme",
            memory_item_id="memory-1",
        ),
    )


def check_malformed_expiry_types_fail_closed() -> list[str]:
    errors: list[str] = []
    for label, expires_at in (("integer", 7), ("list", [])):
        for operation_name, operation in zip(
            ("list", "get"), read_operations(expires_at), strict=True
        ):
            try:
                operation()
            except ValueError as exc:
                if str(exc) != "Memory item memory-1 has an invalid expiry time.":
                    errors.append(
                        f"{operation_name} {label} expiry must raise the stable error"
                    )
            except TypeError:
                errors.append(
                    f"{operation_name} {label} expiry must normalize to ValueError"
                )
            else:
                errors.append(
                    f"{operation_name} must reject {label} returned expiry values"
                )
    return errors


def check_supported_expiry_types_are_accepted() -> list[str]:
    errors: list[str] = []
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    for label, expires_at in (("permanent", None), ("string", future)):
        for operation_name, operation in zip(
            ("list", "get"), read_operations(expires_at), strict=True
        ):
            try:
                result = operation()
            except ValueError:
                errors.append(
                    f"{operation_name} must accept {label} expiry values"
                )
                continue
            if result is None or result == []:
                errors.append(
                    f"{operation_name} must return records with {label} expiry values"
                )
    return errors


def check_source_and_gate() -> list[str]:
    source = MEMORY_ITEMS.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    validator_source = source.split(
        "def _validate_memory_item_not_expired(", maxsplit=1
    )[1].split("\n\ndef ", maxsplit=1)[0]
    if "except (TypeError, ValueError)" not in validator_source:
        errors.append("read expiry validation must normalize non-string values")
    check_name = "check_phase6_memory_item_read_expiry_type_fail_closed.py"
    if check_name not in gate_source:
        errors.append("Phase 6 backend gate must run the read expiry type check")
    return errors


def main() -> int:
    errors = [
        *check_malformed_expiry_types_fail_closed(),
        *check_supported_expiry_types_are_accepted(),
        *check_source_and_gate(),
    ]
    if errors:
        for error in errors:
            print(
                f"[phase6-memory-item-read-expiry-type] {error}",
                file=sys.stderr,
            )
        return 1
    print("[phase6-memory-item-read-expiry-type] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
