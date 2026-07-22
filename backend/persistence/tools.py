"""Tool governance read repositories.

These repositories keep tool catalog and policy reads tenant-scoped while the
platform migrates away from development JSON as the system of record.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class ToolRecord:
    id: str
    tenant_id: str
    name: str
    description: str | None
    category: str | None
    schema: dict[str, Any]
    status: str
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ToolPolicyRecord:
    id: str
    tenant_id: str
    tool_id: str
    allowed_roles: list[str]
    approval_required: bool
    rate_limit: dict[str, Any] | str | None
    data_access_scope: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ToolUserPolicyRecord:
    id: str
    tenant_id: str
    user_id: str
    allow_tools: list[str]
    deny_tools: list[str]
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class ToolPolicyWriteResult:
    policy_records: list[ToolPolicyRecord]
    user_policy_records: list[ToolUserPolicyRecord]


def _tool_from_row(row: dict[str, Any]) -> ToolRecord:
    schema = _object_from_json(row["schema"], row["id"], "schema")
    return ToolRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        description=row["description"],
        category=row["category"],
        schema=schema,
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _policy_from_row(row: dict[str, Any]) -> ToolPolicyRecord:
    return ToolPolicyRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        tool_id=row["tool_id"],
        allowed_roles=_string_list_from_json(
            row["allowed_roles"],
            row["id"],
            "allowed_roles",
        ),
        approval_required=bool(row["approval_required"]),
        rate_limit=_rate_limit_from_json(row["rate_limit"], row["id"]),
        data_access_scope=row["data_access_scope"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _user_policy_from_row(row: dict[str, Any]) -> ToolUserPolicyRecord:
    return ToolUserPolicyRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        user_id=row["user_id"],
        allow_tools=_string_list_from_json(
            row["allow_tools"],
            row["id"],
            "allow_tools",
        ),
        deny_tools=_string_list_from_json(
            row["deny_tools"],
            row["id"],
            "deny_tools",
        ),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _object_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> dict[str, Any]:
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Tool {record_id} has invalid {field_name} JSON.")
    return parsed


def _string_list_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> list[str]:
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError(
            f"Tool policy {record_id} has invalid {field_name} JSON.",
        )
    return parsed


def _rate_limit_from_json(
    value: str | None,
    record_id: str,
) -> dict[str, Any] | str | None:
    if value is None:
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return value
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, str):
        return parsed
    raise ValueError(f"Tool policy {record_id} has invalid rate_limit JSON.")


class SQLiteToolGovernanceReadRepository:
    """Read tenant-scoped tool catalog and policy records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_tools(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
    ) -> list[ToolRecord]:
        query = """
            SELECT id, tenant_id, name, description, category, schema, status,
              created_at, updated_at
            FROM tools
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY name"

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_tool_from_row(dict(row)) for row in rows]

    def get_tool(self, *, tenant_id: str, tool_id: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, category, schema, status,
                  created_at, updated_at
                FROM tools
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, tool_id),
            ).fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def get_tool_by_name(self, *, tenant_id: str, name: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, category, schema, status,
                  created_at, updated_at
                FROM tools
                WHERE tenant_id = ? AND name = ?
                """,
                (tenant_id, name),
            ).fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def list_policies(self, *, tenant_id: str) -> list[ToolPolicyRecord]:
        with self._database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                  rate_limit, data_access_scope, created_at, updated_at
                FROM tool_policies
                WHERE tenant_id = ?
                ORDER BY tool_id
                """,
                (tenant_id,),
            ).fetchall()
        return [_policy_from_row(dict(row)) for row in rows]

    def get_policy_for_tool(
        self,
        *,
        tenant_id: str,
        tool_id: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                  rate_limit, data_access_scope, created_at, updated_at
                FROM tool_policies
                WHERE tenant_id = ? AND tool_id = ?
                """,
                (tenant_id, tool_id),
            ).fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def get_policy_for_tool_name(
        self,
        *,
        tenant_id: str,
        tool_name: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT tool_policies.id, tool_policies.tenant_id,
                  tool_policies.tool_id, tool_policies.allowed_roles,
                  tool_policies.approval_required, tool_policies.rate_limit,
                  tool_policies.data_access_scope, tool_policies.created_at,
                  tool_policies.updated_at
                FROM tool_policies
                INNER JOIN tools ON tools.id = tool_policies.tool_id
                WHERE tool_policies.tenant_id = ? AND tools.tenant_id = ?
                  AND tools.name = ?
                """,
                (tenant_id, tenant_id, tool_name),
            ).fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def _tool_from_row(self, row: dict[str, Any]) -> ToolRecord:
        return _tool_from_row(row)

    def _policy_from_row(self, row: dict[str, Any]) -> ToolPolicyRecord:
        return _policy_from_row(row)

    def _object_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> dict[str, Any]:
        return _object_from_json(value, record_id, field_name)

    def _string_list_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> list[str]:
        return _string_list_from_json(value, record_id, field_name)

    def _rate_limit_from_json(
        self,
        value: str | None,
        record_id: str,
    ) -> dict[str, Any] | str | None:
        return _rate_limit_from_json(value, record_id)


class PostgresToolGovernanceReadRepository:
    """Read tenant-scoped tool catalog and policy records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def load_policy_snapshot(
        self,
        *,
        default_policy: dict[str, Any],
    ) -> dict[str, Any]:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tools.tenant_id, tools.name
                    FROM tool_policies
                    INNER JOIN tools ON tools.id = tool_policies.tool_id
                    WHERE tool_policies.tenant_id = tools.tenant_id
                      AND tools.status = 'active'
                    ORDER BY tools.tenant_id, tools.name
                    """,
                )
                rows = cursor.fetchall()
                cursor.execute(
                    """
                    SELECT id, tenant_id, user_id, allow_tools, deny_tools,
                      created_at, updated_at
                    FROM tool_user_policies
                    ORDER BY tenant_id, user_id
                    """,
                )
                user_policy_rows = cursor.fetchall()

        defaults = default_policy.get("defaults", {})
        if defaults is None:
            defaults = {}
        if not isinstance(defaults, dict):
            raise ValueError("Enterprise tool policy section defaults must be an object.")

        snapshot: dict[str, Any] = {
            "defaults": json.loads(json.dumps(defaults)),
            "tenants": {},
        }
        tenants: dict[str, Any] = snapshot["tenants"]

        allowed_by_tenant: dict[str, list[str]] = {}
        for row in rows:
            value = dict(row)
            tenant_id = str(value["tenant_id"])
            tool_name = str(value["name"])
            allowed_by_tenant.setdefault(tenant_id, []).append(tool_name)

        for tenant_id, allow in allowed_by_tenant.items():
            tenant_policy = tenants.setdefault(tenant_id, {})
            if not isinstance(tenant_policy, dict):
                tenant_policy = {}
                tenants[tenant_id] = tenant_policy
            tenant_policy["allow"] = allow

        for row in user_policy_rows:
            user_policy = _user_policy_from_row(dict(row))
            tenant_policy = tenants.setdefault(user_policy.tenant_id, {})
            if not isinstance(tenant_policy, dict):
                tenant_policy = {}
                tenants[user_policy.tenant_id] = tenant_policy
            users = tenant_policy.setdefault("users", {})
            if not isinstance(users, dict):
                users = {}
                tenant_policy["users"] = users
            users[user_policy.user_id] = {
                "allow": user_policy.allow_tools,
                "deny": user_policy.deny_tools,
            }

        return snapshot

    def list_tools(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
    ) -> list[ToolRecord]:
        query = """
            SELECT id, tenant_id, name, description, category, schema, status,
              created_at, updated_at
            FROM tools
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY name"

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_tool_from_row(dict(row)) for row in cursor.fetchall()]

    def get_tool(self, *, tenant_id: str, tool_id: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, category, schema, status,
                      created_at, updated_at
                    FROM tools
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, tool_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def get_tool_by_name(self, *, tenant_id: str, name: str) -> ToolRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, category, schema, status,
                      created_at, updated_at
                    FROM tools
                    WHERE tenant_id = %s AND name = %s
                    """,
                    (tenant_id, name),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _tool_from_row(dict(row))

    def list_policies(self, *, tenant_id: str) -> list[ToolPolicyRecord]:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                      rate_limit, data_access_scope, created_at, updated_at
                    FROM tool_policies
                    WHERE tenant_id = %s
                    ORDER BY tool_id
                    """,
                    (tenant_id,),
                )
                rows = cursor.fetchall()
        return [_policy_from_row(dict(row)) for row in rows]

    def get_policy_for_tool(
        self,
        *,
        tenant_id: str,
        tool_id: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, tool_id, allowed_roles, approval_required,
                      rate_limit, data_access_scope, created_at, updated_at
                    FROM tool_policies
                    WHERE tenant_id = %s AND tool_id = %s
                    """,
                    (tenant_id, tool_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))

    def get_policy_for_tool_name(
        self,
        *,
        tenant_id: str,
        tool_name: str,
    ) -> ToolPolicyRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tool_policies.id, tool_policies.tenant_id,
                      tool_policies.tool_id, tool_policies.allowed_roles,
                      tool_policies.approval_required, tool_policies.rate_limit,
                      tool_policies.data_access_scope, tool_policies.created_at,
                      tool_policies.updated_at
                    FROM tool_policies
                    INNER JOIN tools ON tools.id = tool_policies.tool_id
                    WHERE tool_policies.tenant_id = %s AND tools.tenant_id = %s
                      AND tools.name = %s
                    """,
                    (tenant_id, tenant_id, tool_name),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _policy_from_row(dict(row))


class PostgresToolGovernanceWriteRepository:
    """Write tenant-scoped tool catalog and policy records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def save_policy(
        self,
        policy: dict[str, Any],
        *,
        enterprise_tool_catalog: dict[str, dict[str, Any]],
        approval_required_tools: set[str],
        timestamp: str,
    ) -> ToolPolicyWriteResult:
        policy_records: list[ToolPolicyRecord] = []
        user_policy_records: list[ToolUserPolicyRecord] = []
        tenants = policy.get("tenants")
        if not isinstance(tenants, dict):
            return ToolPolicyWriteResult(
                policy_records=policy_records,
                user_policy_records=user_policy_records,
            )

        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                for tenant_id, tenant_policy in tenants.items():
                    if not isinstance(tenant_policy, dict):
                        continue

                    clean_tenant_id = str(tenant_id)
                    cursor.execute(
                        """
                        INSERT INTO tenants (id, name, status, plan, created_at, updated_at)
                        VALUES (%s, %s, 'active', NULL, %s, %s)
                        ON CONFLICT (id) DO UPDATE
                        SET updated_at = EXCLUDED.updated_at
                        """,
                        (
                            clean_tenant_id,
                            clean_tenant_id,
                            timestamp,
                            timestamp,
                        ),
                    )

                    allow = tenant_policy.get("allow")
                    if not isinstance(allow, list):
                        allow = []

                    for item in allow:
                        tool_name = str(item or "").strip()
                        if not tool_name:
                            continue
                        catalog = enterprise_tool_catalog.get(tool_name, {})
                        tool_id = f"{clean_tenant_id}:{tool_name}"
                        tool_schema = {
                            "input_key": catalog.get("input_key"),
                            "default_input": catalog.get("default_input"),
                        }
                        cursor.execute(
                            """
                            INSERT INTO tools (
                              id, tenant_id, name, description, category, schema,
                              status, created_at, updated_at
                            )
                            VALUES (%s, %s, %s, %s, 'enterprise', %s, 'active', %s, %s)
                            ON CONFLICT (tenant_id, name) DO UPDATE
                            SET description = EXCLUDED.description,
                              category = EXCLUDED.category,
                              schema = EXCLUDED.schema,
                              status = EXCLUDED.status,
                              updated_at = EXCLUDED.updated_at
                            """,
                            (
                                tool_id,
                                clean_tenant_id,
                                tool_name,
                                catalog.get("description"),
                                json.dumps(tool_schema, ensure_ascii=False),
                                timestamp,
                                timestamp,
                            ),
                        )
                        cursor.execute(
                            """
                            INSERT INTO tool_policies (
                              id, tenant_id, tool_id, allowed_roles,
                              approval_required, rate_limit, data_access_scope,
                              created_at, updated_at
                            )
                            VALUES (%s, %s, %s, %s, %s, NULL, 'tenant', %s, %s)
                            ON CONFLICT (tenant_id, tool_id) DO UPDATE
                            SET allowed_roles = EXCLUDED.allowed_roles,
                              approval_required = EXCLUDED.approval_required,
                              data_access_scope = EXCLUDED.data_access_scope,
                              updated_at = EXCLUDED.updated_at
                            RETURNING id, tenant_id, tool_id, allowed_roles,
                              approval_required, rate_limit, data_access_scope,
                              created_at, updated_at
                            """,
                            (
                                f"{tool_id}:policy",
                                clean_tenant_id,
                                tool_id,
                                json.dumps(["admin", "member"]),
                                1 if tool_name in approval_required_tools else 0,
                                timestamp,
                                timestamp,
                            ),
                        )
                        row = cursor.fetchone()
                        if row is None:
                            raise ValueError(
                                "Tool policy upsert did not return a row.",
                            )
                        policy_records.append(_policy_from_row(dict(row)))

                    users = tenant_policy.get("users")
                    if not isinstance(users, dict):
                        continue

                    for user_id, user_policy in users.items():
                        if not isinstance(user_policy, dict):
                            continue
                        clean_user_id = str(user_id).strip()
                        if not clean_user_id:
                            continue
                        raw_allow_tools = user_policy.get("allow")
                        if not isinstance(raw_allow_tools, list):
                            raw_allow_tools = []
                        raw_deny_tools = user_policy.get("deny")
                        if not isinstance(raw_deny_tools, list):
                            raw_deny_tools = []
                        allow_tools = [
                            str(item).strip()
                            for item in raw_allow_tools
                            if str(item).strip()
                        ]
                        deny_tools = [
                            str(item).strip()
                            for item in raw_deny_tools
                            if str(item).strip()
                        ]
                        cursor.execute(
                            """
                            INSERT INTO users (
                              id, display_name, email, status, created_at, updated_at
                            )
                            VALUES (%s, %s, NULL, 'active', %s, %s)
                            ON CONFLICT (id) DO UPDATE
                            SET updated_at = EXCLUDED.updated_at
                            """,
                            (
                                clean_user_id,
                                clean_user_id,
                                timestamp,
                                timestamp,
                            ),
                        )
                        cursor.execute(
                            """
                            INSERT INTO tool_user_policies (
                              id, tenant_id, user_id, allow_tools, deny_tools,
                              created_at, updated_at
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (tenant_id, user_id) DO UPDATE
                            SET allow_tools = EXCLUDED.allow_tools,
                              deny_tools = EXCLUDED.deny_tools,
                              updated_at = EXCLUDED.updated_at
                            RETURNING id, tenant_id, user_id, allow_tools,
                              deny_tools, created_at, updated_at
                            """,
                            (
                                f"{clean_tenant_id}:{clean_user_id}:tool-policy",
                                clean_tenant_id,
                                clean_user_id,
                                json.dumps(allow_tools, ensure_ascii=False),
                                json.dumps(deny_tools, ensure_ascii=False),
                                timestamp,
                                timestamp,
                            ),
                        )
                        row = cursor.fetchone()
                        if row is None:
                            raise ValueError(
                                "Tool user policy upsert did not return a row.",
                            )
                        user_policy_records.append(_user_policy_from_row(dict(row)))

        return ToolPolicyWriteResult(
            policy_records=policy_records,
            user_policy_records=user_policy_records,
        )
