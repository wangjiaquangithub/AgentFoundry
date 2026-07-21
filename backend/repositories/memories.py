"""Long-term memory persistence for AgentFoundry."""

import json
import re
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.memory_items import MemoryItemRecord


def _safe_path_part(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "unknown"


class PlatformMemoryRepository:
    """Read tenant-scoped memory records with legacy JSONL write support."""

    def __init__(
        self,
        root_dir: Path,
        *,
        memory_item_reader: "MemoryItemReadRepository | None" = None,
    ) -> None:
        self._root_dir = root_dir
        self._memory_item_reader = memory_item_reader

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
        if self._memory_item_reader is not None:
            records = self._memory_item_reader.list_memory_items(
                tenant_id=tenant,
                user_id=user_id,
                agent_id=agent_id,
                limit=limit,
            )
            if records:
                return [
                    _platform_memory_from_memory_item(record)
                    for record in reversed(records)
                ]

        return self._list_jsonl(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            limit=limit,
        )

    def _list_jsonl(
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
        previous = self._list_jsonl(
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


class MemoryItemReadRepository(Protocol):
    def list_memory_items(
        self,
        *,
        tenant_id: str,
        user_id: str | None = None,
        agent_id: str | None = None,
        session_id: str | None = None,
        source_run_id: str | None = None,
        limit: int = 50,
    ) -> list[MemoryItemRecord]:
        ...


def _list_metadata_strings(metadata: dict[str, Any], key: str) -> list[str]:
    values = metadata.get(key)
    if not isinstance(values, list):
        return []
    return [str(value) for value in values if str(value).strip()]


def _platform_memory_from_memory_item(record: MemoryItemRecord) -> dict[str, Any]:
    metadata = dict(record.metadata)
    facts = _list_metadata_strings(metadata, "facts")
    if not facts and record.content.strip():
        facts = [record.content]

    question = metadata.get("question")
    return {
        "id": record.id,
        "created_at": str(record.created_at),
        "tenant": record.tenant_id,
        "user_id": record.user_id,
        "agent_id": record.agent_id or "",
        "session_id": record.session_id or "",
        "question": str(question).strip() if question else record.content,
        "facts": facts,
        "tool_names": _list_metadata_strings(metadata, "tool_names"),
        "knowledge_base_ids": _list_metadata_strings(
            metadata,
            "knowledge_base_ids",
        ),
        "keywords": _list_metadata_strings(metadata, "keywords"),
    }
