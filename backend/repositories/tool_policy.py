"""Tool policy persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class ToolPolicyRepository:
    """Load and save enterprise tool authorization policy configuration."""

    def __init__(self, path: Path, default_policy: dict[str, Any]) -> None:
        self._path = path
        self._default_policy = default_policy

    def load(self) -> dict[str, Any]:
        if self._path.exists():
            value = json.loads(self._path.read_text(encoding="utf-8"))
        else:
            value = json.loads(json.dumps(self._default_policy))

        if not isinstance(value, dict):
            raise ValueError("Enterprise tool policy JSON must be an object.")
        return value

    def save(self, policy: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(policy, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
