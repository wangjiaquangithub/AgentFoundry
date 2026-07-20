"""Connector configuration persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class ConnectorConfigRegistryError(ValueError):
    """Raised when connector configuration storage is malformed."""


class ConnectorConfigRepository:
    """Store tenant connector configuration records."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def list_by_tenant(self) -> dict[str, dict[str, Any]]:
        if not self._path.exists():
            return {}

        try:
            raw_configs = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ConnectorConfigRegistryError(
                "Platform connector registry is not valid JSON.",
            ) from exc

        if not isinstance(raw_configs, dict):
            raise ConnectorConfigRegistryError(
                "Platform connector registry must be a JSON object.",
            )

        configs: dict[str, dict[str, Any]] = {}
        for key, value in raw_configs.items():
            if not isinstance(value, dict):
                continue
            tenant = str(value.get("tenant") or key).strip()
            if tenant:
                configs[tenant] = {**value, "tenant": tenant}
        return configs

    def save_all(self, configs: dict[str, dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(configs, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
