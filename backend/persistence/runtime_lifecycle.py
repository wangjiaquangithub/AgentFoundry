"""Persistent AgentScope session, execution, continuation, and event lifecycle."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase
from backend.persistence.database_urls import is_postgres_database_url


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _canonical(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class RuntimeLifecycleStore:
    STATES = {
        "queued",
        "running",
        "waiting_approval",
        "resuming",
        "succeeded",
        "failed",
        "cancelled",
    }

    def __init__(self, database: SQLiteDatabase | PostgresDatabase) -> None:
        self.database = database

    @property
    def _sqlite(self) -> bool:
        # The application can be launched with either ``backend`` on sys.path
        # (``persistence.database``) or the repository root on sys.path
        # (``backend.persistence.database``).  Those imports create distinct
        # Python class objects even though they refer to the same source file,
        # so class identity is not a reliable dialect check here.
        return not is_postgres_database_url(self.database.database_url)

    def _sql(self, value: str) -> str:
        return value if self._sqlite else value.replace("?", "%s")

    @staticmethod
    def _decode_session(row: Any) -> dict[str, Any]:
        result = dict(row)
        try:
            result["metadata"] = json.loads(result.get("metadata") or "{}")
        except (TypeError, ValueError):
            result["metadata"] = {}
        return result

    def create_session(
        self,
        *,
        tenant_id: str,
        subject_id: str,
        agent_id: str,
        session_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        session_id = session_id or f"ses_{uuid.uuid4().hex}"
        timestamp = _now()
        with self.database.transaction() as connection:
            existing = connection.execute(
                self._sql(
                    "SELECT * FROM runtime_sessions WHERE id=? AND tenant_id=?"
                ),
                (session_id, tenant_id),
            ).fetchone()
            if existing:
                record = self._decode_session(existing)
                if record["subject_id"] != subject_id or record["agent_id"] != agent_id:
                    raise ValueError("runtime session belongs to a different subject or agent")
                if record["status"] != "active":
                    raise ValueError("runtime session is not active")
                return record
            connection.execute(
                self._sql(
                    """INSERT INTO runtime_sessions
                      (id, tenant_id, subject_id, agent_id, status, metadata,
                       created_at, updated_at)
                      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)"""
                ),
                (
                    session_id,
                    tenant_id,
                    subject_id,
                    agent_id,
                    _canonical(metadata or {}),
                    timestamp,
                    timestamp,
                ),
            )
        return self.get_session(tenant_id, session_id)

    def get_session(self, tenant_id: str, session_id: str) -> dict[str, Any]:
        with self.database.connect() as connection:
            row = connection.execute(
                self._sql(
                    "SELECT * FROM runtime_sessions WHERE id=? AND tenant_id=?"
                ),
                (session_id, tenant_id),
            ).fetchone()
        if row is None:
            raise KeyError("runtime session not found")
        return self._decode_session(row)

    def close_session(self, tenant_id: str, session_id: str) -> None:
        with self.database.transaction() as connection:
            connection.execute(
                self._sql(
                    """UPDATE runtime_sessions SET status='closed', updated_at=?
                       WHERE id=? AND tenant_id=?"""
                ),
                (_now(), session_id, tenant_id),
            )

    def create_execution(
        self,
        *,
        tenant_id: str,
        session_id: str,
        business_run_id: str,
        execution_id: str | None = None,
        state: str = "queued",
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if state not in self.STATES:
            raise ValueError("invalid runtime execution state")
        execution_id = execution_id or f"exec_{uuid.uuid4().hex}"
        timestamp = _now()
        with self.database.transaction() as connection:
            connection.execute(
                self._sql(
                    """INSERT INTO runtime_executions
                      (id, tenant_id, session_id, business_run_id, state,
                       execution_context, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""
                ),
                (
                    execution_id,
                    tenant_id,
                    session_id,
                    business_run_id,
                    state,
                    _canonical(context or {}),
                    timestamp,
                    timestamp,
                ),
            )
        return {
            "id": execution_id,
            "state": state,
            "session_id": session_id,
            "business_run_id": business_run_id,
        }

    def update_execution(
        self,
        tenant_id: str,
        execution_id: str,
        state: str,
        *,
        error_code: str | None = None,
    ) -> None:
        if state not in self.STATES:
            raise ValueError("invalid runtime execution state")
        with self.database.transaction() as connection:
            connection.execute(
                self._sql(
                    """UPDATE runtime_executions
                       SET state=?, error_code=?, updated_at=?
                       WHERE id=? AND tenant_id=?"""
                ),
                (state, error_code, _now(), execution_id, tenant_id),
            )

    def create_continuation(
        self,
        *,
        tenant_id: str,
        business_run_id: str,
        session_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        canonical = _canonical(payload)
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        continuation_id = f"cont_{uuid.uuid4().hex}"
        with self.database.transaction() as connection:
            connection.execute(
                self._sql(
                    """INSERT INTO run_continuations
                      (id, tenant_id, business_run_id, session_id, payload,
                       payload_digest, status, created_at)
                      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"""
                ),
                (
                    continuation_id,
                    tenant_id,
                    business_run_id,
                    session_id,
                    canonical,
                    digest,
                    _now(),
                ),
            )
        return {"id": continuation_id, "payload_digest": digest}

    def consume_continuation(
        self,
        *,
        tenant_id: str,
        continuation_id: str,
    ) -> dict[str, Any]:
        with self.database.transaction() as connection:
            row = connection.execute(
                self._sql(
                    """SELECT * FROM run_continuations
                       WHERE id=? AND tenant_id=?"""
                ),
                (continuation_id, tenant_id),
            ).fetchone()
            if row is None:
                raise KeyError("continuation not found")
            record = dict(row)
            payload = json.loads(record["payload"])
            digest = hashlib.sha256(_canonical(payload).encode()).hexdigest()
            if digest != record["payload_digest"]:
                raise ValueError("continuation payload integrity check failed")
            if record["status"] != "pending":
                raise ValueError("continuation was already consumed")
            connection.execute(
                self._sql(
                    """UPDATE run_continuations
                       SET status='consumed', consumed_at=? WHERE id=?"""
                ),
                (_now(), continuation_id),
            )
        return payload

    def append_event(
        self,
        *,
        tenant_id: str,
        execution_id: str,
        provider_event_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> bool:
        try:
            with self.database.transaction() as connection:
                connection.execute(
                    self._sql(
                        """INSERT INTO runtime_events
                          (id, tenant_id, execution_id, provider_event_id,
                           event_type, payload, occurred_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?)"""
                    ),
                    (
                        f"evt_{uuid.uuid4().hex}",
                        tenant_id,
                        execution_id,
                        provider_event_id,
                        event_type,
                        _canonical(payload),
                        _now(),
                    ),
                )
            return True
        except sqlite3.IntegrityError as exc:
            if self._sqlite and "unique" in str(exc).lower():
                return False
            raise
        except Exception as exc:
            # psycopg is optional, so avoid importing it in SQLite-only installs.
            if not self._sqlite and getattr(exc, "sqlstate", None) == "23505":
                return False
            raise
