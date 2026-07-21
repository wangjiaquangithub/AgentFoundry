"""SQLite agent catalog read repository.

This repository is intentionally read-only while AgentFoundry migrates core
records from development JSON files into the production data layer.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from backend.persistence.database import SQLiteDatabase


@dataclass(frozen=True)
class AgentRecord:
    id: str
    tenant_id: str
    name: str
    description: str | None
    status: str
    owner_user_id: str
    current_version_id: str | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class AgentVersionRecord:
    id: str
    tenant_id: str
    agent_id: str
    version: int
    instructions: str
    model_config_id: str | None
    runtime_provider: str
    tool_ids: list[str]
    knowledge_base_ids: list[str]
    memory_policy_id: str | None
    created_by: str
    created_at: str


class SQLiteAgentCatalogReadRepository:
    """Read tenant-scoped agent catalog records from SQLite."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self._database = database

    def list_agents(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
    ) -> list[AgentRecord]:
        query = """
            SELECT id, tenant_id, name, description, status, owner_user_id,
              current_version_id, created_at, updated_at
            FROM agents
            WHERE tenant_id = ?
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = ?"
            parameters.append(status)
        query += " ORDER BY updated_at DESC, id"

        with self._database.connect() as connection:
            return [
                AgentRecord(**dict(row))
                for row in connection.execute(query, parameters).fetchall()
            ]

    def get_agent(self, *, tenant_id: str, agent_id: str) -> AgentRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, name, description, status, owner_user_id,
                  current_version_id, created_at, updated_at
                FROM agents
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, agent_id),
            ).fetchone()
        if row is None:
            return None
        return AgentRecord(**dict(row))

    def list_versions(
        self,
        *,
        tenant_id: str,
        agent_id: str,
    ) -> list[AgentVersionRecord]:
        with self._database.connect() as connection:
            rows = connection.execute(
                """
                SELECT id, tenant_id, agent_id, version, instructions,
                  model_config_id, runtime_provider, tool_ids, knowledge_base_ids,
                  memory_policy_id, created_by, created_at
                FROM agent_versions
                WHERE tenant_id = ? AND agent_id = ?
                ORDER BY version DESC
                """,
                (tenant_id, agent_id),
            ).fetchall()
        return [self._agent_version_from_row(dict(row)) for row in rows]

    def get_current_version(
        self,
        *,
        tenant_id: str,
        agent_id: str,
    ) -> AgentVersionRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT agent_versions.id, agent_versions.tenant_id,
                  agent_versions.agent_id, agent_versions.version,
                  agent_versions.instructions, agent_versions.model_config_id,
                  agent_versions.runtime_provider, agent_versions.tool_ids,
                  agent_versions.knowledge_base_ids,
                  agent_versions.memory_policy_id, agent_versions.created_by,
                  agent_versions.created_at
                FROM agents
                INNER JOIN agent_versions
                  ON agent_versions.id = agents.current_version_id
                WHERE agents.tenant_id = ? AND agents.id = ?
                """,
                (tenant_id, agent_id),
            ).fetchone()
        if row is None:
            return None
        return self._agent_version_from_row(dict(row))

    def _agent_version_from_row(self, row: dict[str, Any]) -> AgentVersionRecord:
        return AgentVersionRecord(
            id=row["id"],
            tenant_id=row["tenant_id"],
            agent_id=row["agent_id"],
            version=row["version"],
            instructions=row["instructions"],
            model_config_id=row["model_config_id"],
            runtime_provider=row["runtime_provider"],
            tool_ids=self._string_list_from_json(row["tool_ids"], row["id"], "tool_ids"),
            knowledge_base_ids=self._string_list_from_json(
                row["knowledge_base_ids"],
                row["id"],
                "knowledge_base_ids",
            ),
            memory_policy_id=row["memory_policy_id"],
            created_by=row["created_by"],
            created_at=row["created_at"],
        )

    def _string_list_from_json(
        self,
        value: str,
        record_id: str,
        field_name: str,
    ) -> list[str]:
        parsed = json.loads(value)
        if not isinstance(parsed, list) or not all(
            isinstance(item, str) for item in parsed
        ):
            raise ValueError(
                f"Agent version {record_id} has invalid {field_name} JSON.",
            )
        return parsed
