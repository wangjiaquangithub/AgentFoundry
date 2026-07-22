"""Runtime provider and invocation persistence repositories.

Runtime providers are global platform configuration. Runtime invocations are
tenant-scoped execution evidence and must always be read through an explicit
tenant boundary. PostgreSQL is the production path; SQLite remains an explicit
local development compatibility path during the data-layer migration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, replace
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
    base_url: str | None
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
        base_url=row["base_url"],
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


def _validate_write_result(
    requested: RuntimeInvocationRecord,
    persisted: RuntimeInvocationRecord,
) -> None:
    if persisted.id != requested.id:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another invocation.",
        )
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL runtime invocation write returned another tenant.")
    if persisted.provider_id != requested.provider_id:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another provider.",
        )
    if persisted.agent_run_id != requested.agent_run_id:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another agent run.",
        )
    if persisted.request_summary != requested.request_summary:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another request summary.",
        )
    if persisted.response_summary != requested.response_summary:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another response summary.",
        )
    if persisted.provider_run_id != requested.provider_run_id:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another provider run.",
        )
    if persisted.latency_ms != requested.latency_ms:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another latency.",
        )
    if persisted.token_usage != requested.token_usage:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another token usage.",
        )
    if persisted.error != requested.error:
        raise ValueError("PostgreSQL runtime invocation write returned another error.")
    if persisted.created_at != requested.created_at:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another created time.",
        )
    if persisted.completed_at != requested.completed_at:
        raise ValueError(
            "PostgreSQL runtime invocation write returned another completed time.",
        )


def _validate_invocation_read_result(
    record: RuntimeInvocationRecord,
    *,
    tenant_id: str,
    provider_id: str | None = None,
    agent_run_id: str | None = None,
    runtime_invocation_id: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL runtime invocation read returned another tenant.")
    if provider_id is not None and record.provider_id != provider_id:
        raise ValueError("PostgreSQL runtime invocation read returned another provider.")
    if agent_run_id is not None and record.agent_run_id != agent_run_id:
        raise ValueError("PostgreSQL runtime invocation read returned another agent run.")
    if runtime_invocation_id is not None and record.id != runtime_invocation_id:
        raise ValueError(
            "PostgreSQL runtime invocation read returned another invocation.",
        )


def _redact_invocation_read_record(
    record: RuntimeInvocationRecord,
) -> RuntimeInvocationRecord:
    return replace(
        record,
        request_summary=_redact_runtime_invocation_summary(record.request_summary),
        response_summary=_redact_runtime_invocation_summary(record.response_summary),
    )


def _redact_runtime_invocation_summary(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, nested_value in value.items():
            normalized_key = key.lower()
            if (
                normalized_key == "runtime_provider_config"
                and isinstance(nested_value, dict)
            ):
                redacted[key] = {
                    config_key: "<configured>"
                    for config_key, config_value in nested_value.items()
                    if _configured_runtime_value(config_value)
                }
            elif _sensitive_runtime_invocation_summary_key(key):
                redacted[key] = (
                    "<configured>"
                    if _configured_runtime_value(nested_value)
                    else nested_value
                )
            else:
                redacted[key] = _redact_runtime_invocation_summary(nested_value)
        return redacted
    if isinstance(value, list):
        return [_redact_runtime_invocation_summary(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact_runtime_invocation_summary(item) for item in value)
    return value


def _sensitive_runtime_invocation_summary_key(key: str) -> bool:
    return key.lower() in {
        "access_token",
        "agentscope_runtime_auth_ref",
        "api_key",
        "auth_ref",
        "auth_token",
        "bearer_token",
        "config_ref",
        "password",
        "refresh_token",
        "secret",
    }


def _configured_runtime_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


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
              config_ref, base_url, created_at, updated_at
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
                  config_ref, base_url, created_at, updated_at
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
        return [
            _redact_invocation_read_record(_invocation_from_row(dict(row)))
            for row in rows
        ]

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
        return _redact_invocation_read_record(_invocation_from_row(dict(row)))

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
              config_ref, base_url, created_at, updated_at
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
                      config_ref, base_url, created_at, updated_at
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
                records = [_invocation_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_invocation_read_result(
                record,
                tenant_id=tenant_id,
                provider_id=provider_id,
                agent_run_id=agent_run_id,
            )
        return [_redact_invocation_read_record(record) for record in records]

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
        record = _invocation_from_row(dict(row))
        _validate_invocation_read_result(
            record,
            tenant_id=tenant_id,
            runtime_invocation_id=runtime_invocation_id,
        )
        return _redact_invocation_read_record(record)

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresRuntimeWriteRepository:
    """Write tenant-scoped runtime invocation evidence to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def append_invocation(
        self,
        record: RuntimeInvocationRecord,
    ) -> RuntimeInvocationRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO runtime_invocations (
                      id, tenant_id, provider_id, agent_run_id, request_summary,
                      response_summary, provider_run_id, latency_ms, token_usage,
                      error, created_at, completed_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      tenant_id = EXCLUDED.tenant_id,
                      provider_id = EXCLUDED.provider_id,
                      agent_run_id = EXCLUDED.agent_run_id,
                      request_summary = EXCLUDED.request_summary,
                      response_summary = EXCLUDED.response_summary,
                      provider_run_id = EXCLUDED.provider_run_id,
                      latency_ms = EXCLUDED.latency_ms,
                      token_usage = EXCLUDED.token_usage,
                      error = EXCLUDED.error,
                      created_at = EXCLUDED.created_at,
                      completed_at = EXCLUDED.completed_at
                    RETURNING id, tenant_id, provider_id, agent_run_id,
                      request_summary, response_summary, provider_run_id,
                      latency_ms, token_usage, error, created_at, completed_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.provider_id,
                        record.agent_run_id,
                        json.dumps(
                            record.request_summary,
                            ensure_ascii=False,
                            default=str,
                        ),
                        (
                            None
                            if record.response_summary is None
                            else json.dumps(
                                record.response_summary,
                                ensure_ascii=False,
                                default=str,
                            )
                        ),
                        record.provider_run_id,
                        record.latency_ms,
                        (
                            None
                            if record.token_usage is None
                            else json.dumps(
                                record.token_usage,
                                ensure_ascii=False,
                                default=str,
                            )
                        ),
                        record.error,
                        record.created_at,
                        record.completed_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Runtime invocation upsert did not return a row.")
        persisted = _invocation_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted
