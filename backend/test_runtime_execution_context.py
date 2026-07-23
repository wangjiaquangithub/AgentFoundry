from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.persistence.runtime_lifecycle import RuntimeLifecycleStore
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import EnterpriseIdentityService
from backend.services.execution_context import ExecutionContextError, ExecutionContextService


class RuntimeExecutionContextTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_url = f"sqlite:///{Path(self.temp_dir.name) / 'runtime-context.db'}"
        apply_migrations(self.database_url)
        self.database = create_database(self.database_url)
        self.identity = EnterpriseIdentityService(self.database)
        self.authorization = AuthorizationService(self.database)
        self.contexts = ExecutionContextService(self.database, ttl_seconds=60)
        self.lifecycle = RuntimeLifecycleStore(self.database)
        timestamp = datetime.now(UTC).isoformat()
        with self.database.transaction() as connection:
            connection.execute(
                "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                "VALUES ('acme', 'Acme', 'active', ?, ?)",
                (timestamp, timestamp),
            )
            connection.execute(
                "INSERT INTO users (id, display_name, email, status, created_at, updated_at) "
                "VALUES ('admin', 'Admin', 'admin@example.com', 'active', ?, ?)",
                (timestamp, timestamp),
            )
            connection.execute(
                """INSERT INTO memberships
                (id, tenant_id, user_id, role, workspace_ids, status, version, source,
                 created_at, updated_at)
                VALUES ('mem_admin', 'acme', 'admin', 'tenant_admin', '[]', 'active',
                        1, 'test', ?, ?)""",
                (timestamp, timestamp),
            )
        self.authorization.ensure_tenant_defaults("acme", "admin")
        self.organization = self.identity.create_organization(
            tenant_id="acme", actor_id="admin", name="Acme"
        )
        self.department = self.identity.create_unit(
            tenant_id="acme", actor_id="admin",
            organization_id=str(self.organization["id"]), name="Engineering",
        )
        self.employee = self.identity.create_user(
            tenant_id="acme", actor_id="admin", user_id="employee",
            display_name="Employee", email="employee@example.com", role="employee",
        )
        self.manager = self.identity.create_user(
            tenant_id="acme", actor_id="admin", user_id="manager",
            display_name="Manager", email="manager@example.com", role="line_manager",
        )
        self.identity.assign_unit(
            tenant_id="acme", actor_id="admin",
            membership_id=str(self.employee["membership_id"]),
            organization_unit_id=str(self.department["id"]), assignment_type="primary",
        )
        self.identity.set_manager(
            tenant_id="acme", actor_id="admin",
            membership_id=str(self.employee["membership_id"]),
            manager_membership_id=str(self.manager["membership_id"]),
        )
        self.authorization.ensure_tenant_defaults("acme", "admin")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_context_is_derived_from_persisted_identity_and_policy(self) -> None:
        custom = self.authorization.create_role(
            tenant_id="acme", actor_id="admin", code="department_agent_user",
            name="Department agent user", permission_codes=["agent.invoke"],
        )
        self.authorization.bind_role(
            tenant_id="acme", actor_id="admin", role_id=str(custom["id"]),
            subject_type="organization_unit", subject_id=str(self.department["id"]),
            data_scope="department",
        )
        no_permissions = self.authorization.create_role(
            tenant_id="acme", actor_id="admin", code="context_marker",
            name="Context marker", permission_codes=[],
        )
        self.authorization.bind_role(
            tenant_id="acme", actor_id="admin", role_id=str(no_permissions["id"]),
            subject_type="membership", subject_id=str(self.employee["membership_id"]),
        )

        context = self.contexts.build(
            request_id="req-1", tenant_id="acme", subject_id="employee",
            agent_id="leave-agent", authentication_method="trusted_proxy_hmac",
        )

        self.assertEqual(context.subject_id, "employee")
        self.assertEqual(context.primary_department_id, self.department["id"])
        self.assertEqual(context.organization_unit_ids, [self.department["id"]])
        self.assertEqual(context.manager_id, "manager")
        self.assertIn("agent.invoke", context.permission_codes)
        self.assertIn(custom["id"], context.role_ids)
        self.assertIn(no_permissions["id"], context.role_ids)
        self.assertEqual(context.data_scope, "department")
        self.assertEqual(context.authentication_method, "trusted_proxy_hmac")
        self.assertTrue(context.authorization_decision_id.startswith("authz_"))

    def test_inactive_and_unauthorized_subjects_are_rejected(self) -> None:
        viewer = self.identity.create_user(
            tenant_id="acme", actor_id="admin", user_id="viewer",
            display_name="Viewer", email="viewer@example.com", role="auditor",
        )
        self.authorization.ensure_tenant_defaults("acme", "admin")
        with self.assertRaisesRegex(ExecutionContextError, "DENY_NO_MATCHING_PERMISSION"):
            self.contexts.build(
                request_id="req-denied", tenant_id="acme", subject_id="viewer",
                agent_id="leave-agent", authentication_method="development_headers",
            )
        self.identity.deactivate_user(
            tenant_id="acme", actor_id="admin", user_id=str(viewer["id"])
        )
        with self.assertRaisesRegex(ExecutionContextError, "inactive"):
            self.contexts.build(
                request_id="req-inactive", tenant_id="acme", subject_id="viewer",
                agent_id="leave-agent", authentication_method="development_headers",
            )

    def test_session_execution_continuation_and_event_lifecycle(self) -> None:
        session = self.lifecycle.create_session(
            tenant_id="acme", subject_id="employee", agent_id="leave-agent",
            session_id="session-1", metadata={"request_id": "req-1"},
        )
        self.assertEqual(session["metadata"]["request_id"], "req-1")
        self.assertEqual(
            self.lifecycle.create_session(
                tenant_id="acme", subject_id="employee", agent_id="leave-agent",
                session_id="session-1",
            )["id"],
            "session-1",
        )
        with self.assertRaisesRegex(ValueError, "different subject"):
            self.lifecycle.create_session(
                tenant_id="acme", subject_id="manager", agent_id="leave-agent",
                session_id="session-1",
            )
        execution = self.lifecycle.create_execution(
            tenant_id="acme", session_id="session-1", business_run_id="run-1",
            context={"authorization_decision_id": "authz-1"},
        )
        self.lifecycle.update_execution("acme", execution["id"], "running")
        continuation = self.lifecycle.create_continuation(
            tenant_id="acme", business_run_id="run-1", session_id="session-1",
            payload={"approval_id": "approval-1", "request_hash": "abc"},
        )
        self.assertEqual(
            self.lifecycle.consume_continuation(
                tenant_id="acme", continuation_id=continuation["id"]
            )["approval_id"],
            "approval-1",
        )
        with self.assertRaisesRegex(ValueError, "already consumed"):
            self.lifecycle.consume_continuation(
                tenant_id="acme", continuation_id=continuation["id"]
            )
        self.assertTrue(self.lifecycle.append_event(
            tenant_id="acme", execution_id=execution["id"],
            provider_event_id="provider-event-1", event_type="tool.started",
            payload={"tool": "get_leave_balance"},
        ))
        self.assertFalse(self.lifecycle.append_event(
            tenant_id="acme", execution_id=execution["id"],
            provider_event_id="provider-event-1", event_type="tool.started",
            payload={"tool": "get_leave_balance"},
        ))

    def test_continuation_payload_tampering_is_detected(self) -> None:
        self.lifecycle.create_session(
            tenant_id="acme", subject_id="employee", agent_id="leave-agent",
            session_id="session-tamper",
        )
        continuation = self.lifecycle.create_continuation(
            tenant_id="acme", business_run_id="run-tamper",
            session_id="session-tamper", payload={"approved": True},
        )
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE run_continuations SET payload=? WHERE id=?",
                (json.dumps({"approved": False}), continuation["id"]),
            )
        with self.assertRaisesRegex(ValueError, "integrity"):
            self.lifecycle.consume_continuation(
                tenant_id="acme", continuation_id=continuation["id"]
            )

    def test_lifecycle_accepts_database_loaded_through_application_namespace(
        self,
    ) -> None:
        backend_dir = str(Path(__file__).resolve().parent)
        sys.path.insert(0, backend_dir)
        try:
            from persistence.database import create_database as app_create_database

            app_database = app_create_database(self.database_url)
            lifecycle = RuntimeLifecycleStore(app_database)
            session = lifecycle.create_session(
                tenant_id="acme",
                subject_id="employee",
                agent_id="leave-agent",
                session_id="application-import-session",
            )
        finally:
            sys.path.remove(backend_dir)

        self.assertEqual(session["id"], "application-import-session")


if __name__ == "__main__":
    unittest.main()
