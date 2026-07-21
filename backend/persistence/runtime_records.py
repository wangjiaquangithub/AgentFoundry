"""Runtime provider and invocation read repositories.

Runtime providers are global platform configuration. Runtime invocations are
tenant-scoped execution evidence and must always be read through an explicit
tenant boundary. PostgreSQL is the production path; SQLite remains an explicit
local development compatibility path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class RuntimeProviderRecord:
    id: str
    name: str
    provider_type: str
    mode: str
    status: str
    capabilities: dict[str, Any]
    config_ref: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class RuntimeInvocationRecord:
    id: str
    tenant_id: str
    provider_id: str | None
    agent_run_id: str | None
    request_summary: dict[str, Any]
    response_summary: dict[str, Any] | None
    provider_run_id: str | None
    latency_ms: int | None
    token_usage: dict[str, Any] | None
    error: str | None
    created_at: str
    completed_at: str | None


def _provider_from_row(row: dict[str, Any]) -> RuntimeProviderRecord:
    return RuntimeProviderRecord(
        id=row["id"],
        name=row["name"],
        provider_type=row["provider_type"],
        mode=row["mode"],
        status=row["status"],
        capabilities=_object_from_json(row["capabilities"], row["id"], "capabilities"),
        config_ref=row["config_ref"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _invocation_from_row(row: dict[str, Any]) -> RuntimeInvocationRecord:
    return RuntimeInvocationRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        provider_id=row["provider_id"],
        agent_run_id=row["agent_run_id"],
        request_summary=_object_from_json(
            row["request_summary"],
            row["id"],
            "request_summary",
        ),
        response_summary=_optional_object_from_json(
            row["response_summary"],
            row["id"],
            "response_summary",
        ),
        provider_run_id=row["provider_run_id"],
        latency_ms=row["latency_ms"],
        token_usage=_optional_object_from_json(
            row["token_usage"],
            row["id"],
            "token_usage",
        ),
        error=row["error"],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
    )


def _object_from_json(
    value: dict[str, Any] | str,
    record_id: str,
    field_name: str,
) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError(f"Runtime record {record_id} has invalid {field_name} JSON.")
    return parsed


def _optional_object_from_json(
    value: dict[str, Any] | str | None,
    record_id: str,
    field_name: str,
) -> dict[str, Any] | None:
    if value is None:
        return None
    return _object_from_json(value, record_id, field_name)


class SQLiteRuntimeReadRepository:
    """Read runtime providers and tenant-scoped invocations from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_providers(
        self,
        *,
        status: str | None = None,
        provider_type: str | None = None,
        limit: int = 50,
    ) -> list[RuntimeProviderRecord]:
        query = """
            SELECT id, name, provider_type, mode, status, capabilities,
              config_ref, created_at, updated_at
            FROM runtime_providers
            WHERE 1 = 1
        """
        parameters: list[Any] = []
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        if provider_type is not None:
            query += " AND provider_type = ?"
            parameters.append(provider_type)
        query += " ORDER BY updated_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_provider_from_row(dict(row)) for row in rows]

    def get_provider(self, *, provider_id: str) -> RuntimeProviderRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, provider_type, mode, status, capabilities,
                  config_ref, created_at, updated_at
                FROM runtime_providers
                WHERE id = ?
                """,
                (provider_id,),
            ).fetchone()
        if row is None:
            return None
        return _provider_from_row(dict(row))

    def list_invocations(
        self,
        *,
        tenant_id: str,
        provider_id: str | None = None,
        agent_run_id: str | None = None,
        limit: int = 50,
    ) -> list[RuntimeInvocationRecord]:
        query = """
            SELECT id, tenant_id, provider_id, agent_run_id, request_summary,
              response_summary, provider_run_id, latency_ms, token_usage, error,
              created_at, completed_at
            FROM runtime_invocations
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if provider_id is not None:
            query += " AND provider_id = ?"
            parameters.append(provider_id)
        if agent_run_id is not None:
            query += " AND agent_run_id = ?"
            parameters.append(agent_run_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_invocation_from_row(dict(row)) for row in rows]

    def get_invocation(
        self,
        *,
        tenant_id: str,
        runtime_invocation_id: str,
    ) -> RuntimeInvocationRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, provider_id, agent_run_id, request_summary,
                  response_summary, provider_run_id, latency_ms, token_usage,
                  error, created_at, completed_at
                FROM runtime_invocations
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, runtime_invocation_id),
            ).fetchone()
        if row is None:
            return None
        return _invocation_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresRuntimeReadRepository:
    """Read runtime providers and tenant-scoped invocations from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_providers(
        self,
        *,
        status: str | None = None,
        provider_type: str | None = None,
        limit: int = 50,
    ) -> list[RuntimeProviderRecord]:
        query = """
            SELECT id, name, provider_type, mode, status, capabilities,
              config_ref, created_at, updated_at
            FROM runtime_providers
            WHERE 1 = 1
        """
        parameters: list[Any] = []
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        if provider_type is not None:
            query += " AND provider_type = %s"
            parameters.append(provider_type)
        query += " ORDER BY updated_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_provider_from_row(dict(row)) for row in cursor.fetchall()]

    def get_provider(self, *, provider_id: str) -> RuntimeProviderRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, provider_type, mode, status, capabilities,
                      config_ref, created_at, updated_at
                    FROM runtime_providers
                    WHERE id = %s
                    """,
                    (provider_id,),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _provider_from_row(dict(row))

    def list_invocations(
        self,
        *,
        tenant_id: str,
        provider_id: str | None = None,
        agent_run_id: str | None = None,
        limit: int = 50,
    ) -> list[RuntimeInvocationRecord]:
        query = """
            SELECT id, tenant_id, provider_id, agent_run_id, request_summary,
              response_summary, provider_run_id, latency_ms, token_usage, error,
              created_at, completed_at
            FROM runtime_invocations
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if provider_id is not None:
            query += " AND provider_id = %s"
            parameters.append(provider_id)
        if agent_run_id is not None:
            query += " AND agent_run_id = %s"
            parameters.append(agent_run_id)
        query += " ORDER BY created_at DESC, id DESC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [_invocation_from_row(dict(row)) for row in cursor.fetchall()]

    def get_invocation(
        self,
        *,
        tenant_id: str,
        runtime_invocation_id: str,
    ) -> RuntimeInvocationRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, provider_id, agent_run_id,
                      request_summary, response_summary, provider_run_id,
                      latency_ms, token_usage, error, created_at, completed_at
                    FROM runtime_invocations
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, runtime_invocation_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _invocation_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
