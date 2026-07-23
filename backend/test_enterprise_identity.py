from __future__ import annotations

import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.services.enterprise_identity import (
    EnterpriseIdentityError,
    EnterpriseIdentityService,
)


class EnterpriseIdentityServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_dir.name) / "identity.db"
        self.database_url = f"sqlite:///{database_path}"
        apply_migrations(self.database_url)
        self.service = EnterpriseIdentityService(create_database(self.database_url))
        timestamp = datetime.now(UTC).isoformat()
        with self.service.database.transaction() as connection:
            for tenant_id in ("tenant_a", "tenant_b"):
                connection.execute(
                    "INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)",
                    (tenant_id, tenant_id, timestamp, timestamp),
                )
            connection.execute(
                "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)",
                ("admin", "Admin", "admin@example.com", timestamp, timestamp),
            )
            for tenant_id in ("tenant_a", "tenant_b"):
                connection.execute(
                    """INSERT INTO memberships
                    (id, tenant_id, user_id, role, workspace_ids, status, version, source, created_at, updated_at)
                    VALUES (?, ?, 'admin', 'tenant_admin', '[]', 'active', 1, 'test', ?, ?)""",
                    (f"{tenant_id}_admin", tenant_id, timestamp, timestamp),
                )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _organization(self) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:
        organization = self.service.create_organization(
            tenant_id="tenant_a", actor_id="admin", name="Acme"
        )
        engineering = self.service.create_unit(
            tenant_id="tenant_a", actor_id="admin",
            organization_id=str(organization["id"]), name="Engineering",
        )
        product = self.service.create_unit(
            tenant_id="tenant_a", actor_id="admin",
            organization_id=str(organization["id"]), name="Product",
        )
        return organization, engineering, product

    def test_multi_tenant_membership_and_tenant_isolation(self) -> None:
        shared_a = self.service.create_user(
            tenant_id="tenant_a", actor_id="admin", user_id="shared",
            display_name="Shared User", email="shared@example.com",
        )
        shared_b = self.service.create_user(
            tenant_id="tenant_b", actor_id="admin", user_id="shared",
            display_name="Ignored Existing Name", email="shared@example.com",
        )
        self.assertEqual(shared_a["id"], shared_b["id"])
        self.assertEqual(len(self.service.list_users("tenant_a")), 2)
        self.assertEqual(len(self.service.list_users("tenant_b")), 2)

    def test_primary_auxiliary_assignments_and_manager_cycle(self) -> None:
        _, engineering, product = self._organization()
        employee = self.service.create_user(
            tenant_id="tenant_a", actor_id="admin", display_name="Employee",
            email="employee@example.com",
        )
        manager = self.service.create_user(
            tenant_id="tenant_a", actor_id="admin", display_name="Manager",
            email="manager@example.com",
        )
        self.service.assign_unit(
            tenant_id="tenant_a", actor_id="admin",
            membership_id=str(employee["membership_id"]),
            organization_unit_id=str(engineering["id"]), assignment_type="primary",
        )
        self.service.assign_unit(
            tenant_id="tenant_a", actor_id="admin",
            membership_id=str(employee["membership_id"]),
            organization_unit_id=str(product["id"]), assignment_type="auxiliary",
        )
        self.service.set_manager(
            tenant_id="tenant_a", actor_id="admin",
            membership_id=str(employee["membership_id"]),
            manager_membership_id=str(manager["membership_id"]),
        )
        with self.assertRaisesRegex(EnterpriseIdentityError, "cycle"):
            self.service.set_manager(
                tenant_id="tenant_a", actor_id="admin",
                membership_id=str(manager["membership_id"]),
                manager_membership_id=str(employee["membership_id"]),
            )
        snapshot = self.service.organization_snapshot("tenant_a")
        self.assertEqual(len(snapshot["assignments"]), 2)
        self.assertEqual(len(snapshot["manager_relations"]), 1)

    def test_cross_tenant_manager_is_rejected(self) -> None:
        employee = self.service.create_user(
            tenant_id="tenant_a", actor_id="admin", display_name="Employee",
            email="employee@example.com",
        )
        other = self.service.create_user(
            tenant_id="tenant_b", actor_id="admin", display_name="Other",
            email="other@example.com",
        )
        with self.assertRaisesRegex(EnterpriseIdentityError, "same tenant"):
            self.service.set_manager(
                tenant_id="tenant_a", actor_id="admin",
                membership_id=str(employee["membership_id"]),
                manager_membership_id=str(other["membership_id"]),
            )

    def test_soft_deactivation_blocks_subject_and_preserves_mutation(self) -> None:
        employee = self.service.create_user(
            tenant_id="tenant_a", actor_id="admin", display_name="Employee",
            email="employee@example.com",
        )
        self.service.deactivate_user(
            tenant_id="tenant_a", actor_id="admin", user_id=str(employee["id"])
        )
        with self.assertRaisesRegex(EnterpriseIdentityError, "inactive"):
            self.service.require_active_subject("tenant_a", str(employee["id"]))
        self.assertEqual(len(self.service.list_users("tenant_a")), 1)
        self.assertEqual(len(self.service.list_users("tenant_a", include_inactive=True)), 2)
        actions = {row["action"] for row in self.service.list_mutations("tenant_a")}
        self.assertIn("identity.user.created", actions)
        self.assertIn("identity.user.deactivated", actions)


if __name__ == "__main__":
    unittest.main()
