from __future__ import annotations

import asyncio
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from backend.hr_client import HRClient
from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.persistence.runtime_lifecycle import RuntimeLifecycleStore
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import EnterpriseIdentityService
from backend.services.leave_requests import LeaveRequestError, LeaveRequestService


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class LeaveRequestsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.hr_temp = tempfile.TemporaryDirectory()
        cls.hr_database = Path(cls.hr_temp.name) / "hr.db"
        cls.hr_port = _free_port()
        environment = os.environ.copy()
        environment["AGENTFOUNDRY_HR_DEMO_DB"] = str(cls.hr_database)
        bundled_python = Path(__file__).resolve().parents[2] / "agentscope" / ".venv" / "bin" / "python"
        uvicorn_python = os.environ.get(
            "AGENTFOUNDRY_UVICORN_PYTHON",
            str(bundled_python if bundled_python.exists() else Path(sys.executable)),
        )
        cls.hr_process = subprocess.Popen(
            [
                uvicorn_python,
                "-m",
                "uvicorn",
                "backend.hr_demo_service:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(cls.hr_port),
                "--log-level",
                "warning",
            ],
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
        health_url = f"http://127.0.0.1:{cls.hr_port}/employees/acme_alice/leave-balance"
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if cls.hr_process.poll() is not None:
                stderr = cls.hr_process.stderr.read() if cls.hr_process.stderr else ""
                raise RuntimeError(f"HR demo service failed to start: {stderr}")
            try:
                with urllib.request.urlopen(health_url, timeout=0.5) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("HR demo service did not become ready")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.hr_process.terminate()
        try:
            cls.hr_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.hr_process.kill()
            cls.hr_process.wait(timeout=5)
        if cls.hr_process.stderr:
            cls.hr_process.stderr.close()
        cls.hr_temp.cleanup()

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_url = f"sqlite:///{Path(self.temp_dir.name) / 'foundry.db'}"
        apply_migrations(self.database_url)
        self.database = create_database(self.database_url)
        self.identity = EnterpriseIdentityService(self.database)
        self.authorization = AuthorizationService(self.database)
        self.runtime = RuntimeLifecycleStore(self.database)
        self.hr = HRClient(f"http://127.0.0.1:{self.hr_port}", timeout_seconds=1)
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
        organization = self.identity.create_organization(
            tenant_id="acme", actor_id="admin", name="Acme"
        )
        department = self.identity.create_unit(
            tenant_id="acme",
            actor_id="admin",
            organization_id=str(organization["id"]),
            name="Engineering",
        )
        self.employee = self.identity.create_user(
            tenant_id="acme",
            actor_id="admin",
            user_id="acme_alice",
            display_name="Alice",
            email="alice@example.com",
            role="employee",
        )
        self.manager = self.identity.create_user(
            tenant_id="acme",
            actor_id="admin",
            user_id="acme_manager",
            display_name="Manager",
            email="manager@example.com",
            role="line_manager",
        )
        self.identity.assign_unit(
            tenant_id="acme",
            actor_id="admin",
            membership_id=str(self.employee["membership_id"]),
            organization_unit_id=str(department["id"]),
            assignment_type="primary",
        )
        self.identity.assign_unit(
            tenant_id="acme",
            actor_id="admin",
            membership_id=str(self.manager["membership_id"]),
            organization_unit_id=str(department["id"]),
            assignment_type="primary",
        )
        self.identity.set_manager(
            tenant_id="acme",
            actor_id="admin",
            membership_id=str(self.employee["membership_id"]),
            manager_membership_id=str(self.manager["membership_id"]),
        )
        self.authorization.ensure_tenant_defaults("acme", "admin")
        self.tool_validations: list[dict[str, object]] = []

        async def resume_runtime(payload: dict[str, object]) -> dict[str, object]:
            invocation = SimpleNamespace(**payload)
            result = self.service.execute_submit_tool(
                tenant_id=str(payload["tenant_id"]),
                actor_id=str(payload["actor_id"]),
                business_run_id=str(payload["business_run_id"]),
                invocation=invocation,
            )
            self.tool_validations.append(payload)
            return {
                "status": "completed",
                "raw": {
                    "tool_calls": [
                        {
                            "tool_name": "enterprise_submit_leave_request",
                            "allowed": True,
                            "result": result,
                        }
                    ]
                },
            }

        self.service = LeaveRequestService(
            database=self.database,
            identity=self.identity,
            authorization=self.authorization,
            runtime=self.runtime,
            hr=self.hr,
            runtime_resume=resume_runtime,
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _create(self, start_date: str = "2030-01-10", end_date: str = "2030-01-10"):
        return self.service.create(
            tenant_id="acme",
            actor_id="acme_alice",
            request_id="req-create",
            leave_type="annual",
            start_date=start_date,
            end_date=end_date,
            reason="家庭事务",
        )

    def _hr_request_count(self) -> int:
        with sqlite3.connect(self.hr_database) as connection:
            return int(connection.execute("SELECT COUNT(*) FROM requests").fetchone()[0])

    def test_approved_leave_resumes_same_session_and_is_idempotent(self) -> None:
        before = self._hr_request_count()
        created = self._create()
        self.assertEqual(created["status"], "waiting_approval")
        self.assertEqual(self._hr_request_count(), before)

        approved = self.service.decide(
            tenant_id="acme",
            actor_id="acme_manager",
            request_id="req-approve",
            case_id=created["approval_case_id"],
            decision_value="approved",
            comment="同意",
        )
        self.assertEqual(approved["status"], "approved")
        completed = asyncio.run(
            self.service.resume(
                tenant_id="acme",
                actor_id="acme_alice",
                request_id="req-resume",
                business_run_id=created["business_run_id"],
            )
        )

        self.assertEqual(completed["status"], "completed")
        self.assertTrue(str(completed["hr_request_id"]).startswith("HR-"))
        self.assertEqual(self._hr_request_count(), before + 1)
        executions = self.runtime.list_executions(
            "acme",
            business_run_id=created["business_run_id"],
        )
        self.assertEqual(len(executions), 2)
        self.assertEqual({item["session_id"] for item in executions}, {created["session_id"]})
        resumed_execution = executions[0]
        self.assertEqual(resumed_execution["state"], "succeeded")
        self.assertEqual(len(self.tool_validations), 1)

        repeated = asyncio.run(
            self.service.resume(
                tenant_id="acme",
                actor_id="acme_alice",
                request_id="req-repeat",
                business_run_id=created["business_run_id"],
            )
        )
        self.assertEqual(repeated["hr_request_id"], completed["hr_request_id"])
        self.assertEqual(self._hr_request_count(), before + 1)
        self.assertEqual(len(self.tool_validations), 1)

        decisions = self.authorization.list_decisions("acme")
        self.assertTrue(any(row["action"] == "approval.review" for row in decisions))
        self.assertTrue(any(row["action"] == "tool.invoke" for row in decisions))
        events = self.runtime.list_events(
            "acme",
            execution_id=resumed_execution["id"],
        )
        self.assertEqual([event["event_type"] for event in events], ["resuming", "completed"])
        audit = self.service.list_audit("acme")
        self.assertTrue(any(row["action"] == "leave.hr_submit" and row["outcome"] == "completed" for row in audit))


    def test_rejection_and_permission_boundaries_never_submit_to_hr(self) -> None:
        before = self._hr_request_count()
        created = self._create("2030-02-10", "2030-02-10")
        with self.assertRaisesRegex(LeaveRequestError, "只有当前审批人"):
            self.service.decide(
                tenant_id="acme",
                actor_id="acme_alice",
                request_id="req-self",
                case_id=created["approval_case_id"],
                decision_value="approved",
            )
        self.service.decide(
            tenant_id="acme",
            actor_id="acme_manager",
            request_id="req-reject",
            case_id=created["approval_case_id"],
            decision_value="rejected",
        )
        with self.assertRaisesRegex(LeaveRequestError, "尚未批准"):
            asyncio.run(
                self.service.resume(
                    tenant_id="acme",
                    actor_id="acme_alice",
                    request_id="req-rejected-resume",
                    business_run_id=created["business_run_id"],
                )
            )
        self.assertEqual(self._hr_request_count(), before)

    def test_balance_conflict_and_runtime_failure_are_explicit(self) -> None:
        with self.assertRaisesRegex(LeaveRequestError, "余额不足"):
            self._create("2030-03-01", "2030-03-20")

        first = self._create("2030-04-10", "2030-04-10")
        self.service.decide(
            tenant_id="acme",
            actor_id="acme_manager",
            request_id="req-approve-conflict-source",
            case_id=first["approval_case_id"],
            decision_value="approved",
        )
        asyncio.run(
            self.service.resume(
                tenant_id="acme",
                actor_id="acme_alice",
                request_id="req-submit-conflict-source",
                business_run_id=first["business_run_id"],
            )
        )
        with self.assertRaisesRegex(LeaveRequestError, "日期.*冲突"):
            self._create("2030-04-10", "2030-04-10")

        failing_service = LeaveRequestService(
            database=self.database,
            identity=self.identity,
            authorization=self.authorization,
            runtime=self.runtime,
            hr=self.hr,
            runtime_resume=None,
        )
        failed = self._create("2030-05-10", "2030-05-10")
        failing_service.decide(
            tenant_id="acme",
            actor_id="acme_manager",
            request_id="req-approve-failure",
            case_id=failed["approval_case_id"],
            decision_value="approved",
        )
        with self.assertRaisesRegex(LeaveRequestError, "AgentScope 恢复执行失败"):
            asyncio.run(
                failing_service.resume(
                    tenant_id="acme",
                    actor_id="acme_alice",
                    request_id="req-runtime-failure",
                    business_run_id=failed["business_run_id"],
                )
            )
        self.assertEqual(
            failing_service.get_run("acme", failed["business_run_id"])["status"],
            "submit_failed",
        )


if __name__ == "__main__":
    unittest.main()
