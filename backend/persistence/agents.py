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
    template_id: str
    name: str
    description: str | None
    status: str
    owner_user_id: str
    current_version_id: str | None
    memory_enabled: bool
    workflow_enabled: bool
    allowed_user_ids: list[str]
    allowed_roles: list[str]
    capabilities: list[str]
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


@dataclass(frozen=True)
class AgentCatalogWriteResult:
    agent: AgentRecord
    version: AgentVersionRecord


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


def _agent_from_row(row: dict[str, Any]) -> AgentRecord:
    record_id = row["id"]
    return AgentRecord(
        id=record_id,
        tenant_id=row["tenant_id"],
        template_id=row["template_id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        owner_user_id=row["owner_user_id"],
        current_version_id=row["current_version_id"],
        memory_enabled=_bool_from_storage(row["memory_enabled"]),
        workflow_enabled=_bool_from_storage(row["workflow_enabled"]),
        allowed_user_ids=_string_list_from_json(
            row["allowed_user_ids"],
            record_id,
            "allowed_user_ids",
        ),
        allowed_roles=_string_list_from_json(
            row["allowed_roles"],
            record_id,
            "allowed_roles",
        ),
        capabilities=_string_list_from_json(
            row["capabilities"],
            record_id,
            "capabilities",
        ),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _string_list_from_json(
    value: str,
    record_id: str,
    field_name: str,
) -> list[str]:
    parsed = json.loads(value)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError(
            f"Agent catalog record {record_id} has invalid {field_name} JSON.",
        )
    return parsed


def _bool_from_storage(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}
    return bool(value)


def _clean_string(value: Any) -> str:
    return str(value or "").strip()


def _optional_clean_string(value: Any) -> str | None:
    clean_value = _clean_string(value)
    return clean_value or None


def _json_string_list(value: Any) -> str:
    return json.dumps(_string_list(value), ensure_ascii=False)


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item or "").strip()]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_agent_write_result(
    requested: AgentRecord,
    persisted: AgentRecord,
) -> None:
    if not persisted.id:
        raise RuntimeError("PostgreSQL agent catalog write did not return an agent id.")
    if not persisted.tenant_id:
        raise RuntimeError("PostgreSQL agent catalog write did not return a tenant id.")
    if persisted.id != requested.id:
        raise RuntimeError("PostgreSQL agent catalog write returned another agent.")
    if persisted.tenant_id != requested.tenant_id:
        raise RuntimeError("PostgreSQL agent catalog write returned another tenant.")
    if persisted.template_id != requested.template_id:
        raise RuntimeError("PostgreSQL agent catalog write returned another template.")
    if persisted.name != requested.name:
        raise RuntimeError("PostgreSQL agent catalog write returned another name.")
    if persisted.description != requested.description:
        raise RuntimeError("PostgreSQL agent catalog write returned another description.")
    if persisted.status != requested.status:
        raise RuntimeError("PostgreSQL agent catalog write returned another status.")
    if persisted.owner_user_id != requested.owner_user_id:
        raise RuntimeError("PostgreSQL agent catalog write returned another owner.")
    if persisted.current_version_id != requested.current_version_id:
        raise RuntimeError(
            "PostgreSQL agent catalog write returned another current version.",
        )
    if persisted.memory_enabled != requested.memory_enabled:
        raise RuntimeError("PostgreSQL agent catalog write returned another memory flag.")
    if persisted.workflow_enabled != requested.workflow_enabled:
        raise RuntimeError(
            "PostgreSQL agent catalog write returned another workflow flag.",
        )
    if persisted.allowed_user_ids != requested.allowed_user_ids:
        raise RuntimeError("PostgreSQL agent catalog write returned another user scope.")
    if persisted.allowed_roles != requested.allowed_roles:
        raise RuntimeError("PostgreSQL agent catalog write returned another role scope.")
    if persisted.capabilities != requested.capabilities:
        raise RuntimeError("PostgreSQL agent catalog write returned other capabilities.")
    if persisted.updated_at != requested.updated_at:
        raise RuntimeError("PostgreSQL agent catalog write returned another update time.")


def _validate_agent_version_write_result(
    requested: AgentVersionRecord,
    persisted: AgentVersionRecord,
) -> None:
    if not persisted.id:
        raise RuntimeError(
            "PostgreSQL agent catalog write did not return an agent version id.",
        )
    if not persisted.tenant_id:
        raise RuntimeError(
            "PostgreSQL agent catalog write did not return a version tenant id.",
        )
    if persisted.id != requested.id:
        raise RuntimeError("PostgreSQL agent catalog write returned another version.")
    if persisted.tenant_id != requested.tenant_id:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another tenant.",
        )
    if persisted.agent_id != requested.agent_id:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another agent.",
        )
    if persisted.version != requested.version:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another version number.",
        )
    if persisted.instructions != requested.instructions:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned other instructions.",
        )
    if persisted.model_config_id != requested.model_config_id:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another model config.",
        )
    if persisted.runtime_provider != requested.runtime_provider:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another runtime provider.",
        )
    if persisted.tool_ids != requested.tool_ids:
        raise RuntimeError("PostgreSQL agent catalog version write returned other tools.")
    if persisted.knowledge_base_ids != requested.knowledge_base_ids:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned other knowledge bases.",
        )
    if persisted.memory_policy_id != requested.memory_policy_id:
        raise RuntimeError(
            "PostgreSQL agent catalog version write returned another memory policy.",
        )


def _validate_agent_read_result(
    record: AgentRecord,
    *,
    tenant_id: str,
    agent_id: str | None = None,
    status: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError("PostgreSQL agent catalog read returned another tenant.")
    if agent_id is not None and record.id != agent_id:
        raise ValueError("PostgreSQL agent catalog read returned another agent.")
    if status is not None and record.status != status:
        raise ValueError("PostgreSQL agent catalog read returned another status.")


def _validate_agent_version_read_result(
    record: AgentVersionRecord,
    *,
    tenant_id: str,
    agent_id: str | None = None,
) -> None:
    if record.tenant_id != tenant_id:
        raise ValueError(
            "PostgreSQL agent catalog version read returned another tenant.",
        )
    if agent_id is not None and record.agent_id != agent_id:
        raise ValueError(
            "PostgreSQL agent catalog version read returned another agent.",
        )


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
            SELECT id, tenant_id, template_id, name, description, status,
              owner_user_id, current_version_id, memory_enabled, workflow_enabled,
              allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
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
                _agent_from_row(dict(row))
                for row in connection.execute(query, parameters).fetchall()
            ]

    def get_agent(self, *, tenant_id: str, agent_id: str) -> AgentRecord | None:
        with self._database.connect() as connection:
            row = connection.execute(
                """
                SELECT id, tenant_id, template_id, name, description, status,
                  owner_user_id, current_version_id, memory_enabled, workflow_enabled,
                  allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
                FROM agents
                WHERE tenant_id = ? AND id = ?
                """,
                (tenant_id, agent_id),
            ).fetchone()
        if row is None:
            return None
        return _agent_from_row(dict(row))

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
            SELECT id, tenant_id, template_id, name, description, status,
              owner_user_id, current_version_id, memory_enabled, workflow_enabled,
              allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
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
                records = [_agent_from_row(dict(row)) for row in cursor.fetchall()]
        for record in records:
            _validate_agent_read_result(
                record,
                tenant_id=tenant_id,
                status=status,
            )
        return records

    def get_agent(self, *, tenant_id: str, agent_id: str) -> AgentRecord | None:
        with self._database.connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, template_id, name, description, status,
                      owner_user_id, current_version_id, memory_enabled, workflow_enabled,
                      allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
                    FROM agents
                    WHERE tenant_id = %s AND id = %s
                    """,
                    (tenant_id, agent_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        record = _agent_from_row(dict(row))
        _validate_agent_read_result(record, tenant_id=tenant_id, agent_id=agent_id)
        return record

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
        records = [_agent_version_from_row(dict(row)) for row in rows]
        for record in records:
            _validate_agent_version_read_result(
                record,
                tenant_id=tenant_id,
                agent_id=agent_id,
            )
        return records

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
        record = _agent_version_from_row(dict(row))
        _validate_agent_version_read_result(
            record,
            tenant_id=tenant_id,
            agent_id=agent_id,
        )
        return record


class PostgresAgentCatalogWriteRepository:
    """Write tenant-scoped agent catalog records to PostgreSQL."""

    def __init__(self, database: PostgresDatabase) -> None:
        self._database = database

    def save_agents(self, agents: list[dict[str, Any]]) -> list[AgentCatalogWriteResult]:
        results: list[AgentCatalogWriteResult] = []
        with self._database.transaction() as connection:
            with connection.cursor() as cursor:
                for agent in agents:
                    if not isinstance(agent, dict):
                        continue
                    result = self._save_agent(cursor, agent)
                    if result is not None:
                        results.append(result)
        return results

    def _save_agent(
        self,
        cursor: Any,
        agent: dict[str, Any],
    ) -> AgentCatalogWriteResult | None:
        agent_id = _clean_string(agent.get("id"))
        tenant_id = _clean_string(agent.get("tenant"))
        owner_user_id = _clean_string(agent.get("created_by"))
        if not agent_id or not tenant_id or not owner_user_id:
            return None

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
        template_id = _clean_string(agent.get("template_id")) or (
            "enterprise_knowledge_assistant"
        )
        agent_name = _clean_string(agent.get("name")) or agent_id
        agent_description = _optional_clean_string(agent.get("description"))
        agent_status = _clean_string(agent.get("status")) or "draft"
        memory_enabled = bool(agent.get("memory_enabled", False))
        workflow_enabled = bool(agent.get("workflow_enabled", False))
        allowed_user_ids = _string_list(agent.get("allowed_user_ids"))
        allowed_roles = _string_list(agent.get("allowed_roles"))
        capabilities = _string_list(agent.get("capabilities"))
        model_config_id = _optional_clean_string(agent.get("model_config_id"))
        runtime_provider = _clean_string(agent.get("runtime_provider")) or (
            "local-dev-runtime"
        )
        tool_ids = _string_list(agent.get("tools"))
        knowledge_base_ids = _string_list(agent.get("knowledge_base_ids"))
        memory_policy_id = _optional_clean_string(agent.get("memory_policy_id"))
        requested_version = AgentVersionRecord(
            id=version_id,
            tenant_id=tenant_id,
            agent_id=agent_id,
            version=1,
            instructions=instructions,
            model_config_id=model_config_id,
            runtime_provider=runtime_provider,
            tool_ids=tool_ids,
            knowledge_base_ids=knowledge_base_ids,
            memory_policy_id=memory_policy_id,
            created_by=owner_user_id,
            created_at=created_at or updated_at,
        )

        cursor.execute(
            """
            INSERT INTO agents (
              id, tenant_id, template_id, name, description, status, owner_user_id,
              current_version_id, memory_enabled, workflow_enabled, allowed_user_ids,
              allowed_roles, capabilities, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
              template_id = EXCLUDED.template_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              status = EXCLUDED.status,
              owner_user_id = EXCLUDED.owner_user_id,
              memory_enabled = EXCLUDED.memory_enabled,
              workflow_enabled = EXCLUDED.workflow_enabled,
              allowed_user_ids = EXCLUDED.allowed_user_ids,
              allowed_roles = EXCLUDED.allowed_roles,
              capabilities = EXCLUDED.capabilities,
              updated_at = EXCLUDED.updated_at
            RETURNING id, tenant_id, template_id, name, description, status,
              owner_user_id, current_version_id, memory_enabled, workflow_enabled,
              allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
            """,
            (
                agent_id,
                tenant_id,
                template_id,
                agent_name,
                agent_description,
                agent_status,
                owner_user_id,
                memory_enabled,
                workflow_enabled,
                json.dumps(allowed_user_ids, ensure_ascii=False),
                json.dumps(allowed_roles, ensure_ascii=False),
                json.dumps(capabilities, ensure_ascii=False),
                created_at or updated_at,
                updated_at or created_at,
            ),
        )
        agent_row = cursor.fetchone()
        if agent_row is None:
            raise RuntimeError("Agent catalog upsert did not return a row.")

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
            RETURNING id, tenant_id, agent_id, version, instructions,
              model_config_id, runtime_provider, tool_ids, knowledge_base_ids,
              memory_policy_id, created_by, created_at
            """,
            (
                requested_version.id,
                requested_version.tenant_id,
                requested_version.agent_id,
                requested_version.instructions,
                requested_version.model_config_id,
                requested_version.runtime_provider,
                json.dumps(requested_version.tool_ids, ensure_ascii=False),
                json.dumps(
                    requested_version.knowledge_base_ids,
                    ensure_ascii=False,
                ),
                requested_version.memory_policy_id,
                owner_user_id,
                created_at or updated_at,
            ),
        )
        version_row = cursor.fetchone()
        if version_row is None:
            raise RuntimeError("Agent version upsert did not return a row.")

        version_record = _agent_version_from_row(dict(version_row))
        _validate_agent_version_write_result(requested_version, version_record)
        requested_agent = AgentRecord(
            id=agent_id,
            tenant_id=tenant_id,
            template_id=template_id,
            name=agent_name,
            description=agent_description,
            status=agent_status,
            owner_user_id=owner_user_id,
            current_version_id=version_record.id,
            memory_enabled=memory_enabled,
            workflow_enabled=workflow_enabled,
            allowed_user_ids=allowed_user_ids,
            allowed_roles=allowed_roles,
            capabilities=capabilities,
            created_at=created_at or updated_at,
            updated_at=updated_at or created_at,
        )
        cursor.execute(
            """
            UPDATE agents
            SET current_version_id = %s
            WHERE tenant_id = %s AND id = %s
            RETURNING id, tenant_id, template_id, name, description, status,
              owner_user_id, current_version_id, memory_enabled, workflow_enabled,
              allowed_user_ids, allowed_roles, capabilities, created_at, updated_at
            """,
            (version_record.id, tenant_id, agent_id),
        )
        updated_agent_row = cursor.fetchone()
        if updated_agent_row is None:
            raise RuntimeError("Agent current version update did not return a row.")
        agent_record = _agent_from_row(dict(updated_agent_row))
        _validate_agent_write_result(requested_agent, agent_record)

        return AgentCatalogWriteResult(
            agent=agent_record,
            version=version_record,
        )
