"""Idempotent AgentScope event projections into Foundry query evidence."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase

_RUN_STATUSES = {"started", "running", "completed", "failed"}
_TOOL_STATUSES = {"started", "completed", "failed"}
_SENSITIVE_KEYS = {"api_key", "authorization", "password", "secret", "token"}


@dataclass(frozen=True)
class AgentScopeEvent:
    event_id: str
    event_type: str
    tenant_id: str
    foundry_run_id: str
    scope_event_id: str
    occurred_at: str
    actor_user_id: str
    runtime_provider: str
    agent_id: str | None = None
    agent_version_id: str | None = None
    scope_session_id: str | None = None
    scope_run_id: str | None = None
    payload: dict[str, Any] | None = None


@dataclass(frozen=True)
class AgentScopeEventProjectionResult:
    event_id: str
    duplicate: bool


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "<redacted>" if key.lower() in _SENSITIVE_KEYS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


class AgentScopeEventProjector:
    """Project one immutable runtime event in a single database transaction."""

    def __init__(self, database: SQLiteDatabase | PostgresDatabase) -> None:
        self._database = database
        self._sqlite = isinstance(database, SQLiteDatabase)

    def project(self, event: AgentScopeEvent) -> AgentScopeEventProjectionResult:
        payload = event.payload or {}
        with self._database.transaction() as connection:
            cursor = connection.cursor()
            if self._is_duplicate(cursor, event):
                return AgentScopeEventProjectionResult(event.event_id, True)
            self._insert_marker(cursor, event, payload)
            if event.event_type.startswith("run."):
                self._project_run(cursor, event, payload)
            elif event.event_type.startswith("tool."):
                self._project_tool(cursor, event, payload)
            else:
                raise ValueError(f"Unsupported AgentScope event type: {event.event_type}")
            self._project_audit(cursor, event, payload)
        return AgentScopeEventProjectionResult(event.event_id, False)

    def _execute(self, cursor: Any, sql: str, params: tuple[Any, ...]) -> Any:
        if not self._sqlite:
            sql = sql.replace("?", "%s")
        return cursor.execute(sql, params)

    def _is_duplicate(self, cursor: Any, event: AgentScopeEvent) -> bool:
        row = self._execute(
            cursor,
            "SELECT event_id FROM agentscope_event_projections "
            "WHERE event_id = ? OR (tenant_id = ? AND scope_event_id = ?)",
            (event.event_id, event.tenant_id, event.scope_event_id),
        ).fetchone()
        return row is not None

    def _insert_marker(self, cursor: Any, event: AgentScopeEvent, payload: dict[str, Any]) -> None:
        self._execute(cursor, """
            INSERT INTO agentscope_event_projections (
              event_id, tenant_id, event_type, foundry_run_id, scope_session_id,
              scope_run_id, scope_event_id, agent_id, agent_version_id,
              actor_user_id, payload, projected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event.event_id, event.tenant_id, event.event_type, event.foundry_run_id,
            event.scope_session_id, event.scope_run_id, event.scope_event_id,
            event.agent_id, event.agent_version_id, event.actor_user_id,
            json.dumps(_redact(payload), ensure_ascii=False), event.occurred_at,
        ))

    def _project_run(self, cursor: Any, event: AgentScopeEvent, payload: dict[str, Any]) -> None:
        status = event.event_type.removeprefix("run.")
        if status not in _RUN_STATUSES:
            raise ValueError(f"Unsupported AgentScope run status: {status}")
        completed_at = event.occurred_at if status in {"completed", "failed"} else None
        existing = self._execute(
            cursor, "SELECT id FROM agent_runs WHERE tenant_id = ? AND id = ?",
            (event.tenant_id, event.foundry_run_id),
        ).fetchone()
        if existing is None:
            self._execute(cursor, """
                INSERT INTO agent_runs (
                  id, tenant_id, agent_id, agent_version_id, user_id, session_id,
                  status, question, answer, runtime_provider, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event.foundry_run_id, event.tenant_id, event.agent_id,
                event.agent_version_id, event.actor_user_id, event.scope_session_id,
                status, str(payload.get("question", "")), payload.get("answer"),
                event.runtime_provider, event.occurred_at, completed_at,
            ))
        else:
            self._execute(cursor, """
                UPDATE agent_runs SET status = ?, answer = COALESCE(?, answer),
                  completed_at = COALESCE(?, completed_at), session_id = COALESCE(?, session_id)
                WHERE tenant_id = ? AND id = ?
            """, (status, payload.get("answer"), completed_at, event.scope_session_id,
                  event.tenant_id, event.foundry_run_id))

    def _project_tool(self, cursor: Any, event: AgentScopeEvent, payload: dict[str, Any]) -> None:
        status = event.event_type.removeprefix("tool.")
        if status not in _TOOL_STATUSES:
            raise ValueError(f"Unsupported AgentScope tool status: {status}")
        tool_call_id = str(payload.get("tool_call_id") or event.scope_event_id)
        inputs = _redact(payload.get("inputs", {}))
        output = _redact(payload.get("output"))
        completed_at = event.occurred_at if status in {"completed", "failed"} else None
        existing = self._execute(cursor, "SELECT id FROM tool_calls WHERE id = ?", (tool_call_id,)).fetchone()
        if existing is None:
            self._execute(cursor, """
                INSERT INTO tool_calls (
                  id, tenant_id, agent_run_id, inputs, result, allowed, created_at,
                  completed_at, tool_name, status, error, input_summary, output_summary
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tool_call_id, event.tenant_id, event.foundry_run_id,
                json.dumps(inputs, ensure_ascii=False), json.dumps(output, ensure_ascii=False),
                event.occurred_at, completed_at, payload.get("tool_name"), status,
                payload.get("error"), json.dumps(inputs, ensure_ascii=False)[:1000],
                json.dumps(output, ensure_ascii=False)[:1000],
            ))
        else:
            self._execute(cursor, """
                UPDATE tool_calls SET result = ?, completed_at = COALESCE(?, completed_at),
                  status = ?, error = ?, output_summary = ? WHERE id = ? AND tenant_id = ?
            """, (json.dumps(output, ensure_ascii=False), completed_at, status,
                  payload.get("error"), json.dumps(output, ensure_ascii=False)[:1000],
                  tool_call_id, event.tenant_id))

    def _project_audit(self, cursor: Any, event: AgentScopeEvent, payload: dict[str, Any]) -> None:
        audit_payload = {
            "agent_id": event.agent_id,
            "agent_version_id": event.agent_version_id,
            "foundry_run_id": event.foundry_run_id,
            "scope_session_id": event.scope_session_id,
            "scope_run_id": event.scope_run_id,
            "scope_event_id": event.scope_event_id,
            "runtime_payload": _redact(payload),
        }
        self._execute(cursor, """
            INSERT INTO audit_events (
              id, tenant_id, actor_user_id, event_type, target_type,
              target_id, payload, created_at
            ) VALUES (?, ?, ?, ?, 'agent_run', ?, ?, ?)
        """, (f"agentscope:{event.event_id}", event.tenant_id, event.actor_user_id,
              f"agentscope.{event.event_type}", event.foundry_run_id,
              json.dumps(audit_payload, ensure_ascii=False), event.occurred_at))
