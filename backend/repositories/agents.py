"""Enterprise agent registry persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class AgentRegistryError(ValueError):
    """Raised when the stored agent registry cannot be loaded safely."""


class AgentRepository:
    """Store and retrieve enterprise agent definitions."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def list(self) -> list[dict[str, Any]]:
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

        return agents

    def get(self, agent_id: str) -> dict[str, Any] | None:
        for agent in self.list():
            if str(agent.get("id", "")) == agent_id:
                return agent
        return None

    def save_all(self, agents: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(agents, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
