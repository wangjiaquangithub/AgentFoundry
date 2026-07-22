"""Model configuration read repositories.

Model configs are tenant-scoped platform records for chat, embedding, and
rerank model selection. PostgreSQL is the production path; SQLite remains an
explicit local development compatibility path during the data-layer migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class ModelConfigRecord:
    id: str
    tenant_id: str
    name: str
    provider: str
    model: str
    purpose: str
    status: str
    config_ref: str | None
    created_at: str
    updated_at: str


def _model_config_from_row(row: dict[str, Any]) -> ModelConfigRecord:
    return ModelConfigRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        name=row["name"],
        provider=row["provider"],
        model=row["model"],
        purpose=row["purpose"],
        status=row["status"],
        config_ref=row["config_ref"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _validate_write_result(
    requested: ModelConfigRecord,
    persisted: ModelConfigRecord,
) -> None:
    if not persisted.id:
        raise ValueError("PostgreSQL model config write did not return a model config id.")
    if not persisted.tenant_id:
        raise ValueError("PostgreSQL model config write did not return a tenant id.")
    if not persisted.name:
        raise ValueError("PostgreSQL model config write did not return a name.")
    if not persisted.provider:
        raise ValueError("PostgreSQL model config write did not return a provider.")
    if not persisted.model:
        raise ValueError("PostgreSQL model config write did not return a model.")
    if not persisted.purpose:
        raise ValueError("PostgreSQL model config write did not return a purpose.")
    if not persisted.status:
        raise ValueError("PostgreSQL model config write did not return a status.")
    if persisted.id != requested.id:
        raise ValueError("PostgreSQL model config write returned another model config.")
    if persisted.tenant_id != requested.tenant_id:
        raise ValueError("PostgreSQL model config write returned another tenant.")
    if persisted.name != requested.name:
        raise ValueError("PostgreSQL model config write returned another name.")
    if persisted.provider != requested.provider:
        raise ValueError("PostgreSQL model config write returned another provider.")
    if persisted.model != requested.model:
        raise ValueError("PostgreSQL model config write returned another model.")
    if persisted.purpose != requested.purpose:
        raise ValueError("PostgreSQL model config write returned another purpose.")
    if persisted.status != requested.status:
        raise ValueError("PostgreSQL model config write returned another status.")
    if persisted.config_ref != requested.config_ref:
        raise ValueError("PostgreSQL model config write returned another config ref.")
    if persisted.updated_at != requested.updated_at:
        raise ValueError("PostgreSQL model config write returned another updated time.")


def _validate_model_config_read_result(
    record: ModelConfigRecord,
    *,
    tenant_id: str,
    purpose: str | None = None,
    status: str | None = None,
    model_config_id: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL model config read returned another tenant.")
    if purpose is not None and record.purpose != purpose:
        raise ValueError("PostgreSQL model config read returned another purpose.")
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL model config read returned another status.")
    if model_config_id is not None and record.id != model_config_id:
        raise ValueError("PostgreSQL model config read returned another config.")


class SQLiteModelConfigReadRepository:
    """Read tenant-scoped model configs from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_model_configs(
        self,
        *,
        tenant_id: str,
        purpose: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[ModelConfigRecord]:
        query = """
            SELECT id, tenant_id, name, provider, model, purpose, status,
              config_ref, created_at, updated_at
            FROM model_configs
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if purpose is not None:
            query += " AND purpose = ?"
            parameters.append(purpose)
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY purpose ASC, name ASC, id ASC LIMIT ?"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_model_config_from_row(dict(row)) for row in rows]

    def get_model_config(
        self,
        *,
        tenant_id: str,
        model_config_id: str,
    ) -> ModelConfigRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, provider, model, purpose, status,
                  config_ref, created_at, updated_at
                FROM model_configs
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, model_config_id),
            ).fetchone()
        if row is None:
            return None
        return _model_config_from_row(dict(row))

    def _model_config_from_row(self, row: dict[str, Any]) -> ModelConfigRecord:
        return _model_config_from_row(row)

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)


class PostgresModelConfigWriteRepository:
    """Write tenant-scoped model configs to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def upsert_model_config(self, record: ModelConfigRecord) -> ModelConfigRecord:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO model_configs (
                      id, tenant_id, name, provider, model, purpose, status,
                      config_ref, credential_ref, created_at, updated_at
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                      name = EXCLUDED.name,
                      provider = EXCLUDED.provider,
                      model = EXCLUDED.model,
                      purpose = EXCLUDED.purpose,
                      status = EXCLUDED.status,
                      config_ref = EXCLUDED.config_ref,
                      credential_ref = EXCLUDED.credential_ref,
                      updated_at = EXCLUDED.updated_at
                    WHERE model_configs.tenant_id = EXCLUDED.tenant_id
                    RETURNING id, tenant_id, name, provider, model, purpose, status,
                      COALESCE(credential_ref, config_ref) AS config_ref,
                      created_at, updated_at
                    """,
                    (
                        record.id,
                        record.tenant_id,
                        record.name,
                        record.provider,
                        record.model,
                        record.purpose,
                        record.status,
                        record.config_ref,
                        record.config_ref,
                        record.created_at,
                        record.updated_at,
                    ),
                )
                row = cursor.fetchone()
        if row is None:
            raise ValueError("Model config id already exists for another tenant.")
        persisted = _model_config_from_row(dict(row))
        _validate_write_result(record, persisted)
        return persisted


class PostgresModelConfigReadRepository:
    """Read tenant-scoped model configs from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def list_model_configs(
        self,
        *,
        tenant_id: str,
        purpose: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[ModelConfigRecord]:
        query = """
            SELECT id, tenant_id, name, provider, model, purpose, status,
              COALESCE(credential_ref, config_ref) AS config_ref,
              created_at, updated_at
            FROM model_configs
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if purpose is not None:
            query += " AND purpose = %s"
            parameters.append(purpose)
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY purpose ASC, name ASC, id ASC LIMIT %s"
        parameters.append(self._clamp_limit(limit))

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                records = [_model_config_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_model_config_read_result(
                record,
                tenant_id=tenant_id,
                purpose=purpose,
                status=status,
            )
        return records

    def get_model_config(
        self,
        *,
        tenant_id: str,
        model_config_id: str,
    ) -> ModelConfigRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, provider, model, purpose, status,
                      COALESCE(credential_ref, config_ref) AS config_ref,
                      created_at, updated_at
                    FROM model_configs
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, model_config_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        record = _model_config_from_row(dict(row))
        _validate_model_config_read_result(
            record,
            tenant_id=tenant_id,
            model_config_id=model_config_id,
        )
        return record

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
