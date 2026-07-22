#!/usr/bin/env python3
"""Validate runtime invocation read summaries do not expose provider secrets."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from backend.persistence.runtime_records import (  # noqa: E402
    PostgresRuntimeReadRepository,
)


SECRET_REF = "replace-with-local-secret"
PROVIDER_URL = "https://agentscope-runtime.internal"
API_KEY = "your-api-key"


class FakeCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self.parameters: tuple[Any, ...] | None = None

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...]) -> None:
        self.parameters = parameters

    def fetchall(self) -> list[dict[str, Any]]:
        return self._rows

    def fetchone(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self._cursor


class FakePostgresDatabase:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.cursor = FakeCursor(rows)

    def connect(self) -> FakeConnection:
        return FakeConnection(self.cursor)


def _row() -> dict[str, Any]:
    request_summary = {
        "context": {
            "tenant": "acme",
            "user_id": "acme:alice",
            "session_id": "session-read-redaction",
            "agent_id": "agent-support",
            "metadata": {
                "runtime_provider_config": {
                    "agentscope_runtime_url": PROVIDER_URL,
                    "agentscope_runtime_auth_ref": SECRET_REF,
                },
            },
        },
        "metadata": {
            "runtime_invocation_id": "runtime-invocation-read-redaction",
            "runtime_provider_config": {
                "agentscope_runtime_url": PROVIDER_URL,
                "agentscope_runtime_auth_ref": SECRET_REF,
            },
            "Runtime_Provider_Config": {
                "Agentscope_Runtime_Url": PROVIDER_URL,
                "Agentscope_Runtime_Auth_Ref": SECRET_REF,
            },
            "config_ref": SECRET_REF,
            "Config_Ref": SECRET_REF,
        },
        "Api_Key": API_KEY,
        "question": "Check runtime invocation read redaction.",
    }
    response_summary = {
        "runtime_invocation_id": "runtime-invocation-read-redaction",
        "status": "completed",
        "token_usage": {
            "input_tokens": 12,
            "output_tokens": 4,
        },
        "raw": {
            "provider_request": {
                "config_ref": SECRET_REF,
                "runtime_provider_config": {
                    "agentscope_runtime_url": PROVIDER_URL,
                    "agentscope_runtime_auth_ref": SECRET_REF,
                },
            },
        },
    }
    return {
        "id": "runtime-invocation-read-redaction",
        "tenant_id": "acme",
        "provider_id": "agentscope-platform-adapter",
        "agent_run_id": "agent-run-read-redaction",
        "request_summary": json.dumps(request_summary),
        "response_summary": json.dumps(response_summary),
        "provider_run_id": "provider-run-read-redaction",
        "latency_ms": 25,
        "token_usage": json.dumps({"input_tokens": 12, "output_tokens": 4}),
        "error": None,
        "created_at": "2026-07-22T00:00:00+00:00",
        "completed_at": "2026-07-22T00:00:01+00:00",
    }


def _assert_record_is_redacted(record: Any) -> None:
    payload = repr(
        {
            "request_summary": record.request_summary,
            "response_summary": record.response_summary,
        },
    )
    for leaked in (SECRET_REF, PROVIDER_URL, API_KEY):
        if leaked in payload:
            raise AssertionError(f"runtime invocation read leaked {leaked}: {payload}")

    request_metadata = record.request_summary["metadata"]
    if request_metadata["runtime_provider_config"] != {
        "agentscope_runtime_url": "<configured>",
        "agentscope_runtime_auth_ref": "<configured>",
    }:
        raise AssertionError(f"runtime provider config was not redacted: {record}")
    if request_metadata["config_ref"] != "<configured>":
        raise AssertionError(f"config_ref was not redacted: {record}")
    if request_metadata["Runtime_Provider_Config"] != {
        "Agentscope_Runtime_Url": "<configured>",
        "Agentscope_Runtime_Auth_Ref": "<configured>",
    }:
        raise AssertionError(f"mixed-case runtime config was not redacted: {record}")
    if request_metadata["Config_Ref"] != "<configured>":
        raise AssertionError(f"mixed-case config_ref was not redacted: {record}")
    if record.request_summary["Api_Key"] != "<configured>":
        raise AssertionError(f"api_key was not redacted: {record}")

    response_summary = record.response_summary
    if response_summary["token_usage"]["input_tokens"] != 12:
        raise AssertionError(f"token usage should remain auditable: {record}")
    provider_request = response_summary["raw"]["provider_request"]
    if provider_request["config_ref"] != "<configured>":
        raise AssertionError(f"raw provider config_ref was not redacted: {record}")


def assert_pg_list_invocations_redacts_summaries() -> None:
    database = FakePostgresDatabase([_row()])
    repository = PostgresRuntimeReadRepository(database)  # type: ignore[arg-type]
    records = repository.list_invocations(
        tenant_id="acme",
        provider_id="agentscope-platform-adapter",
        agent_run_id="agent-run-read-redaction",
    )
    if len(records) != 1:
        raise AssertionError(f"expected one runtime invocation record: {records}")
    _assert_record_is_redacted(records[0])


def assert_pg_get_invocation_redacts_summary() -> None:
    database = FakePostgresDatabase([_row()])
    repository = PostgresRuntimeReadRepository(database)  # type: ignore[arg-type]
    record = repository.get_invocation(
        tenant_id="acme",
        runtime_invocation_id="runtime-invocation-read-redaction",
    )
    if record is None:
        raise AssertionError("expected runtime invocation record")
    _assert_record_is_redacted(record)


def main() -> None:
    assert_pg_list_invocations_redacts_summaries()
    assert_pg_get_invocation_redacts_summary()
    print("phase 4.x runtime invocation read redaction checks passed")


if __name__ == "__main__":
    main()
