"""Long-term memory persistence for AgentFoundry."""

import json
import re
from pathlib import Path
from typing import Any


def _safe_path_part(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "unknown"


class PlatformMemoryRepository:
    """Store tenant-scoped agent memories in JSONL files."""

    def __init__(self, root_dir: Path) -> None:
        self._root_dir = root_dir

    def path_for(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
    ) -> Path:
        return (
            self._root_dir
            / _safe_path_part(tenant)
            / _safe_path_part(user_id)
            / _safe_path_part(agent_id)
            / "memories.jsonl"
        )

    def list(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        path = self.path_for(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
        )
        if not path.exists():
            return []

        records: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if not text:
                continue
            try:
                record = json.loads(text)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue

            clean_record = dict(record)
            clean_record.pop("answer", None)
            clean_record["facts"] = [
                str(fact)
                for fact in clean_record.get("facts", [])
                if str(fact).strip()
                and not str(fact).startswith("上次回答摘要：")
            ]
            records.append(clean_record)

        return records[-limit:]

    def append_capped(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        record: dict[str, Any],
        max_records: int,
    ) -> None:
        path = self.path_for(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
        )
        previous = self.list(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            limit=max(max_records - 1, 0),
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        records = [*previous, record]
        path.write_text(
            "\n".join(json.dumps(item, ensure_ascii=False) for item in records) + "\n",
            encoding="utf-8",
        )
