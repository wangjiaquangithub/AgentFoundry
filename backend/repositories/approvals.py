"""Approval request persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


class ApprovalRequestRepository:
    """Store and query approval request records in JSONL format."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def read_all(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []

        records: list[dict[str, Any]] = []
        for line in self._path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict):
                records.append(record)
        return records

    def list(
        self,
        *,
        limit: int = 20,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        bounded_limit = min(max(limit, 1), 100)
        records: list[dict[str, Any]] = []
        for record in reversed(self.read_all()):
            if status and record.get("status") != status:
                continue
            if tenant and record.get("tenant") != tenant:
                continue
            if user_id and record.get("user_id") != user_id:
                continue
            if agent_id and record.get("agent_id") != agent_id:
                continue
            records.append(record)
            if len(records) >= bounded_limit:
                break
        return records

    def append(self, record: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False, default=str))
            file.write("\n")

    def replace_all(self, records: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            json.dumps(record, ensure_ascii=False, default=str)
            for record in records
        ]
        self._path.write_text(
            "\n".join(lines) + ("\n" if lines else ""),
            encoding="utf-8",
        )
