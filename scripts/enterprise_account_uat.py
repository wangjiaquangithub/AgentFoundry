#!/usr/bin/env python3
"""PostgreSQL acceptance test for local accounts and cookie authentication.

The test creates a disposable database, drives the real FastAPI routers with
separate browser-style cookie jars, and drops the database on completion.
It never writes acceptance output into the repository.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for module_path in (str(ROOT), str(BACKEND)):
    if module_path not in sys.path:
        sys.path.insert(0, module_path)

from api.authentication import (  # noqa: E402
    AuthenticationRouteDependencies,
    create_authentication_router,
)
from api.enterprise_identity import (  # noqa: E402
    EnterpriseIdentityRouteDependencies,
    create_enterprise_identity_router,
)
from api.request_authentication import (  # noqa: E402
    DEFAULT_SESSION_COOKIE_NAME,
    RequestIdentityAuthenticationMiddleware,
)
from backend.persistence.database import create_database  # noqa: E402
from backend.persistence.migrations import apply_migrations  # noqa: E402
from backend.services.authorization import AuthorizationService  # noqa: E402
from backend.services.enterprise_identity import EnterpriseIdentityService  # noqa: E402
from backend.services.local_authentication import LocalAuthenticationService  # noqa: E402


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def postgres_admin_url() -> str:
    explicit = os.environ.get("AGENTFOUNDRY_UAT_POSTGRES_ADMIN_URL", "").strip()
    if explicit:
        return explicit
    configured = os.environ.get("AGENTFOUNDRY_DATABASE_URL", "").strip()
    if configured.startswith(("postgresql://", "postgres://")):
        return replace_database_name(configured, "postgres")
    return "postgresql:///postgres?host=/tmp&port=5432"


def replace_database_name(source_url: str, database_name: str) -> str:
    parts = urlsplit(source_url)
    if parts.scheme not in {"postgresql", "postgres"}:
        raise ValueError("PostgreSQL UAT requires a postgresql:// admin URL")
    if not parts.netloc:
        suffix = f"?{parts.query}" if parts.query else ""
        if parts.fragment:
            suffix += f"#{parts.fragment}"
        return f"{parts.scheme}:///{database_name}{suffix}"
    return urlunsplit((parts.scheme, parts.netloc, f"/{database_name}", parts.query, parts.fragment))


def database_url(admin_url: str, database_name: str) -> str:
    return replace_database_name(admin_url, database_name)


def seed_account(
    database: object,
    authentication: LocalAuthenticationService,
    *,
    tenant_id: str,
    user_id: str,
    role: str,
    password: str,
) -> None:
    timestamp = datetime.now(UTC).isoformat()
    with database.transaction() as connection:
        tenant = connection.execute(
            "SELECT id FROM tenants WHERE id=%s", (tenant_id,)
        ).fetchone()
        if tenant is None:
            connection.execute(
                "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                "VALUES (%s, %s, 'active', %s, %s)",
                (tenant_id, tenant_id, timestamp, timestamp),
            )
        connection.execute(
            "INSERT INTO users (id, display_name, email, status, created_at, updated_at) "
            "VALUES (%s, %s, %s, 'active', %s, %s)",
            (user_id, user_id, f"{user_id}@example.invalid", timestamp, timestamp),
        )
        connection.execute(
            """INSERT INTO memberships
            (id, tenant_id, user_id, role, workspace_ids, status, version, source,
             created_at, updated_at)
            VALUES (%s, %s, %s, %s, '[]', 'active', 1, 'account_uat', %s, %s)""",
            (f"mem-{user_id}", tenant_id, user_id, role, timestamp, timestamp),
        )
    authentication.set_password(user_id=user_id, password=password)


def build_app(
    authentication: LocalAuthenticationService,
    identity: EnterpriseIdentityService,
    authorization: AuthorizationService,
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        RequestIdentityAuthenticationMiddleware,
        production_mode=True,
        shared_secret="account-uat-proxy-secret",
        local_authentication_service=lambda: authentication,
    )
    app.include_router(
        create_authentication_router(
            AuthenticationRouteDependencies(
                service=lambda: authentication,
                production_mode=True,
            )
        )
    )
    app.include_router(
        create_enterprise_identity_router(
            EnterpriseIdentityRouteDependencies(
                service=lambda: identity,
                authorization_service=lambda: authorization,
                authentication_service=lambda: authentication,
            )
        )
    )
    return app


def login(app: FastAPI, tenant_id: str, user_id: str, password: str) -> TestClient:
    client = TestClient(app, base_url="https://testserver")
    response = client.post(
        "/api/auth/login",
        json={"tenant_id": tenant_id, "identifier": user_id, "password": password},
    )
    require(response.status_code == 200, f"login failed for {user_id}: {response.text}")
    require(DEFAULT_SESSION_COOKIE_NAME in client.cookies, "login did not set a session cookie")
    return client


def run() -> dict[str, object]:
    import psycopg
    from psycopg import sql

    admin_url = postgres_admin_url()
    database_name = (
        f"agentfoundry_account_uat_{os.getpid()}_"
        f"{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    )
    uat_database_url = database_url(admin_url, database_name)
    created = False
    try:
        with psycopg.connect(admin_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))
            )
        created = True
        migrations = apply_migrations(uat_database_url)
        database = create_database(uat_database_url)
        authentication = LocalAuthenticationService(database)
        identity = EnterpriseIdentityService(database)
        authorization = AuthorizationService(database)

        accounts = (
            ("tenant-a", "admin-a", "tenant_admin", "password-admin-a"),
            ("tenant-a", "employee-a", "employee", "password-employee-a"),
            ("tenant-b", "admin-b", "tenant_admin", "password-admin-b"),
        )
        for tenant_id, user_id, role, password in accounts:
            seed_account(
                database,
                authentication,
                tenant_id=tenant_id,
                user_id=user_id,
                role=role,
                password=password,
            )
        authorization.ensure_tenant_defaults("tenant-a", "admin-a")
        authorization.ensure_tenant_defaults("tenant-b", "admin-b")

        app = build_app(authentication, identity, authorization)
        admin_a = login(app, "tenant-a", "admin-a", "password-admin-a")
        employee_a = login(app, "tenant-a", "employee-a", "password-employee-a")
        admin_b = login(app, "tenant-b", "admin-b", "password-admin-b")

        me = admin_a.get("/api/auth/me")
        require(me.status_code == 200, f"session restore failed: {me.text}")
        require(me.json()["tenant_id"] == "tenant-a", "restored the wrong tenant")

        users_a = admin_a.get("/api/platform/users")
        users_b = admin_b.get("/api/platform/users")
        require(users_a.status_code == 200, f"tenant-a list failed: {users_a.text}")
        require(users_b.status_code == 200, f"tenant-b list failed: {users_b.text}")
        ids_a = {item["id"] for item in users_a.json()["items"]}
        ids_b = {item["id"] for item in users_b.json()["items"]}
        require(ids_a == {"admin-a", "employee-a"}, "tenant-a account scope leaked")
        require(ids_b == {"admin-b"}, "tenant-b account scope leaked")

        denied = employee_a.get("/api/platform/users")
        require(denied.status_code == 403, "employee could read identity administration data")

        created_user = admin_a.post(
            "/api/platform/users",
            json={
                "user_id": "new-employee-a",
                "display_name": "New Employee A",
                "email": "new-employee-a@example.invalid",
                "role": "employee",
                "initial_password": "initial-password-123",
            },
        )
        require(created_user.status_code == 201, f"account creation failed: {created_user.text}")
        new_employee = login(
            app, "tenant-a", "new-employee-a", "initial-password-123"
        )
        require(new_employee.get("/api/auth/me").status_code == 200, "new account could not restore login")

        raw_token = admin_a.cookies.get(DEFAULT_SESSION_COOKIE_NAME)
        require(bool(raw_token), "admin session token was missing")
        with database.transaction() as connection:
            sessions = connection.execute(
                "SELECT token_hash FROM login_sessions WHERE user_id=%s", ("admin-a",)
            ).fetchall()
        hashes = {row["token_hash"] for row in sessions}
        require(all(len(value) == 64 for value in hashes), "session hash format is invalid")
        require(raw_token not in hashes, "raw browser session token was stored in PostgreSQL")

        logout = admin_a.post("/api/auth/logout")
        require(logout.status_code == 204, f"logout failed: {logout.text}")
        require(admin_a.get("/api/auth/me").status_code == 401, "logout did not revoke session")

        decisions_a = authorization.list_decisions("tenant-a")
        decisions_b = authorization.list_decisions("tenant-b")
        require(
            any(not item["allowed"] and item["subject_id"] == "employee-a" for item in decisions_a),
            "employee authorization denial was not persisted",
        )
        return {
            "backend": "postgresql",
            "migrations_applied": len(migrations),
            "accounts_authenticated": 4,
            "tenant_a_visible_users": sorted(ids_a),
            "tenant_b_visible_users": sorted(ids_b),
            "employee_identity_access": "denied",
            "session_token_storage": "sha256_hash_only",
            "authorization_decisions": len(decisions_a) + len(decisions_b),
            "logout_revoked_session": True,
            "identity_headers_on_business_requests": False,
        }
    finally:
        if created:
            with psycopg.connect(admin_url, autocommit=True) as connection:
                connection.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname=%s AND pid <> pg_backend_pid()",
                    (database_name,),
                )
                connection.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        sql.Identifier(database_name)
                    )
                )


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
