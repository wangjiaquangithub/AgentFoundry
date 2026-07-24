from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import EnterpriseIdentityService
from backend.services.reports import ReportError, ReportService, build_report_service


class GovernedReportsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.platform_url = f"sqlite:///{root / 'platform.db'}"
        self.report_url = f"sqlite:///{root / 'reports.db'}"
        apply_migrations(self.platform_url)
        apply_migrations(self.report_url)
        self.database = create_database(self.platform_url)
        self.report_database = create_database(self.report_url)
        self.identity = EnterpriseIdentityService(self.database)
        self.authorization = AuthorizationService(self.database)
        self.service = ReportService(self.database, self.report_database, self.authorization)
        timestamp = datetime.now(UTC).isoformat()
        for database in (self.database, self.report_database):
            with database.transaction() as connection:
                connection.execute(
                    "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                    "VALUES ('acme', 'Acme', 'active', ?, ?)",
                    (timestamp, timestamp),
                )
        with self.database.transaction() as connection:
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
        organization = self.identity.create_organization(
            tenant_id="acme", actor_id="admin", name="Acme"
        )
        self.sales = self.identity.create_unit(
            tenant_id="acme", actor_id="admin",
            organization_id=str(organization["id"]), name="Sales",
        )
        self.finance = self.identity.create_unit(
            tenant_id="acme", actor_id="admin",
            organization_id=str(organization["id"]), name="Finance",
        )
        self.people: dict[str, dict[str, object]] = {}
        for user_id, role, department in (
            ("employee", "employee", self.sales),
            ("manager", "line_manager", self.sales),
            ("other_employee", "employee", self.finance),
            ("report_manager", "report_manager", self.sales),
            ("finance_reader", "employee", self.finance),
            ("finance_manager", "line_manager", self.finance),
        ):
            person = self.identity.create_user(
                tenant_id="acme", actor_id="admin", user_id=user_id,
                display_name=user_id, email=f"{user_id}@example.com", role=role,
            )
            self.identity.assign_unit(
                tenant_id="acme", actor_id="admin",
                membership_id=str(person["membership_id"]),
                organization_unit_id=str(department["id"]),
                assignment_type="primary",
            )
            self.people[user_id] = person
        self.identity.set_manager(
            tenant_id="acme", actor_id="admin",
            membership_id=str(self.people["employee"]["membership_id"]),
            manager_membership_id=str(self.people["manager"]["membership_id"]),
        )
        self.identity.set_manager(
            tenant_id="acme", actor_id="admin",
            membership_id=str(self.people["finance_reader"]["membership_id"]),
            manager_membership_id=str(self.people["finance_manager"]["membership_id"]),
        )
        self.authorization.ensure_tenant_defaults("acme", "admin")
        scoped_role = self.authorization.create_role(
            tenant_id="acme", actor_id="admin", code="scoped_reporter",
            name="Scoped reporter",
            permission_codes=["report.read", "report.query", "report.export"],
        )
        self.authorization.bind_role(
            tenant_id="acme", actor_id="admin", role_id=str(scoped_role["id"]),
            subject_type="user", subject_id="finance_reader",
            data_scope="explicit_departments",
            scope_config={"department_ids": [self.sales["id"]]},
        )
        self._seed_report_rows()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _seed_report_rows(self) -> None:
        today = date.today().isoformat()
        period = date.today().strftime("%Y-%m")
        with self.report_database.transaction() as connection:
            connection.executemany(
                """INSERT INTO report_attendance
                (id, tenant_id, employee_id, employee_name, department_id,
                 work_date, status, hours, private_note)
                VALUES (?, 'acme', ?, ?, ?, ?, 'present', 8, ?)""",
                [
                    ("att_employee", "employee", "Employee", self.sales["id"], today, "medical"),
                    ("att_manager", "manager", "Manager", self.sales["id"], today, "private"),
                    ("att_other", "other_employee", "Other", self.finance["id"], today, "private"),
                ],
            )
            connection.executemany(
                """INSERT INTO report_sales
                (id, tenant_id, department_id, business_date, amount, order_count)
                VALUES (?, 'acme', ?, ?, ?, ?)""",
                [
                    ("sale_sales", self.sales["id"], today, 1000, 10),
                    ("sale_finance", self.finance["id"], today, 2000, 20),
                ],
            )
            connection.executemany(
                """INSERT INTO report_budgets
                (id, tenant_id, department_id, period, budget_amount, actual_amount)
                VALUES (?, 'acme', ?, ?, ?, ?)""",
                [
                    ("budget_sales", self.sales["id"], period, 10000, 8000),
                    ("budget_finance", self.finance["id"], period, 20000, 12000),
                ],
            )

    @staticmethod
    def _dates() -> dict[str, str]:
        today = date.today().isoformat()
        return {"start_date": today, "end_date": today}

    def test_employee_and_manager_attendance_scopes_and_masking(self) -> None:
        employee = self.service.query(
            tenant_id="acme", actor_id="employee", report_code="attendance",
            parameters=self._dates(), request_id="employee-attendance",
        )
        self.assertEqual([row["employee_id"] for row in employee["rows"]], ["employee"])
        self.assertEqual(employee["rows"][0]["private_note"], "***")
        self.assertEqual(employee["masked_fields"], ["private_note"])

        manager = self.service.query(
            tenant_id="acme", actor_id="manager", report_code="attendance",
            parameters=self._dates(), request_id="manager-attendance",
        )
        self.assertEqual(
            {row["employee_id"] for row in manager["rows"]},
            {"manager", "employee"},
        )
        self.assertNotIn("other_employee", {row["employee_id"] for row in manager["rows"]})

    def test_department_and_explicit_department_scopes(self) -> None:
        manager = self.service.query(
            tenant_id="acme", actor_id="report_manager", report_code="sales_summary",
            parameters=self._dates(), request_id="sales-department",
        )
        self.assertEqual([row["department_id"] for row in manager["rows"]], [self.sales["id"]])

        explicit = self.service.query(
            tenant_id="acme", actor_id="finance_reader", report_code="department_budget",
            parameters={"period": date.today().strftime("%Y-%m")}, request_id="budget-explicit",
        )
        self.assertEqual([row["department_id"] for row in explicit["rows"]], [self.sales["id"]])
        self.assertEqual(explicit["rows"][0]["budget_amount"], "***")
        self.assertEqual(explicit["rows"][0]["actual_amount"], "***")

    def test_invalid_parameters_scope_denial_and_audit(self) -> None:
        for parameters in (
            {"sql": "select * from users"},
            {"table_name": "report_sales"},
            {"unknown": "value"},
            {
                "start_date": (date.today() - timedelta(days=100)).isoformat(),
                "end_date": date.today().isoformat(),
            },
        ):
            with self.assertRaises(ReportError):
                self.service.query(
                    tenant_id="acme", actor_id="employee", report_code="attendance",
                    parameters=parameters, request_id="invalid-parameter",
                )
        with self.assertRaises(ReportError) as denied:
            self.service.query(
                tenant_id="acme", actor_id="employee", report_code="sales_summary",
                parameters=self._dates(), request_id="invalid-scope",
            )
        self.assertEqual(denied.exception.code, "REPORT_SCOPE_DENIED")
        decisions = self.authorization.list_decisions("acme", subject_id="employee")
        self.assertTrue(any(item["action"] == "report.query" for item in decisions))
        audits = self.service.list_audit("acme")
        self.assertTrue(any(item["outcome"] in {"denied", "failed"} for item in audits))

    def test_query_records_are_summaries_and_rows_are_truncated(self) -> None:
        definition = self.service._definition("acme", "attendance")
        with self.database.transaction() as connection:
            connection.execute(
                "UPDATE report_definitions SET max_rows=1 WHERE id=?", (definition["id"],)
            )
        result = self.service.query(
            tenant_id="acme", actor_id="manager", report_code="attendance",
            parameters=self._dates(), request_id="truncate",
        )
        self.assertTrue(result["truncated"])
        self.assertEqual(result["row_count"], 1)
        query = self.service.list_queries("acme", "manager")[0]
        serialized = json.dumps(query, ensure_ascii=False).lower()
        self.assertNotIn("select ", serialized)
        self.assertNotIn("medical", serialized)
        self.assertNotIn("private", serialized)

    def test_export_requires_approval_and_is_idempotent(self) -> None:
        first = self.service.request_export(
            tenant_id="acme", actor_id="finance_reader", report_code="department_budget",
            parameters={"period": date.today().strftime("%Y-%m")},
            idempotency_key="export-once", request_id="export-1",
        )
        repeated = self.service.request_export(
            tenant_id="acme", actor_id="finance_reader", report_code="department_budget",
            parameters={"period": date.today().strftime("%Y-%m")},
            idempotency_key="export-once", request_id="export-2",
        )
        self.assertEqual(first["id"], repeated["id"])
        self.assertEqual(first["status"], "pending_approval")
        with self.database.connect() as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM report_exports WHERE tenant_id='acme'"
            ).fetchone()[0]
        self.assertEqual(count, 1)

    def test_source_failure_is_safe_and_production_rejects_sqlite(self) -> None:
        missing = create_database(f"sqlite:///{Path(self.temp_dir.name) / 'uninitialized.db'}")
        broken = ReportService(self.database, missing, self.authorization)
        with self.assertRaises(ReportError) as failure:
            broken.query(
                tenant_id="acme", actor_id="employee", report_code="attendance",
                parameters=self._dates(), request_id="source-down",
            )
        self.assertEqual(failure.exception.code, "REPORT_SOURCE_UNAVAILABLE")
        with patch.dict(os.environ, {
            "AGENTFOUNDRY_ENV": "production",
            "AGENTFOUNDRY_DATABASE_URL": self.platform_url,
            "AGENTFOUNDRY_REPORT_DATABASE_URL": self.report_url,
        }, clear=False):
            with self.assertRaises(RuntimeError):
                build_report_service()


if __name__ == "__main__":
    unittest.main()
