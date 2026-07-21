"""Agent catalog persistence repositories."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase


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


def _agent_version_from_row(row: dict[str, Any]) -> AgentVersionRecord:
    return AgentVersionRecord(
        id=row["id"],
        tenant_id=row["tenant_id"],
        agent_id=row["agent_id"],
        version=row["version"],
        instructions=row["instructions"],
        model_config_id=row["model_config_id"],
        runtime_provider=row["runtime_provider"],
        tool_ids=_string_list_from_json(row["tool_ids"], row["id"], "tool_ids"),
        knowledge_base_ids=_string_list_from_json(
            row["knowledge_base_ids"],
            row["id"],
            "knowledge_base_ids",
        ),
        memory_policy_id=row["memory_policy_id"],
        created_by=row["created_by"],
        created_at=row["created_at"],
    )


def _string_list_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> list[str]:
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError(
            f"Agent version {record_id} has invalid {field_name} JSON.",
        )
    return parsed


def _clean_string(value: Any) -> str:
    return str(value or "").strip()


def _optional_clean_string(value: Any) -> str | None:
    clean_value = _clean_string(value)
    return clean_value or None


def _json_string_list(value: Any) -> str:
    if not isinstance(value, list):
        return "[]"
    return json.dumps(
        [str(item) for item in value if str(item or "").strip()],
        ensure_ascii=False,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
        return _agent_version_from_row(dict(row))

    def _agent_version_from_row(self, row: dict[str, Any]) -> AgentVersionRecord:
        return _agent_version_from_row(row)


class PostgresAgentCatalogReadRepository:
    """Read tenant-scoped agent catalog records from PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
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
            WHERE tenant_id = %s
        """
        parameters: list[Any] = [tenant_id]
        if status is not None:
            query += " AND status = %s"
            parameters.append(status)
        query += " ORDER BY updated_at DESC, id"

        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                return [AgentRecord(**dict(row)) for row in cursor.fetchall()]

    def get_agent(self, *, tenant_id: str, agent_id: str) -> AgentRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, name, description, status, owner_user_id,
                      current_version_id, created_at, updated_at
                    FROM agents
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, agent_id),
                )
                row = cursor.fetchone()
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
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, agent_id, version, instructions,
                      model_config_id, runtime_provider, tool_ids, knowledge_base_ids,
                      memory_policy_id, created_by, created_at
                    FROM agent_versions
                    WHERE tenant_id = %s AND agent_id = %s
                    ORDER BY version DESC
                    """,
                    (tenant_id, agent_id),
                )
                rows = cursor.fetchall()
        return [_agent_version_from_row(dict(row)) for row in rows]

    def get_current_version(
        self,
        *,
        tenant_id: str,
        agent_id: str,
    ) -> AgentVersionRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
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
                    WHERE agents.tenant_id = %s AND agents.id = %s
                    """,
                    (tenant_id, agent_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return _agent_version_from_row(dict(row))


class PostgresAgentCatalogWriteRepository:
    """Write tenant-scoped agent catalog records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def save_agents(self, agents: list[dict[str, Any]]) -> None:
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                for agent in agents:
                    if not isinstance(agent, dict):
                        continue
                    self._save_agent(cursor, agent)

    def _save_agent(self, cursor: Any, agent: dict[str, Any]) -> None:
        agent_id = _clean_string(agent.get("id"))
        tenant_id = _clean_string(agent.get("tenant"))
        owner_user_id = _clean_string(agent.get("created_by"))
        if not agent_id or not tenant_id or not owner_user_id:
            return

        created_at = _clean_string(agent.get("created_at")) or _clean_string(
            agent.get("updated_at"),
        ) or _now_iso()
        updated_at = _clean_string(agent.get("updated_at")) or created_at
        version_id = f"{agent_id}:v1"
        instructions = (
            _clean_string(agent.get("description"))
            or _clean_string(agent.get("name"))
            or agent_id
        )

        cursor.execute(
            """
            INSERT INTO agents (
              id, tenant_id, name, description, status, owner_user_id,
              current_version_id, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, NULL, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              owner_user_id = EXCLUDED.owner_user_id,
              updated_at = EXCLUDED.updated_at
            """,
            (
                agent_id,
                tenant_id,
                _clean_string(agent.get("name")) or agent_id,
                _optional_clean_string(agent.get("description")),
                _clean_string(agent.get("status")) or "draft",
                owner_user_id,
                created_at or updated_at,
                updated_at or created_at,
            ),
        )
        cursor.execute(
            """
            INSERT INTO agent_versions (
              id, tenant_id, agent_id, version, instructions, model_config_id,
              runtime_provider, tool_ids, knowledge_base_ids, memory_policy_id,
              created_by, created_at
            )
            VALUES (%s, %s, %s, 1, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tenant_id, agent_id, version) DO UPDATE
            SET instructions = EXCLUDED.instructions,
              model_config_id = EXCLUDED.model_config_id,
              runtime_provider = EXCLUDED.runtime_provider,
              tool_ids = EXCLUDED.tool_ids,
              knowledge_base_ids = EXCLUDED.knowledge_base_ids,
              memory_policy_id = EXCLUDED.memory_policy_id
            """,
            (
                version_id,
                tenant_id,
                agent_id,
                instructions,
                _optional_clean_string(agent.get("model_config_id")),
                _clean_string(agent.get("runtime_provider")) or "local-dev-runtime",
                _json_string_list(agent.get("tools")),
                _json_string_list(agent.get("knowledge_base_ids")),
                _optional_clean_string(agent.get("memory_policy_id")),
                owner_user_id,
                created_at or updated_at,
            ),
        )
        cursor.execute(
            """
            UPDATE agents
            SET current_version_id = %s
            WHERE id = %s
            """,
            (version_id, agent_id),
        )
