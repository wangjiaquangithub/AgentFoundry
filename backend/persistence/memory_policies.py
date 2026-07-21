"""Memory policy read repositories.

Memory policies are tenant-scoped governance records for long-term memory.
PostgreSQL is the production path; SQLite remains an explicit local
development compatibility path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class MemoryPolicyRecord:
    id: str
    tenant_id: str
    name: str
    scope: str
    retention_days: int | None
    write_mode: str
    read_roles: list[str]
    created_at: str
    updated_at: str


def _memory_policy_from_row(row: dict[str, Any]) -> MemoryPolicyRecord:
    return MemoryPolicyRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        scope=row["scope"],
        retention_days=row["retention_days"],
        write_mode=row["write_mode"],
        read_roles=_read_roles_from_json(row["read_roles"], row["id"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _read_roles_from_json(value: list[str] | str, policy_id: str) -> list[str]:
    parsed = value if isinstance(value, list) else json.loads(value)
    if not isinstance(parsed, list) or not all(
        isinstance(role, str) for role in parsed
    ):
        raise ValueError(f"Memory policy {policy_id} has invalid read_roles JSON.")
    return parsed


class SQLiteMemoryPolicyReadRepository:
    """Read tenant-scoped memory policies from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_memory_policies(
        self,
        *,
        tenant_id: str,
        scope: str | None = None,
        write_mode: str | None = None,
        limit: int = 50,
    ) -> list[MemoryPolicyRecord]:
        query = """
            SELECT id, tenant_id, name, scope, retention_days, write_mode,
              read_roles, created_at, updated_at
            FROM memory_policies
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if scope is not None:
            query += " AND scope = ?"
            parameters.append(scope)
        if write_mode is not None:
            query += " AND write_mode = ?"
            parameters.append(write_mode)
        query += " ORDER BY updated_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_memory_policy_from_row(dict(row)) for row in rows]

    def get_memory_policy(
        self,
        *,
        tenant_id: str,
        memory_policy_id: str,
    ) -> MemoryPolicyRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, scope, retention_days, write_mode,
                  read_roles, created_at, updated_at
                FROM memory_policies
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, memory_policy_id),
            ).fetchone()
        if row is None:
            return None
        return _memory_policy_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresMemoryPolicyReadRepository:
    """Read tenant-scoped memory policies from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_memory_policies(
        self,
        *,
        tenant_id: str,
        scope: str | None = None,
        write_mode: str | None = None,
        limit: int = 50,
    ) -> list[MemoryPolicyRecord]:
        query = """
            SELECT id, tenant_id, name, scope, retention_days, write_mode,
              read_roles, created_at, updated_at
            FROM memory_policies
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if scope is not None:
            query += " AND scope = %s"
            parameters.append(scope)
        if write_mode is not None:
            query += " AND write_mode = %s"
            parameters.append(write_mode)
        query += " ORDER BY updated_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_memory_policy_from_row(dict(row)) for row in cursor.fetchall()]

    def get_memory_policy(
        self,
        *,
        tenant_id: str,
        memory_policy_id: str,
    ) -> MemoryPolicyRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, scope, retention_days, write_mode,
                      read_roles, created_at, updated_at
                    FROM memory_policies
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, memory_policy_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _memory_policy_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
