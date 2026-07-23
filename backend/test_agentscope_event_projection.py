from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from backend.persistence.agentscope_event_projection import AgentScopeEvent, AgentScopeEventProjector
from backend.persistence.database import create_sqlite_database
from backend.persistence.migrations import apply_migrations


class AgentScopeEventProjectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_url = f"sqlite:///{Path(self.temp_dir.name) / 'projection.db'}"
        apply_migrations(self.database_url)
        self.database = create_sqlite_database(self.database_url)
        with self.database.transaction() as connection:
            connection.execute("INSERT INTO tenants VALUES (?, ?, ?, ?, ?, ?)",
                               ("tenant-1", "Tenant", "active", None, "now", "now"))
            connection.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)",
                               ("user-1", "User", None, "active", "now", "now"))
        self.projector = AgentScopeEventProjector(self.database)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def event(self, event_type: str, event_id: str, payload: dict | None = None) -> AgentScopeEvent:
        return AgentScopeEvent(
            event_id=event_id, event_type=event_type, tenant_id="tenant-1",
            foundry_run_id="run-1", scope_event_id=event_id,
            occurred_at="2026-07-23T00:00:00Z", actor_user_id="user-1",
            runtime_provider="agentscope", agent_id=None, agent_version_id=None,
            scope_session_id="session-1", scope_run_id="scope-run-1", payload=payload,
        )

    def test_success_failure_and_duplicate_run_events(self) -> None:
        first = self.projector.project(self.event("run.started", "event-1", {"question": "天气"}))
        self.projector.project(self.event("run.completed", "event-2", {"answer": "晴"}))
        duplicate = self.projector.project(self.event("run.completed", "event-2", {"answer": "晴"}))
        self.assertFalse(first.duplicate)
        self.assertTrue(duplicate.duplicate)
        with self.database.connect() as connection:
            run = connection.execute("SELECT status, answer, session_id FROM agent_runs").fetchone()
            self.assertEqual(tuple(run), ("completed", "晴", "session-1"))
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM audit_events").fetchone()[0], 2)
        self.projector.project(self.event("run.failed", "event-3", {"error": "model unavailable"}))
        with self.database.connect() as connection:
            self.assertEqual(connection.execute("SELECT status FROM agent_runs").fetchone()[0], "failed")

    def test_tool_event_redacts_and_audits_scope_identity(self) -> None:
        self.projector.project(self.event("run.started", "event-1"))
        payload = {"tool_call_id": "call-1", "tool_name": "weather", "inputs": {"city": "北京", "api_key": "secret"}}
        self.projector.project(self.event("tool.started", "event-tool-1", payload))
        self.projector.project(self.event("tool.completed", "event-tool-2", {**payload, "output": {"temperature": 30, "token": "secret"}}))
        with self.database.connect() as connection:
            call = connection.execute("SELECT tool_name, status, input_summary, output_summary FROM tool_calls").fetchone()
            self.assertEqual((call[0], call[1]), ("weather", "completed"))
            self.assertNotIn("secret", call[2] + call[3])
            audit = json.loads(connection.execute("SELECT payload FROM audit_events WHERE event_type = 'agentscope.tool.completed'").fetchone()[0])
            self.assertEqual(audit["scope_session_id"], "session-1")
            self.assertEqual(audit["scope_run_id"], "scope-run-1")
            self.assertEqual(audit["agent_version_id"], None)


if __name__ == "__main__":
    unittest.main()
