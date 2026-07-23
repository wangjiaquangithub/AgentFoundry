"""Stable Foundry-to-AgentScope runtime binding persistence."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


@dataclass(frozen=True)
class RuntimeBindingRecord:
    foundry_agent_id: str
    foundry_version_id: str
    tenant_id: str
    execution_mode: str
    runtime_provider: str
    scope_application_id: str | None
    scope_agent_id: str | None
    scope_version: str | None
    scope_type: str | None
    status: str
    fallback_reason: str | None
    last_event_cursor: str | None
    created_at: str
    updated_at: str


def _from_row(row: Any) -> RuntimeBindingRecord:
    return RuntimeBindingRecord(**dict(row))


class RuntimeBindingRepository:
    def __init__(self, database: SQLiteDatabase | PostgresDatabase) -> None:
        self._database = database

    def upsert(self, record: RuntimeBindingRecord) -> RuntimeBindingRecord:
        placeholder = "%s" if isinstance(self._database, PostgresDatabase) else "?"
        values = tuple(getattr(record, field) for field in record.__dataclass_fields__)
        columns = tuple(record.__dataclass_fields__)
        assignments = ", ".join(f"{column} = excluded.{column}" for column in columns[2:])
        sql = (
            f"INSERT INTO agent_runtime_bindings ({', '.join(columns)}) "
            f"VALUES ({', '.join([placeholder] * len(columns))}) "
            f"ON CONFLICT (foundry_version_id) DO UPDATE SET {assignments} "
            "RETURNING *"
        )
        with self._database.transaction() as connection:
            row = connection.execute(sql, values).fetchone()
        if row is None:
            raise ValueError("Runtime binding write returned no record.")
        return _from_row(row)

    def get(self, *, tenant_id: str, foundry_version_id: str) -> RuntimeBindingRecord | None:
        placeholder = "%s" if isinstance(self._database, PostgresDatabase) else "?"
        with self._database.transaction() as connection:
            row = connection.execute(
                "SELECT * FROM agent_runtime_bindings "
                f"WHERE tenant_id = {placeholder} AND foundry_version_id = {placeholder}",
                (tenant_id, foundry_version_id),
            ).fetchone()
        return _from_row(row) if row is not None else None
