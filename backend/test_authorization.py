from __future__ import annotations

import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.services.authorization import AuthorizationService


class AuthorizationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        url = f"sqlite:///{Path(self.temp_dir.name) / 'authorization.db'}"
        apply_migrations(url)
        self.service = AuthorizationService(create_database(url))
        timestamp = datetime.now(UTC).isoformat()
        with self.service.database.transaction() as connection:
            for tenant in ("tenant_a", "tenant_b"):
                connection.execute("INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)",
                                   (tenant, tenant, timestamp, timestamp))
            for user, role in (("admin", "tenant_admin"), ("employee", "employee"), ("manager", "line_manager")):
                connection.execute("INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)",
                                   (user, user, f"{user}@example.com", timestamp, timestamp))
                connection.execute("""INSERT INTO memberships
                  (id, tenant_id, user_id, role, workspace_ids, status, version, source, created_at, updated_at)
                  VALUES (?, 'tenant_a', ?, ?, '[]', 'active', 1, 'test', ?, ?)""",
                  (f"mem_{user}", user, role, timestamp, timestamp))
            connection.execute("""INSERT INTO memberships
              (id, tenant_id, user_id, role, workspace_ids, status, version, source, created_at, updated_at)
              VALUES ('mem_admin_b', 'tenant_b', 'admin', 'tenant_admin', '[]', 'active', 1, 'test', ?, ?)""",
              (timestamp, timestamp))
        self.service.ensure_tenant_defaults("tenant_a", "admin")
        self.service.ensure_tenant_defaults("tenant_b", "admin")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_builtin_role_permission_and_scope(self) -> None:
        decision = self.service.authorize(tenant_id="tenant_a", subject_id="employee",
            action="report.query", resource={"type": "report", "id": "attendance"})
        self.assertTrue(decision["allowed"])
        self.assertEqual(decision["effective_scope"], "self")
        denied = self.service.authorize(tenant_id="tenant_a", subject_id="employee",
            action="role.manage", resource={"type": "authorization", "id": "tenant_a"})
        self.assertFalse(denied["allowed"])

    def test_resource_specific_binding(self) -> None:
        role = self.service.create_role(tenant_id="tenant_a", actor_id="admin",
            code="sales_reader", name="Sales reader", permission_codes=["report.query"])
        self.service.bind_role(tenant_id="tenant_a", actor_id="admin", role_id=role["id"],
            subject_type="user", subject_id="employee", data_scope="department",
            resource_type="report", resource_id="sales")
        sales = self.service.authorize(tenant_id="tenant_a", subject_id="employee",
            action="report.query", resource={"type": "report", "id": "sales"})
        self.assertEqual(sales["effective_scope"], "department")

    def test_explicit_resource_grant_and_tenant_isolation(self) -> None:
        self.service.create_resource_grant(tenant_id="tenant_a", actor_id="admin",
            subject_type="user", subject_id="employee", action="report.export",
            resource_type="report", resource_id="attendance", data_scope="self")
        allowed = self.service.authorize(tenant_id="tenant_a", subject_id="employee",
            action="report.export", resource={"type": "report", "id": "attendance"})
        self.assertTrue(allowed["allowed"])
        cross = self.service.authorize(tenant_id="tenant_b", subject_id="employee",
            action="report.export", resource={"type": "report", "id": "attendance"})
        self.assertFalse(cross["allowed"])

    def test_decisions_are_persisted(self) -> None:
        self.service.authorize(tenant_id="tenant_a", subject_id="manager",
            action="approval.review", resource={"type": "leave_request", "id": "leave_1"})
        decisions = self.service.list_decisions("tenant_a", subject_id="manager")
        self.assertEqual(decisions[0]["effective_scope"], "direct_reports")
        self.assertTrue(decisions[0]["allowed"])

    def test_unknown_subject_denial_is_persisted(self) -> None:
        decision = self.service.authorize(tenant_id="tenant_a", subject_id="unknown_user",
            action="report.query", resource={"type": "report", "id": "attendance"})
        self.assertFalse(decision["allowed"])
        self.assertEqual(decision["reason_code"], "DENY_NOT_TENANT_MEMBER")
        decisions = self.service.list_decisions("tenant_a", subject_id="unknown_user")
        self.assertEqual(len(decisions), 1)


if __name__ == "__main__":
    unittest.main()
