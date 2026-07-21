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
                return [_model_config_from_row(dict(row)) for row in cursor.fetchall()]

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
        return _model_config_from_row(dict(row))

    def _clamp_limit(self, limit: int) -> int:
        return min(max(limit, 1), 100)
