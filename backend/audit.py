# -*- coding: utf-8 -*-
"""JSONL audit logging for enterprise tool calls."""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol, TypeVar
from uuid import uuid4

from backend.persistence import ToolCallRecord


LOGGER = logging.getLogger(__name__)

T = TypeVar("T")

MAX_STRING_LENGTH = 160
MAX_LIST_ITEMS = 20
SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "credential",
    "password",
    "secret",
    "token",
)


class ToolCallWriteRepository(Protocol):
    """Persistence boundary for production tool-call audit writes."""

    def append_tool_call(self, record: ToolCallRecord) -> None:
        """Persist one tool-call audit record."""


class ToolAuditLogger:
    """Persist compact tool-call audit events with JSONL as local fallback."""

    def __init__(
        self,
        path: Path | str,
        *,
        enabled: bool = True,
        tool_call_writer: ToolCallWriteRepository | None = None,
    ) -> None:
        self.path = Path(path).expanduser()
        self.enabled = enabled
        self._tool_call_writer = tool_call_writer
        self._lock = threading.Lock()

    @classmethod
    def from_env(
        cls,
        default_path: Path,
        *,
        tool_call_writer: ToolCallWriteRepository | None = None,
    ) -> "ToolAuditLogger":
        """Build a logger from enterprise audit environment variables."""
        enabled_value = os.getenv("ENTERPRISE_AUDIT_ENABLED", "1").lower().strip()
        enabled = enabled_value not in {"0", "false", "no", "off"}
        path = os.getenv("ENTERPRISE_AUDIT_LOG_PATH")
        return cls(
            Path(path).expanduser() if path else default_path,
            enabled=enabled,
            tool_call_writer=tool_call_writer,
        )

    def capture(
        self,
        *,
        user_id: str,
        tenant: str,
        agent_id: str,
        session_id: str,
        tool_name: str,
        connector: str,
        inputs: dict[str, Any],
        call: Callable[[], T],
    ) -> T:
        """Run a tool call and write one success/failure audit event."""
        if not self.enabled:
            return call()

        started_at = datetime.now(timezone.utc)
        started = time.perf_counter()
        base_event: dict[str, Any] = {
            "schema_version": 1,
            "event_id": uuid4().hex,
            "event_type": "enterprise_tool_call",
            "timestamp": _format_timestamp(started_at),
            "user_id": user_id,
            "tenant": tenant,
            "agent_id": agent_id,
            "session_id": session_id,
            "tool_name": tool_name,
            "connector": connector,
            "inputs": _summarize_inputs(inputs),
        }

        try:
            result = call()
        except Exception as exc:
            self._write(
                {
                    **base_event,
                    "duration_ms": _duration_ms(started),
                    "success": False,
                    "error": {
                        "type": type(exc).__name__,
                        "message": _truncate(str(exc)),
                    },
                },
            )
            raise

        self._write(
            {
                **base_event,
                "duration_ms": _duration_ms(started),
                "success": True,
                "result": _summarize_result(result),
            },
        )
        return result

    def query(
        self,
        *,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        tool_name: str | None = None,
        success: bool | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Return filtered audit events from the JSONL log, newest first."""
        normalized_limit = max(1, min(limit, 200))
        if not self.enabled or not self.path.exists():
            return []

        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except OSError as exc:
            LOGGER.warning("Failed to read enterprise audit log: %s", exc)
            return []

        filters = {
            key: value
            for key, value in {
                "tenant": tenant,
                "user_id": user_id,
                "agent_id": agent_id,
                "tool_name": tool_name,
            }.items()
            if value
        }
        events: list[dict[str, Any]] = []
        for line in reversed(lines):
            if len(events) >= normalized_limit:
                break
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict) and all(
                event.get(key) == value for key, value in filters.items()
            ) and (success is None or event.get("success") is success):
                events.append(event)
        return events

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return recent audit events from the JSONL log, newest first."""
        return self.query(limit=limit)

    def _write(self, event: dict[str, Any]) -> None:
        """Best-effort audit write; storage failure should not break tool calls."""
        if self._tool_call_writer is not None:
            try:
                self._tool_call_writer.append_tool_call(_event_to_tool_call_record(event))
                return
            except Exception as exc:
                LOGGER.warning(
                    "Failed to write enterprise audit event to PostgreSQL: %s",
                    exc,
                )

        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            line = json.dumps(event, ensure_ascii=False, sort_keys=True)
            with self._lock:
                with self.path.open("a", encoding="utf-8") as file:
                    file.write(f"{line}\n")
        except OSError as exc:
            LOGGER.warning("Failed to write enterprise audit log: %s", exc)


def _event_to_tool_call_record(event: dict[str, Any]) -> ToolCallRecord:
    success = event.get("success") is True
    result: dict[str, Any] = {
        "success": success,
        "duration_ms": event.get("duration_ms"),
    }
    if success:
        result["result"] = event.get("result")
    else:
        result["error"] = event.get("error")

    return ToolCallRecord(
        id=str(event["event_id"]),
        tenant_id=str(event["tenant"]),
        agent_run_id=None,
        tool_id=None,
        inputs={
            "event_type": event.get("event_type"),
            "schema_version": event.get("schema_version"),
            "user_id": event.get("user_id"),
            "agent_id": event.get("agent_id"),
            "session_id": event.get("session_id"),
            "tool_name": event.get("tool_name"),
            "connector": event.get("connector"),
            "arguments": event.get("inputs", {}),
        },
        result=result,
        allowed=True,
        approval_id=None,
        created_at=str(event["timestamp"]),
        completed_at=str(event["timestamp"]),
    )


def _format_timestamp(value: datetime) -> str:
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _duration_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)


def _summarize_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
    return {
        str(key): "<redacted>" if _is_sensitive_key(str(key)) else _summarize_value(value)
        for key, value in inputs.items()
    }


def _summarize_result(result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {"type": type(result).__name__}

    metadata: dict[str, Any] = {"type": "object"}
    for key in ("source", "tenant", "found", "keyword", "ticket_id", "department"):
        if key in result:
            metadata[key] = _summarize_value(result[key])

    matches = result.get("matches")
    if isinstance(matches, dict):
        metadata["match_count"] = len(matches)
        metadata["matched_keys"] = sorted(str(key) for key in matches)[:MAX_LIST_ITEMS]

    ticket = result.get("ticket")
    if isinstance(ticket, dict):
        if "status" in ticket:
            metadata["ticket_status"] = _summarize_value(ticket["status"])
        metadata["ticket_present"] = True
    elif "ticket" in result:
        metadata["ticket_present"] = ticket is not None

    metrics = result.get("metrics")
    if isinstance(metrics, dict):
        metadata["metric_keys"] = sorted(str(key) for key in metrics)[:MAX_LIST_ITEMS]
    elif "metrics" in result:
        metadata["metrics_present"] = metrics is not None

    for source_key, metadata_key in (
        ("available_policy_keys", "available_policy_key_count"),
        ("available_departments", "available_department_count"),
    ):
        value = result.get(source_key)
        if isinstance(value, list):
            metadata[metadata_key] = len(value)

    return metadata


def _summarize_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return _truncate(value)

    if isinstance(value, dict):
        return {
            "type": "object",
            "size": len(value),
            "keys": sorted(str(key) for key in value)[:MAX_LIST_ITEMS],
        }

    if isinstance(value, (list, tuple, set)):
        return {
            "type": "array",
            "size": len(value),
        }

    return {"type": type(value).__name__}


def _truncate(value: str) -> str:
    if len(value) <= MAX_STRING_LENGTH:
        return value
    return f"{value[:MAX_STRING_LENGTH]}..."


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower()
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)
