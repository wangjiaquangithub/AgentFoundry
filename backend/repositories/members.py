"""Platform member persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class MemberRepository:
    """Load and save enterprise platform member configuration."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def load_config(self) -> dict[str, Any]:
        if not self._path.exists():
            return {"members": []}

        config = json.loads(self._path.read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            raise ValueError("Enterprise platform members JSON must be an object.")

        members = config.get("members")
        if not isinstance(members, list):
            config["members"] = []
        return config

    def save_config(self, config: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(config, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
