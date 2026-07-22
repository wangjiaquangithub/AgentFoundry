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


@dataclass(frozen=True)
class TenancyWriteResult:
    tenant: TenantRecord
    user: UserRecord
    membership: MembershipRecord


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


def _validate_tenant_write_result(
    requested: TenantRecord,
    persisted: TenantRecord,
) -> None:
    if persisted.id != requested.id:
        raise RuntimeError(
            "PostgreSQL tenant write returned a record for another tenant.",
        )
    if persisted.name != requested.name:
        raise RuntimeError("PostgreSQL tenant write returned an unexpected name.")
    if persisted.status != requested.status:
        raise RuntimeError("PostgreSQL tenant write returned an unexpected status.")
    if persisted.updated_at != requested.updated_at:
        raise RuntimeError(
            "PostgreSQL tenant write returned an unexpected updated_at value.",
        )


def _validate_user_write_result(
    requested: UserRecord,
    persisted: UserRecord,
) -> None:
    if persisted.id != requested.id:
        raise RuntimeError(
            "PostgreSQL user write returned a record for another user.",
        )
    if persisted.display_name != requested.display_name:
        raise RuntimeError(
            "PostgreSQL user write returned an unexpected display name.",
        )
    if persisted.status != requested.status:
        raise RuntimeError("PostgreSQL user write returned an unexpected status.")
    if persisted.updated_at != requested.updated_at:
        raise RuntimeError(
            "PostgreSQL user write returned an unexpected updated_at value.",
        )


def _validate_membership_write_result(
    requested: MembershipRecord,
    persisted: MembershipRecord,
) -> None:
    if persisted.tenant_id != requested.tenant_id:
        raise RuntimeError(
            "PostgreSQL membership write returned a record for another tenant.",
        )
    if persisted.user_id != requested.user_id:
        raise RuntimeError(
            "PostgreSQL membership write returned a record for another user.",
        )
    if persisted.role != requested.role:
        raise RuntimeError("PostgreSQL membership write returned an unexpected role.")
    if persisted.updated_at != requested.updated_at:
        raise RuntimeError(
            "PostgreSQL membership write returned an unexpected updated_at value.",
        )


def _validate_tenant_read_result(
    record: TenantRecord,
    *,
    tenant_id: str | None = None,
    status: str | None = None,
) -> None:
    if tenant_id is not None and record.id != tenant_id:
        raise ValueError("PostgreSQL tenant read returned another tenant.")
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL tenant read returned another status.")


def _validate_membership_read_result(
    record: MembershipRecord,
    *,
    tenant_id: str | None = None,
    user_id: str | None = None,
) -> None:
    if tenant_id is not None and record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL membership read returned another tenant.")
    if user_id is not None and record.user_id != user_id:
        raise ValueError("PostgreSQL membership read returned another user.")


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
                rows = cursor.fetchall()
        records = [TenantRecord(**dict(row)) for row in rows]
        for record in records:
            _validate_tenant_read_result(record, status=status)
        return records

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
        record = TenantRecord(**dict(row))
        _validate_tenant_read_result(record, tenant_id=tenant_id)
        return record

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
        records = [_membership_from_row(dict(row)) for row in rows]
        for record in records:
            _validate_membership_read_result(
                record,
                tenant_id=tenant_id,
                user_id=user_id,
            )
        return records


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
    ) -> TenancyWriteResult:
        requested_tenant = TenantRecord(
            id=tenant_id,
            name=_display_name_from_id(tenant_id),
            status="active",
            plan="development",
            created_at=created_at,
            updated_at=updated_at,
        )
        requested_user = UserRecord(
            id=user_id,
            display_name=display_name,
            email=_email_from_user_id(user_id),
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )
        requested_membership = MembershipRecord(
            id=f"{tenant_id}:{user_id}",
            tenant_id=tenant_id,
            user_id=user_id,
            role=role,
            workspace_ids=[],
            created_at=created_at,
            updated_at=updated_at,
        )

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
                    RETURNING id, name, status, plan, created_at, updated_at
                    """,
                    (
                        requested_tenant.id,
                        requested_tenant.name,
                        requested_tenant.created_at,
                        requested_tenant.updated_at,
                    ),
                )
                tenant_row = cursor.fetchone()
                if tenant_row is None:
                    raise RuntimeError("Tenant upsert did not return a row.")
                tenant_record = TenantRecord(**dict(tenant_row))
                _validate_tenant_write_result(requested_tenant, tenant_record)

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
                    RETURNING id, display_name, email, status, created_at, updated_at
                    """,
                    (
                        requested_user.id,
                        requested_user.display_name,
                        requested_user.email,
                        requested_user.status,
                        requested_user.created_at,
                        requested_user.updated_at,
                    ),
                )
                user_row = cursor.fetchone()
                if user_row is None:
                    raise RuntimeError("User upsert did not return a row.")
                user_record = UserRecord(**dict(user_row))
                _validate_user_write_result(requested_user, user_record)

                cursor.execute(
                    """
                    INSERT INTO memberships (
                      id, tenant_id, user_id, role, workspace_ids, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, '[]', %s, %s)
                    ON CONFLICT(tenant_id, user_id) DO UPDATE SET
                      role = excluded.role,
                      updated_at = excluded.updated_at
                    RETURNING id, tenant_id, user_id, role, workspace_ids,
                      created_at, updated_at
                    """,
                    (
                        requested_membership.id,
                        requested_membership.tenant_id,
                        requested_membership.user_id,
                        requested_membership.role,
                        requested_membership.created_at,
                        requested_membership.updated_at,
                    ),
                )
                membership_row = cursor.fetchone()
                if membership_row is None:
                    raise RuntimeError("Membership upsert did not return a row.")
                membership_record = _membership_from_row(dict(membership_row))
                _validate_membership_write_result(
                    requested_membership,
                    membership_record,
                )

        return TenancyWriteResult(
            tenant=tenant_record,
            user=user_record,
            membership=membership_record,
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
