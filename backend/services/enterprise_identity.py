"""Tenant-scoped enterprise identity and organization management."""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase, create_database


class EnterpriseIdentityError(ValueError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


@dataclass(frozen=True)
class EnterpriseIdentityService:
    database: SQLiteDatabase | PostgresDatabase

    @property
    def _sqlite(self) -> bool:
        return isinstance(self.database, SQLiteDatabase)

    def _sql(self, value: str) -> str:
        return value if self._sqlite else value.replace("?", "%s")

    @staticmethod
    def _dict(row: Any) -> dict[str, Any]:
        return dict(row)

    def _one(self, connection: Any, sql: str, parameters: tuple[Any, ...]) -> dict[str, Any] | None:
        row = connection.execute(self._sql(sql), parameters).fetchone()
        return None if row is None else self._dict(row)

    def _all(self, connection: Any, sql: str, parameters: tuple[Any, ...]) -> list[dict[str, Any]]:
        return [self._dict(row) for row in connection.execute(self._sql(sql), parameters).fetchall()]

    def _membership(self, connection: Any, tenant_id: str, user_id: str) -> dict[str, Any]:
        record = self._one(
            connection,
            """SELECT memberships.*, users.display_name, users.email,
                      users.status AS user_status
                 FROM memberships JOIN users ON users.id = memberships.user_id
                WHERE memberships.tenant_id = ? AND memberships.user_id = ?""",
            (tenant_id, user_id),
        )
        if record is None:
            raise EnterpriseIdentityError(404, "tenant membership was not found")
        return record

    def require_active_subject(self, tenant_id: str, user_id: str) -> dict[str, Any]:
        with self.database.connect() as connection:
            record = self._membership(connection, tenant_id, user_id)
        if record["user_status"] != "active":
            raise EnterpriseIdentityError(403, "account is inactive")
        if record.get("status", "active") != "active":
            raise EnterpriseIdentityError(403, "tenant membership is inactive")
        return record

    def _audit(
        self,
        connection: Any,
        *,
        tenant_id: str,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        source: str,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
    ) -> None:
        timestamp = _now()
        values = (
            _id("imut"), tenant_id, actor_id, action, resource_type, resource_id,
            source, json.dumps(before, ensure_ascii=False) if before else None,
            json.dumps(after, ensure_ascii=False) if after else None, timestamp,
        )
        connection.execute(
            self._sql("""INSERT INTO identity_mutations
                (id, tenant_id, actor_user_id, action, resource_type, resource_id,
                 source, before_summary, after_summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
            values,
        )

    def create_user(
        self,
        *,
        tenant_id: str,
        actor_id: str,
        display_name: str,
        email: str,
        role: str = "employee",
        source: str = "local",
        user_id: str | None = None,
    ) -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        normalized_email = email.strip().lower()
        if not display_name.strip() or not normalized_email:
            raise EnterpriseIdentityError(422, "display_name and email are required")
        timestamp = _now()
        candidate_id = user_id or _id("usr")
        membership_id = _id("mem")
        with self.database.transaction() as connection:
            duplicate = self._one(
                connection,
                """SELECT users.id FROM users JOIN memberships ON memberships.user_id=users.id
                    WHERE memberships.tenant_id=? AND lower(users.email)=?""",
                (tenant_id, normalized_email),
            )
            if duplicate:
                raise EnterpriseIdentityError(409, "email already exists in tenant")
            existing = self._one(connection, "SELECT id FROM users WHERE id=?", (candidate_id,))
            if existing is None:
                connection.execute(
                    self._sql("""INSERT INTO users
                      (id, display_name, email, status, created_at, updated_at)
                      VALUES (?, ?, ?, 'active', ?, ?)"""),
                    (candidate_id, display_name.strip(), normalized_email, timestamp, timestamp),
                )
            connection.execute(
                self._sql("""INSERT INTO memberships
                  (id, tenant_id, user_id, role, workspace_ids, status, version,
                   source, created_at, updated_at)
                  VALUES (?, ?, ?, ?, '[]', 'active', 1, ?, ?, ?)"""),
                (membership_id, tenant_id, candidate_id, role, source, timestamp, timestamp),
            )
            result = {
                "id": candidate_id, "membership_id": membership_id,
                "display_name": display_name.strip(), "email": normalized_email,
                "status": "active", "membership_status": "active", "role": role,
            }
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="identity.user.created", resource_type="user",
                        resource_id=candidate_id, source=source, before=None, after=result)
        return result

    def list_users(self, tenant_id: str, *, include_inactive: bool = False) -> list[dict[str, Any]]:
        clause = "" if include_inactive else " AND users.status='active'"
        with self.database.connect() as connection:
            return self._all(connection, f"""SELECT users.id, users.display_name, users.email,
                   users.status, memberships.id AS membership_id, memberships.role,
                   COALESCE(memberships.status, 'active') AS membership_status
                FROM users JOIN memberships ON memberships.user_id=users.id
               WHERE memberships.tenant_id=?{clause} ORDER BY users.display_name""", (tenant_id,))

    def deactivate_user(self, *, tenant_id: str, actor_id: str, user_id: str, source: str = "local") -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        with self.database.transaction() as connection:
            before = self._membership(connection, tenant_id, user_id)
            timestamp = _now()
            connection.execute(self._sql("UPDATE users SET status='inactive', updated_at=? WHERE id=?"), (timestamp, user_id))
            connection.execute(self._sql("UPDATE memberships SET status='inactive', updated_at=? WHERE tenant_id=? AND user_id=?"), (timestamp, tenant_id, user_id))
            after = {"id": user_id, "status": "inactive", "membership_status": "inactive"}
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="identity.user.deactivated", resource_type="user",
                        resource_id=user_id, source=source, before=before, after=after)
        return after

    def create_organization(self, *, tenant_id: str, actor_id: str, name: str, source: str = "local") -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        record = {"id": _id("org"), "tenant_id": tenant_id, "name": name.strip(), "status": "active", "version": 1}
        if not record["name"]:
            raise EnterpriseIdentityError(422, "organization name is required")
        timestamp = _now()
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO organizations
              (id, tenant_id, name, status, version, created_by, source, created_at, updated_at)
              VALUES (?, ?, ?, 'active', 1, ?, ?, ?, ?)"""),
              (record["id"], tenant_id, record["name"], actor_id, source, timestamp, timestamp))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="organization.created", resource_type="organization",
                        resource_id=record["id"], source=source, before=None, after=record)
        return record

    def create_unit(self, *, tenant_id: str, actor_id: str, organization_id: str,
                    name: str, parent_id: str | None = None, unit_type: str = "department",
                    source: str = "local") -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        record = {"id": _id("ou"), "tenant_id": tenant_id, "organization_id": organization_id,
                  "parent_id": parent_id, "name": name.strip(), "unit_type": unit_type,
                  "status": "active", "version": 1}
        timestamp = _now()
        with self.database.transaction() as connection:
            org = self._one(connection, "SELECT id FROM organizations WHERE id=? AND tenant_id=? AND status='active'", (organization_id, tenant_id))
            if org is None:
                raise EnterpriseIdentityError(404, "organization was not found")
            if parent_id and self._one(connection, "SELECT id FROM organization_units WHERE id=? AND tenant_id=? AND organization_id=?", (parent_id, tenant_id, organization_id)) is None:
                raise EnterpriseIdentityError(422, "parent organization unit is invalid")
            connection.execute(self._sql("""INSERT INTO organization_units
              (id, tenant_id, organization_id, parent_id, name, unit_type, status,
               version, created_by, source, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)"""),
              (record["id"], tenant_id, organization_id, parent_id, record["name"], unit_type, actor_id, source, timestamp, timestamp))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="organization_unit.created", resource_type="organization_unit",
                        resource_id=record["id"], source=source, before=None, after=record)
        return record

    def list_units(self, tenant_id: str) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            return self._all(connection, "SELECT * FROM organization_units WHERE tenant_id=? ORDER BY name", (tenant_id,))

    def assign_unit(self, *, tenant_id: str, actor_id: str, membership_id: str,
                    organization_unit_id: str, assignment_type: str = "primary",
                    position_id: str | None = None, source: str = "local") -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        if assignment_type not in {"primary", "auxiliary"}:
            raise EnterpriseIdentityError(422, "assignment_type must be primary or auxiliary")
        record = {"id": _id("assign"), "tenant_id": tenant_id, "membership_id": membership_id,
                  "organization_unit_id": organization_unit_id, "position_id": position_id,
                  "assignment_type": assignment_type, "status": "active", "version": 1}
        timestamp = _now()
        with self.database.transaction() as connection:
            if self._one(connection, "SELECT id FROM memberships WHERE id=? AND tenant_id=?", (membership_id, tenant_id)) is None:
                raise EnterpriseIdentityError(404, "membership was not found")
            if self._one(connection, "SELECT id FROM organization_units WHERE id=? AND tenant_id=?", (organization_unit_id, tenant_id)) is None:
                raise EnterpriseIdentityError(404, "organization unit was not found")
            if assignment_type == "primary":
                connection.execute(self._sql("UPDATE member_org_assignments SET status='inactive', updated_at=? WHERE tenant_id=? AND membership_id=? AND assignment_type='primary' AND status='active'"), (timestamp, tenant_id, membership_id))
            connection.execute(self._sql("""INSERT INTO member_org_assignments
              (id, tenant_id, membership_id, organization_unit_id, position_id,
               assignment_type, status, version, created_by, source, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)"""),
              (record["id"], tenant_id, membership_id, organization_unit_id, position_id, assignment_type, actor_id, source, timestamp, timestamp))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="membership.organization_assigned", resource_type="membership",
                        resource_id=membership_id, source=source, before=None, after=record)
        return record

    def set_manager(self, *, tenant_id: str, actor_id: str, membership_id: str,
                    manager_membership_id: str, source: str = "local") -> dict[str, Any]:
        self.require_active_subject(tenant_id, actor_id)
        if membership_id == manager_membership_id:
            raise EnterpriseIdentityError(422, "a member cannot manage itself")
        timestamp = _now()
        with self.database.transaction() as connection:
            for candidate in (membership_id, manager_membership_id):
                if self._one(connection, "SELECT id FROM memberships WHERE id=? AND tenant_id=?", (candidate, tenant_id)) is None:
                    raise EnterpriseIdentityError(422, "manager and member must belong to the same tenant")
            cursor = manager_membership_id
            visited: set[str] = set()
            while cursor and cursor not in visited:
                if cursor == membership_id:
                    raise EnterpriseIdentityError(409, "manager relation would create a cycle")
                visited.add(cursor)
                next_row = self._one(connection, "SELECT manager_membership_id FROM member_manager_relations WHERE tenant_id=? AND membership_id=? AND status='active'", (tenant_id, cursor))
                cursor = next_row["manager_membership_id"] if next_row else ""
            before = self._one(connection, "SELECT * FROM member_manager_relations WHERE tenant_id=? AND membership_id=?", (tenant_id, membership_id))
            if before:
                connection.execute(self._sql("""UPDATE member_manager_relations SET manager_membership_id=?, status='active',
                  version=version+1, created_by=?, source=?, updated_at=? WHERE tenant_id=? AND membership_id=?"""),
                  (manager_membership_id, actor_id, source, timestamp, tenant_id, membership_id))
                relation_id = before["id"]
            else:
                relation_id = _id("mgr")
                connection.execute(self._sql("""INSERT INTO member_manager_relations
                  (id, tenant_id, membership_id, manager_membership_id, status, version,
                   created_by, source, created_at, updated_at)
                  VALUES (?, ?, ?, ?, 'active', 1, ?, ?, ?, ?)"""),
                  (relation_id, tenant_id, membership_id, manager_membership_id, actor_id, source, timestamp, timestamp))
            after = {"id": relation_id, "membership_id": membership_id, "manager_membership_id": manager_membership_id, "status": "active"}
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="membership.manager_changed", resource_type="membership",
                        resource_id=membership_id, source=source, before=before, after=after)
        return after

    def organization_snapshot(self, tenant_id: str) -> dict[str, Any]:
        with self.database.connect() as connection:
            organizations = self._all(connection, "SELECT * FROM organizations WHERE tenant_id=? ORDER BY name", (tenant_id,))
            units = self._all(connection, "SELECT * FROM organization_units WHERE tenant_id=? ORDER BY name", (tenant_id,))
            assignments = self._all(connection, "SELECT * FROM member_org_assignments WHERE tenant_id=? AND status='active'", (tenant_id,))
            managers = self._all(connection, "SELECT * FROM member_manager_relations WHERE tenant_id=? AND status='active'", (tenant_id,))
        return {"organizations": organizations, "organization_units": units, "assignments": assignments, "manager_relations": managers}

    def list_memberships(self, tenant_id: str, *, include_inactive: bool = False) -> list[dict[str, Any]]:
        status_clause = "" if include_inactive else " AND memberships.status='active'"
        with self.database.connect() as connection:
            return self._all(connection, f"""SELECT memberships.id, memberships.tenant_id,
                   memberships.user_id, memberships.role, memberships.status,
                   memberships.version, memberships.source, users.display_name, users.email,
                   primary_assignment.organization_unit_id AS primary_department_id,
                   manager_relation.manager_membership_id
              FROM memberships
              JOIN users ON users.id=memberships.user_id
              LEFT JOIN member_org_assignments AS primary_assignment
                ON primary_assignment.membership_id=memberships.id
               AND primary_assignment.tenant_id=memberships.tenant_id
               AND primary_assignment.assignment_type='primary'
               AND primary_assignment.status='active'
              LEFT JOIN member_manager_relations AS manager_relation
                ON manager_relation.membership_id=memberships.id
               AND manager_relation.tenant_id=memberships.tenant_id
               AND manager_relation.status='active'
             WHERE memberships.tenant_id=?{status_clause}
             ORDER BY users.display_name""", (tenant_id,))

    def list_mutations(self, tenant_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            return self._all(connection, "SELECT * FROM identity_mutations WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?", (tenant_id, min(max(limit, 1), 500)))


def build_enterprise_identity_service() -> EnterpriseIdentityService | None:
    database_url = os.getenv("AGENTFOUNDRY_DATABASE_URL", "").strip()
    if not database_url:
        return None
    return EnterpriseIdentityService(create_database(database_url))
