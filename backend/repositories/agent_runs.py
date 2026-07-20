"""Agent run persistence for the AgentFoundry platform."""

import json
from pathlib import Path
from typing import Any


class AgentRunRepository:
    """Store and query enterprise agent run records in JSONL format."""

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
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        bounded_limit = min(max(limit, 1), 100)
        records: list[dict[str, Any]] = []
        for record in reversed(self.read_all()):
            if agent_id and record.get("agent_id") != agent_id:
                continue
            if tenant and record.get("tenant") != tenant:
                continue
            if user_id and record.get("user_id") != user_id:
                continue
            if session_id and record.get("session_id") != session_id:
                continue
            records.append(record)
            if len(records) >= bounded_limit:
                break
        return records

    def get(self, turn_id: str) -> dict[str, Any] | None:
        if not turn_id:
            return None

        for record in reversed(self.read_all()):
            if record.get("turn_id") == turn_id:
                return record
        return None

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

    def delete(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> int:
        kept_records: list[dict[str, Any]] = []
        deleted_count = 0
        for record in self.read_all():
            matched = True
            if agent_id and record.get("agent_id") != agent_id:
                matched = False
            if tenant and record.get("tenant") != tenant:
                matched = False
            if user_id and record.get("user_id") != user_id:
                matched = False
            if session_id and record.get("session_id") != session_id:
                matched = False

            if matched:
                deleted_count += 1
            else:
                kept_records.append(record)

        if deleted_count:
            self.replace_all(kept_records)
        return deleted_count
