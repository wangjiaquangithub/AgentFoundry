from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


BACKEND = Path(__file__).resolve().parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from api.authentication import AuthenticationRouteDependencies, create_authentication_router
from api.enterprise_identity import EnterpriseIdentityRouteDependencies, create_enterprise_identity_router
from api.request_authentication import RequestIdentityAuthenticationMiddleware
from backend.persistence.database import create_database
from backend.persistence.migrations import apply_migrations
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import EnterpriseIdentityService
from backend.services.local_authentication import LocalAuthenticationService


class AuthenticationApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.url = f"sqlite:///{Path(self.temp_dir.name) / 'authentication-api.db'}"
        apply_migrations(self.url)
        self.database = create_database(self.url)
        self.authentication = LocalAuthenticationService(self.database)
        self.identity = EnterpriseIdentityService(self.database)
        self.authorization = AuthorizationService(self.database)
        timestamp = datetime.now(UTC).isoformat()
        with self.database.transaction() as connection:
            for tenant in ("tenant-a", "tenant-b"):
                connection.execute(
                    "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                    "VALUES (?, ?, 'active', ?, ?)",
                    (tenant, tenant, timestamp, timestamp),
                )
            for user_id, tenant_id, role in (
                ("admin-a", "tenant-a", "tenant_admin"),
                ("employee-a", "tenant-a", "employee"),
                ("admin-b", "tenant-b", "tenant_admin"),
            ):
                connection.execute(
                    "INSERT INTO users (id, display_name, email, status, created_at, updated_at) "
                    "VALUES (?, ?, ?, 'active', ?, ?)",
                    (user_id, user_id, f"{user_id}@example.invalid", timestamp, timestamp),
                )
                connection.execute(
                    """INSERT INTO memberships
                    (id, tenant_id, user_id, role, workspace_ids, status, version, source,
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, '[]', 'active', 1, 'test', ?, ?)""",
                    (f"mem-{user_id}", tenant_id, user_id, role, timestamp, timestamp),
                )
        for user_id in ("admin-a", "employee-a", "admin-b"):
            self.authentication.set_password(user_id=user_id, password=f"password-{user_id}")
        self.authorization.ensure_tenant_defaults("tenant-a", "admin-a")
        self.authorization.ensure_tenant_defaults("tenant-b", "admin-b")
        app = FastAPI()
        app.add_middleware(
            RequestIdentityAuthenticationMiddleware,
            production_mode=True,
            shared_secret="test-proxy-secret",
            local_authentication_service=lambda: self.authentication,
        )
        app.include_router(create_authentication_router(AuthenticationRouteDependencies(
            service=lambda: self.authentication, production_mode=True,
        )))
        app.include_router(create_enterprise_identity_router(EnterpriseIdentityRouteDependencies(
            service=lambda: self.identity,
            authorization_service=lambda: self.authorization,
            authentication_service=lambda: self.authentication,
        )))
        self.app = app

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def login(self, user_id: str, tenant_id: str) -> TestClient:
        client = TestClient(self.app, base_url="https://testserver")
        response = client.post("/api/auth/login", json={
            "tenant_id": tenant_id,
            "identifier": user_id,
            "password": f"password-{user_id}",
        })
        self.assertEqual(response.status_code, 200, response.text)
        return client

    def test_cookie_login_me_logout_and_no_cookie_rejection(self) -> None:
        anonymous = TestClient(self.app, base_url="https://testserver")
        self.assertEqual(anonymous.get("/api/auth/me").status_code, 401)
        client = self.login("admin-a", "tenant-a")
        self.assertIn("HttpOnly", client.post("/api/auth/logout").headers.get("set-cookie", ""))
        self.assertEqual(client.get("/api/auth/me").status_code, 401)

    def test_rbac_account_creation_and_password_reset_revokes_session(self) -> None:
        employee = self.login("employee-a", "tenant-a")
        self.assertEqual(employee.get("/api/platform/users").status_code, 403)
        admin = self.login("admin-a", "tenant-a")
        created = admin.post("/api/platform/users", json={
            "user_id": "new-user",
            "display_name": "New User",
            "email": "new-user@example.invalid",
            "role": "employee",
            "initial_password": "initial-password-123",
        })
        self.assertEqual(created.status_code, 201, created.text)
        new_user = TestClient(self.app, base_url="https://testserver")
        login = new_user.post("/api/auth/login", json={
            "tenant_id": "tenant-a", "identifier": "new-user",
            "password": "initial-password-123",
        })
        self.assertEqual(login.status_code, 200, login.text)
        reset = admin.put("/api/platform/users/new-user/password", json={
            "password": "replacement-password-123",
        })
        self.assertEqual(reset.status_code, 204, reset.text)
        self.assertEqual(new_user.get("/api/auth/me").status_code, 401)

    def test_tenant_isolation_uses_cookie_identity_not_request_headers(self) -> None:
        tenant_a = self.login("admin-a", "tenant-a")
        tenant_b = self.login("admin-b", "tenant-b")
        users_a = tenant_a.get("/api/platform/users", headers={
            "X-User-ID": "admin-b", "X-Tenant-ID": "tenant-b",
        })
        users_b = tenant_b.get("/api/platform/users", headers={
            "X-User-ID": "admin-a", "X-Tenant-ID": "tenant-a",
        })
        self.assertEqual(users_a.status_code, 200, users_a.text)
        self.assertEqual(users_b.status_code, 200, users_b.text)
        ids_a = {item["id"] for item in users_a.json()["items"]}
        ids_b = {item["id"] for item in users_b.json()["items"]}
        self.assertEqual(ids_a, {"admin-a", "employee-a"})
        self.assertEqual(ids_b, {"admin-b"})


if __name__ == "__main__":
    unittest.main()
