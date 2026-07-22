"""Enterprise agent registry persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.agents import (
    AgentCatalogWriteResult,
    AgentRecord,
    AgentVersionRecord,
    PostgresAgentCatalogReadRepository,
    PostgresAgentCatalogWriteRepository,
)


class AgentRepositoryProtocol(Protocol):
    """Repository contract used by the platform agent service."""

    supports_unscoped_reads: bool

    def list(self, *, tenant: str | None = None) -> list[dict[str, Any]]:
        ...

    def get(self, agent_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        ...

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        ...

    def save_tenant_agents(self, *, tenant: str, agents: list[dict[str, Any]]) -> None:
        ...


class AgentRegistryError(ValueError):
    """Raised when the stored agent registry cannot be loaded safely."""


class AgentRepository:
    """Store and retrieve enterprise agent definitions."""

    supports_unscoped_reads = True

    def __init__(self, path: Path) -> None:
        self._path = path

    def list(self, *, tenant: str | None = None) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []

        try:
            agents = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise AgentRegistryError(
                "Platform agent registry is not valid JSON.",
            ) from exc

        if not isinstance(agents, list):
            raise AgentRegistryError(
                "Platform agent registry must be a JSON array.",
            )

        if tenant is None:
            return agents

        return [
            agent
            for agent in agents
            if str(agent.get("tenant") or "").strip() == tenant
        ]

    def get(self, agent_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        for agent in self.list():
            if str(agent.get("id", "")) != agent_id:
                continue
            if tenant is not None and str(agent.get("tenant") or "").strip() != tenant:
                continue
            return agent
        return None

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(agents, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save_tenant_agents(self, *, tenant: str, agents: list[dict[str, Any]]) -> None:
        retained_agents = [
            agent
            for agent in self.list()
            if str(agent.get("tenant") or "").strip() != tenant
        ]
        self.save_all([*retained_agents, *agents])


class PostgresAgentCatalogWriteThroughRepository:
    """Use PostgreSQL as the source of truth for the agent catalog."""

    supports_unscoped_reads = False

    def __init__(
        self,
        *,
        postgres_reader: PostgresAgentCatalogReadRepository,
        postgres_writer: PostgresAgentCatalogWriteRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer

    def list(self, *, tenant: str | None = None) -> list[dict[str, Any]]:
        if not tenant:
            raise AgentRegistryError(
                "PostgreSQL agent catalog list reads require tenant scope.",
            )
        return [
            self._agent_catalog_item(record)
            for record in self._postgres_reader.list_agents(tenant_id=tenant)
        ]

    def get(self, agent_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        if not tenant:
            raise AgentRegistryError(
                "PostgreSQL agent catalog reads require tenant scope.",
            )
        record = self._postgres_reader.get_agent(
            tenant_id=tenant,
            agent_id=agent_id,
        )
        if record is None:
            return None
        return self._agent_catalog_item(record)

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        self._validate_write_results(self._postgres_writer.save_agents(agents))

    def save_tenant_agents(self, *, tenant: str, agents: list[dict[str, Any]]) -> None:
        self._validate_write_results(
            self._postgres_writer.save_agents(
                [
                    agent
                    for agent in agents
                    if str(agent.get("tenant") or "").strip() == tenant
                ],
            ),
        )

    def _agent_catalog_item(self, record: AgentRecord) -> dict[str, Any]:
        version = self._postgres_reader.get_current_version(
            tenant_id=record.tenant_id,
            agent_id=record.id,
        )
        return _agent_catalog_item(record, version)

    def _validate_write_results(
        self,
        results: list[AgentCatalogWriteResult],
    ) -> None:
        for result in results:
            if not result.agent.id:
                raise AgentRegistryError(
                    "PostgreSQL agent catalog write did not return a persisted agent id.",
                )
            if not result.version.id:
                raise AgentRegistryError(
                    "PostgreSQL agent catalog write did not return a persisted version id.",
                )
            if result.agent.current_version_id != result.version.id:
                raise AgentRegistryError(
                    "PostgreSQL agent catalog write did not persist the current version id.",
                )


def _agent_catalog_item(
    record: AgentRecord,
    version: AgentVersionRecord | None,
) -> dict[str, Any]:
    return {
        "id": record.id,
        "template_id": record.template_id,
        "name": record.name,
        "description": record.description,
        "tenant": record.tenant_id,
        "tools": list(version.tool_ids) if version is not None else [],
        "knowledge_base_ids": (
            list(version.knowledge_base_ids) if version is not None else []
        ),
        "model_config_id": version.model_config_id if version is not None else None,
        "runtime_provider": (
            version.runtime_provider if version is not None else "local-dev-runtime"
        ),
        "memory_enabled": record.memory_enabled,
        "workflow_enabled": record.workflow_enabled,
        "allowed_user_ids": list(record.allowed_user_ids),
        "allowed_roles": list(record.allowed_roles),
        "capabilities": list(record.capabilities),
        "status": record.status,
        "created_by": record.owner_user_id,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
