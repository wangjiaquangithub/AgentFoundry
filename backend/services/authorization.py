"""Tenant-scoped RBAC and ABAC authorization decisions."""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase, create_database


SCOPES = (
    "none", "self", "direct_reports", "department", "department_tree",
    "explicit_departments", "tenant",
)
SCOPE_RANK = {scope: index for index, scope in enumerate(SCOPES)}

PERMISSIONS: dict[str, str] = {
    code: code.replace(".", " ")
    for code in (
        "identity.read", "identity.manage", "organization.read", "organization.manage",
        "role.read", "role.manage", "role.assign", "agent.read", "agent.manage",
        "agent.publish", "agent.invoke", "tool.read", "tool.manage", "tool.invoke",
        "workflow.read", "workflow.manage", "workflow.invoke", "approval.read",
        "approval.review", "approval.admin", "report.read", "report.query",
        "report.export", "report.manage", "audit.read", "audit.export",
    )
}

BUILTIN_ROLES: dict[str, tuple[str, tuple[str, ...], str]] = {
    "tenant_admin": ("Tenant administrator", tuple(PERMISSIONS), "tenant"),
    "org_admin": ("Organization administrator", (
        "identity.read", "identity.manage", "organization.read", "organization.manage",
        "role.read", "role.assign", "agent.read", "approval.read",
    ), "tenant"),
    "agent_admin": ("Agent administrator", (
        "agent.read", "agent.manage", "agent.publish", "agent.invoke", "tool.read",
        "tool.manage", "workflow.read", "workflow.manage", "workflow.invoke",
    ), "tenant"),
    "employee": ("Employee", (
        "agent.read", "agent.invoke", "tool.invoke", "workflow.invoke",
        "approval.read", "report.read", "report.query",
    ), "self"),
    "line_manager": ("Line manager", (
        "agent.read", "agent.invoke", "tool.invoke", "workflow.invoke",
        "approval.read", "approval.review", "report.read", "report.query",
    ), "direct_reports"),
    "report_viewer": ("Report viewer", ("report.read", "report.query"), "self"),
    "report_manager": ("Report manager", (
        "report.read", "report.query", "report.export", "report.manage",
    ), "department"),
    "auditor": ("Auditor", ("audit.read", "audit.export", "report.read"), "tenant"),
}


class AuthorizationError(ValueError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _loads(value: Any, fallback: Any) -> Any:
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


@dataclass(frozen=True)
class AuthorizationService:
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

    def _membership(self, connection: Any, tenant_id: str, subject_id: str) -> dict[str, Any] | None:
        return self._one(connection, """SELECT memberships.*, users.status AS user_status
            FROM memberships JOIN users ON users.id=memberships.user_id
            WHERE memberships.tenant_id=? AND memberships.user_id=?""", (tenant_id, subject_id))

    def ensure_tenant_defaults(self, tenant_id: str, actor_id: str) -> None:
        timestamp = _now()
        with self.database.transaction() as connection:
            membership = self._membership(connection, tenant_id, actor_id)
            if membership is None:
                raise AuthorizationError(403, "actor is not a tenant member")
            for code, description in PERMISSIONS.items():
                permission_id = f"perm_{code.replace('.', '_')}"
                if self._one(connection, "SELECT id FROM permissions WHERE code=?", (code,)) is None:
                    connection.execute(self._sql("INSERT INTO permissions (id, code, description, created_at) VALUES (?, ?, ?, ?)"),
                                       (permission_id, code, description, timestamp))
            for code, (name, permission_codes, _) in BUILTIN_ROLES.items():
                role = self._one(connection, "SELECT id FROM roles WHERE tenant_id=? AND code=?", (tenant_id, code))
                role_id = role["id"] if role else _id("role")
                if role is None:
                    connection.execute(self._sql("""INSERT INTO roles
                      (id, tenant_id, code, name, description, built_in, status, version,
                       created_by, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, 1, 'active', 1, ?, ?, ?)"""),
                      (role_id, tenant_id, code, name, name, actor_id, timestamp, timestamp))
                for permission_code in permission_codes:
                    permission = self._one(connection, "SELECT id FROM permissions WHERE code=?", (permission_code,))
                    exists = self._one(connection, "SELECT id FROM role_permissions WHERE tenant_id=? AND role_id=? AND permission_id=?",
                                       (tenant_id, role_id, permission["id"]))
                    if exists is None:
                        connection.execute(self._sql("""INSERT INTO role_permissions
                          (id, tenant_id, role_id, permission_id, created_by, created_at)
                          VALUES (?, ?, ?, ?, ?, ?)"""),
                          (_id("rp"), tenant_id, role_id, permission["id"], actor_id, timestamp))
            members = self._all(connection, "SELECT id, user_id, role FROM memberships WHERE tenant_id=?", (tenant_id,))
            for member in members:
                role_code = member.get("role") or "employee"
                if role_code not in BUILTIN_ROLES:
                    continue
                role = self._one(connection, "SELECT id FROM roles WHERE tenant_id=? AND code=?", (tenant_id, role_code))
                existing = self._one(connection, """SELECT id FROM role_bindings
                    WHERE tenant_id=? AND role_id=? AND subject_type='user' AND subject_id=?
                      AND resource_type IS NULL AND resource_id IS NULL""",
                    (tenant_id, role["id"], member["user_id"]))
                if existing is None:
                    connection.execute(self._sql("""INSERT INTO role_bindings
                      (id, tenant_id, role_id, subject_type, subject_id, resource_type,
                       resource_id, data_scope, scope_config, status, version, source,
                       created_by, created_at, updated_at)
                      VALUES (?, ?, ?, 'user', ?, NULL, NULL, ?, '{}', 'active', 1,
                              'legacy_membership', ?, ?, ?)"""),
                      (_id("rb"), tenant_id, role["id"], member["user_id"],
                       BUILTIN_ROLES[role_code][2], actor_id, timestamp, timestamp))

    def list_roles(self, tenant_id: str, actor_id: str) -> list[dict[str, Any]]:
        self.ensure_tenant_defaults(tenant_id, actor_id)
        with self.database.connect() as connection:
            rows = self._all(connection, """SELECT roles.*, COALESCE(GROUP_CONCAT(permissions.code), '') AS permission_codes
                FROM roles LEFT JOIN role_permissions ON role_permissions.role_id=roles.id
                LEFT JOIN permissions ON permissions.id=role_permissions.permission_id
                WHERE roles.tenant_id=? GROUP BY roles.id ORDER BY roles.built_in DESC, roles.name""", (tenant_id,)) if self._sqlite else self._all(connection, """SELECT roles.*,
                COALESCE(string_agg(permissions.code, ','), '') AS permission_codes
                FROM roles LEFT JOIN role_permissions ON role_permissions.role_id=roles.id
                LEFT JOIN permissions ON permissions.id=role_permissions.permission_id
                WHERE roles.tenant_id=? GROUP BY roles.id ORDER BY roles.built_in DESC, roles.name""", (tenant_id,))
        for row in rows:
            row["permission_codes"] = [item for item in row["permission_codes"].split(",") if item]
            row["built_in"] = bool(row["built_in"])
        return rows

    def create_role(self, *, tenant_id: str, actor_id: str, code: str, name: str,
                    permission_codes: list[str], description: str | None = None) -> dict[str, Any]:
        self.ensure_tenant_defaults(tenant_id, actor_id)
        normalized = code.strip().lower()
        unknown = sorted(set(permission_codes) - set(PERMISSIONS))
        if not normalized or unknown:
            raise AuthorizationError(422, f"invalid role or permissions: {', '.join(unknown)}")
        timestamp, role_id = _now(), _id("role")
        with self.database.transaction() as connection:
            if self._one(connection, "SELECT id FROM roles WHERE tenant_id=? AND code=?", (tenant_id, normalized)):
                raise AuthorizationError(409, "role code already exists")
            connection.execute(self._sql("""INSERT INTO roles
              (id, tenant_id, code, name, description, built_in, status, version,
               created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 'active', 1, ?, ?, ?)"""),
              (role_id, tenant_id, normalized, name.strip(), description, actor_id, timestamp, timestamp))
            for permission_code in sorted(set(permission_codes)):
                permission = self._one(connection, "SELECT id FROM permissions WHERE code=?", (permission_code,))
                connection.execute(self._sql("""INSERT INTO role_permissions
                  (id, tenant_id, role_id, permission_id, created_by, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)"""),
                  (_id("rp"), tenant_id, role_id, permission["id"], actor_id, timestamp))
        return {"id": role_id, "tenant_id": tenant_id, "code": normalized, "name": name.strip(),
                "description": description, "built_in": False, "permission_codes": sorted(set(permission_codes))}

    def bind_role(self, *, tenant_id: str, actor_id: str, role_id: str,
                  subject_type: str, subject_id: str, data_scope: str = "none",
                  scope_config: dict[str, Any] | None = None,
                  resource_type: str | None = None, resource_id: str | None = None) -> dict[str, Any]:
        self.ensure_tenant_defaults(tenant_id, actor_id)
        if subject_type not in {"user", "membership", "organization_unit"} or data_scope not in SCOPES:
            raise AuthorizationError(422, "invalid role binding subject or data scope")
        timestamp, binding_id = _now(), _id("rb")
        with self.database.transaction() as connection:
            if self._one(connection, "SELECT id FROM roles WHERE id=? AND tenant_id=? AND status='active'", (role_id, tenant_id)) is None:
                raise AuthorizationError(404, "role was not found")
            if subject_type == "user" and self._membership(connection, tenant_id, subject_id) is None:
                raise AuthorizationError(422, "binding user is not a tenant member")
            connection.execute(self._sql("""INSERT INTO role_bindings
              (id, tenant_id, role_id, subject_type, subject_id, resource_type,
               resource_id, data_scope, scope_config, status, version, source,
               created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, 'local', ?, ?, ?)"""),
              (binding_id, tenant_id, role_id, subject_type, subject_id, resource_type,
               resource_id, data_scope, _json(scope_config or {}), actor_id, timestamp, timestamp))
        return {"id": binding_id, "role_id": role_id, "subject_type": subject_type,
                "subject_id": subject_id, "resource_type": resource_type, "resource_id": resource_id,
                "data_scope": data_scope, "scope_config": scope_config or {}, "status": "active"}

    def create_resource_grant(self, *, tenant_id: str, actor_id: str, subject_type: str,
                              subject_id: str, action: str, resource_type: str,
                              resource_id: str, data_scope: str = "none",
                              conditions: dict[str, Any] | None = None) -> dict[str, Any]:
        self.ensure_tenant_defaults(tenant_id, actor_id)
        if subject_type not in {"user", "membership", "organization_unit"} or data_scope not in SCOPES:
            raise AuthorizationError(422, "invalid resource grant")
        timestamp, grant_id = _now(), _id("rg")
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO resource_grants
              (id, tenant_id, subject_type, subject_id, action, resource_type,
               resource_id, data_scope, conditions, status, version, created_by,
               created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)"""),
              (grant_id, tenant_id, subject_type, subject_id, action, resource_type,
               resource_id, data_scope, _json(conditions or {}), actor_id, timestamp, timestamp))
        return {"id": grant_id, "subject_type": subject_type, "subject_id": subject_id,
                "action": action, "resource_type": resource_type, "resource_id": resource_id,
                "data_scope": data_scope, "conditions": conditions or {}}

    def _subject_selectors(self, connection: Any, tenant_id: str,
                           membership: dict[str, Any]) -> list[tuple[str, str]]:
        selectors = [("user", membership["user_id"]), ("membership", membership["id"])]
        assignments = self._all(connection, """SELECT organization_unit_id FROM member_org_assignments
            WHERE tenant_id=? AND membership_id=? AND status='active'""", (tenant_id, membership["id"]))
        selectors.extend(("organization_unit", row["organization_unit_id"]) for row in assignments)
        return selectors

    def authorize(self, *, tenant_id: str, subject_id: str, action: str,
                  resource: dict[str, Any], environment: dict[str, Any] | None = None) -> dict[str, Any]:
        resource_type = str(resource.get("type") or "unknown")
        resource_id = resource.get("id")
        environment = environment or {}
        timestamp, decision_id = _now(), _id("authz")
        with self.database.connect() as probe:
            membership = self._membership(probe, tenant_id, subject_id)
        if membership is not None:
            self.ensure_tenant_defaults(tenant_id, subject_id)
        with self.database.transaction() as connection:
            membership = self._membership(connection, tenant_id, subject_id)
            reason = "DENY_NOT_TENANT_MEMBER"
            bindings: list[dict[str, Any]] = []
            grants: list[dict[str, Any]] = []
            if membership and membership.get("status", "active") == "active" and membership["user_status"] == "active":
                selectors = self._subject_selectors(connection, tenant_id, membership)
                for subject_type, selector_id in selectors:
                    bindings.extend(self._all(connection, """SELECT role_bindings.*, roles.code AS role_code,
                          permissions.code AS permission_code
                        FROM role_bindings JOIN roles ON roles.id=role_bindings.role_id
                        JOIN role_permissions ON role_permissions.role_id=roles.id
                        JOIN permissions ON permissions.id=role_permissions.permission_id
                       WHERE role_bindings.tenant_id=? AND role_bindings.subject_type=?
                         AND role_bindings.subject_id=? AND role_bindings.status='active'
                         AND roles.status='active' AND permissions.code=?
                         AND (role_bindings.resource_type IS NULL OR role_bindings.resource_type=?)
                         AND (role_bindings.resource_id IS NULL OR role_bindings.resource_id=?)""",
                        (tenant_id, subject_type, selector_id, action, resource_type, resource_id)))
                    grants.extend(self._all(connection, """SELECT * FROM resource_grants
                       WHERE tenant_id=? AND subject_type=? AND subject_id=? AND status='active'
                         AND (action=? OR action='*') AND resource_type=? AND resource_id=?""",
                        (tenant_id, subject_type, selector_id, action, resource_type, resource_id)))
                reason = "ALLOW_ROLE_PERMISSION" if bindings else ("ALLOW_RESOURCE_GRANT" if grants else "DENY_NO_MATCHING_PERMISSION")
            elif membership:
                reason = "DENY_INACTIVE_SUBJECT"
            allowed = bool(bindings or grants)
            scopes = [row["data_scope"] for row in bindings + grants if row.get("data_scope") in SCOPE_RANK]
            effective_scope = max(scopes, key=lambda value: SCOPE_RANK[value]) if scopes else "none"
            scope_details = {
                "primary_department_id": next((row["organization_unit_id"] for row in self._all(connection, """SELECT organization_unit_id FROM member_org_assignments
                    WHERE tenant_id=? AND membership_id=? AND assignment_type='primary' AND status='active'""",
                    (tenant_id, membership["id"] if membership else ""))), None),
                "explicit_departments": sorted({department for row in bindings + grants
                    for department in _loads(row.get("scope_config") or row.get("conditions"), {}).get("department_ids", [])}),
            }
            policy_version = f"enterprise-authz-v1:{tenant_id}"
            connection.execute(self._sql("""INSERT INTO authorization_decisions
              (id, tenant_id, subject_id, membership_id, action, resource_type,
               resource_id, allowed, reason_code, matched_role_bindings,
               matched_resource_grants, effective_scope, scope_details,
               policy_version, environment_summary, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
              (decision_id, tenant_id, subject_id, membership["id"] if membership else None,
               action, resource_type, resource_id, 1 if allowed else 0, reason,
               _json(sorted({row["id"] for row in bindings})),
               _json(sorted({row["id"] for row in grants})), effective_scope,
               _json(scope_details), policy_version,
               _json({key: environment[key] for key in sorted(environment) if key not in {"token", "credential", "password"}}), timestamp))
        return {"allowed": allowed, "reason_code": reason,
                "matched_role_bindings": sorted({row["id"] for row in bindings}),
                "matched_resource_grants": sorted({row["id"] for row in grants}),
                "effective_scope": effective_scope, "scope_details": scope_details,
                "policy_version": policy_version, "decision_id": decision_id}

    def list_bindings(self, tenant_id: str) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            rows = self._all(connection, """SELECT role_bindings.*, roles.code AS role_code
                FROM role_bindings JOIN roles ON roles.id=role_bindings.role_id
                WHERE role_bindings.tenant_id=? ORDER BY role_bindings.created_at""", (tenant_id,))
        for row in rows:
            row["scope_config"] = _loads(row.get("scope_config"), {})
        return rows

    def list_decisions(self, tenant_id: str, *, subject_id: str | None = None,
                       limit: int = 100) -> list[dict[str, Any]]:
        where, parameters = "tenant_id=?", [tenant_id]
        if subject_id:
            where += " AND subject_id=?"
            parameters.append(subject_id)
        parameters.append(min(max(limit, 1), 500))
        with self.database.connect() as connection:
            rows = self._all(connection, f"SELECT * FROM authorization_decisions WHERE {where} ORDER BY created_at DESC LIMIT ?", tuple(parameters))
        for row in rows:
            row["allowed"] = bool(row["allowed"])
            for field, fallback in (("matched_role_bindings", []), ("matched_resource_grants", []),
                                    ("scope_details", {}), ("environment_summary", {})):
                row[field] = _loads(row.get(field), fallback)
        return rows


def build_authorization_service() -> AuthorizationService | None:
    database_url = os.getenv("AGENTFOUNDRY_DATABASE_URL", "").strip()
    return AuthorizationService(create_database(database_url)) if database_url else None
