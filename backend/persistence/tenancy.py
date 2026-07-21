"""Tenancy repositories.

Phase 2 keeps tenancy access behind small repository boundaries so the platform
can move member registry behavior to PostgreSQL without coupling services to SQL.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class TenantRecord:
    id: str
    name: str
    status: str
    plan: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class UserRecord:
    id: str
    display_name: str
    email: str | None
    status: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class MembershipRecord:
    id: str
    tenant_id: str
    user_id: str
    role: str
    workspace_ids: list[str]
    created_at: str
    updated_at: str


def _membership_from_row(row: dict[str, Any]) -> MembershipRecord:
    workspace_ids = json.loads(row["workspace_ids"])
    if not isinstance(workspace_ids, list) or not all(
        isinstance(workspace_id, str) for workspace_id in workspace_ids
    ):
        raise ValueError(
            f"Membership {row['id']} has invalid workspace_ids JSON.",
        )
    return MembershipRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        user_id=row["user_id"],
        role=row["role"],
        workspace_ids=workspace_ids,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class SQLiteTenancyReadRepository:
    """Read tenant, user, and membership records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_tenants(self, *, status: str | None = None) -> list[TenantRecord]:
        query = """
            SELECT id, name, status, plan, created_at, updated_at
            FROM tenants
        """
        parameters: list[Any] = []
        if status is not None:
            query += " WHERE status = ?"
            parameters.append(status)
        query += " ORDER BY id"

        with self._database.connect() as connection:
            return [
                TenantRecord(**dict(row))
                for row in connection.execute(query, parameters).fetchall()
            ]

    def get_tenant(self, tenant_id: str) -> TenantRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, status, plan, created_at, updated_at
                FROM tenants
                WHERE id = ?
                """,
                (tenant_id,),
            ).fetchone()
        if row is None:
            return None
        return TenantRecord(**dict(row))

    def list_users(self, *, tenant_id: str | None = None) -> list[UserRecord]:
        if tenant_id is None:
            query = """
                SELECT id, display_name, email, status, created_at, updated_at
                FROM users
                ORDER BY id
            """
            parameters: tuple[Any, ...] = ()
        else:
            query = """
                SELECT users.id, users.display_name, users.email, users.status,
                  users.created_at, users.updated_at
                FROM users
                INNER JOIN memberships ON memberships.user_id = users.id
                WHERE memberships.tenant_id = ?
                ORDER BY users.id
            """
            parameters = (tenant_id,)

        with self._database.connect() as connection:
            return [
                UserRecord(**dict(row))
                for row in connection.execute(query, parameters).fetchall()
            ]

    def list_memberships(
        self,
        *,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> list[MembershipRecord]:
        query = """
            SELECT id, tenant_id, user_id, role, workspace_ids, created_at, updated_at
            FROM memberships
        """
        clauses: list[str] = []
        parameters: list[Any] = []
        if tenant_id is not None:
            clauses.append("tenant_id = ?")
            parameters.append(tenant_id)
        if user_id is not None:
            clauses.append("user_id = ?")
            parameters.append(user_id)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY tenant_id, user_id"

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_membership_from_row(dict(row)) for row in rows]


class PostgresTenancyReadRepository:
    """Read tenant, user, and membership records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_tenants(self, *, status: str | None = None) -> list[TenantRecord]:
        query = """
            SELECT id, name, status, plan, created_at, updated_at
            FROM tenants
        """
        parameters: tuple[Any, ...] = ()
        if status is not None:
            query += " WHERE status = %s"
            parameters = (status,)
        query += " ORDER BY id"

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, parameters)
                return [TenantRecord(**dict(row)) for row in cursor.fetchall()]

    def get_tenant(self, tenant_id: str) -> TenantRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, status, plan, created_at, updated_at
                    FROM tenants
                    WHERE id = %s
                    """,
                    (tenant_id,),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return TenantRecord(**dict(row))

    def list_users(self, *, tenant_id: str | None = None) -> list[UserRecord]:
        if tenant_id is None:
            query = """
                SELECT id, display_name, email, status, created_at, updated_at
                FROM users
                ORDER BY id
            """
            parameters: tuple[Any, ...] = ()
        else:
            query = """
                SELECT users.id, users.display_name, users.email, users.status,
                  users.created_at, users.updated_at
                FROM users
                INNER JOIN memberships ON memberships.user_id = users.id
                WHERE memberships.tenant_id = %s
                ORDER BY users.id
            """
            parameters = (tenant_id,)

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, parameters)
                return [UserRecord(**dict(row)) for row in cursor.fetchall()]

    def list_memberships(
        self,
        *,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> list[MembershipRecord]:
        query = """
            SELECT id, tenant_id, user_id, role, workspace_ids, created_at, updated_at
            FROM memberships
        """
        clauses: list[str] = []
        parameters: list[Any] = []
        if tenant_id is not None:
            clauses.append("tenant_id = %s")
            parameters.append(tenant_id)
        if user_id is not None:
            clauses.append("user_id = %s")
            parameters.append(user_id)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY tenant_id, user_id"

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                rows = cursor.fetchall()
        return [_membership_from_row(dict(row)) for row in rows]


class PostgresTenancyWriteRepository:
    """Write tenant, user, and membership registry records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def upsert_member(
        self,
        *,
        tenant_id: str,
        user_id: str,
        display_name: str,
        role: str,
        status: str,
        created_at: str,
        updated_at: str,
    ) -> None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO tenants (id, name, status, plan, created_at, updated_at)
                    VALUES (%s, %s, 'active', 'development', %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                      name = excluded.name,
                      status = excluded.status,
                      updated_at = excluded.updated_at
                    """,
                    (
                        tenant_id,
                        _display_name_from_id(tenant_id),
                        created_at,
                        updated_at,
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO users (
                      id, display_name, email, status, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                      display_name = excluded.display_name,
                      status = excluded.status,
                      updated_at = excluded.updated_at
                    """,
                    (
                        user_id,
                        display_name,
                        _email_from_user_id(user_id),
                        status,
                        created_at,
                        updated_at,
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO memberships (
                      id, tenant_id, user_id, role, workspace_ids, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, '[]', %s, %s)
                    ON CONFLICT(tenant_id, user_id) DO UPDATE SET
                      role = excluded.role,
                      updated_at = excluded.updated_at
                    """,
                    (
                        f"{tenant_id}:{user_id}",
                        tenant_id,
                        user_id,
                        role,
                        created_at,
                        updated_at,
                    ),
                )


def _display_name_from_id(value: str) -> str:
    return value.replace("_", " ").replace("-", " ").title() or value


def _email_from_user_id(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    tenant, username = user_id.split(":", 1)
    if not tenant or not username:
        return None
    return f"{username}@{tenant}.example"
