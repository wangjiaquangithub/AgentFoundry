"""Development knowledge persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class DevKnowledgeRepository:
    """Load local development knowledge records."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def list(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []

        try:
            raw_items = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

        if not isinstance(raw_items, list):
            return []

        records: list[dict[str, Any]] = []
        for item in raw_items:
            if isinstance(item, dict):
                records.append(item)
        return records
