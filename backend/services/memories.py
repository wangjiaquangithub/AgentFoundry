"""Service-layer orchestration for platform long-term memory."""

from pathlib import Path
import re
from typing import Any

from repositories.memories import PlatformMemoryRepository


def _truncate_text(value: str, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _memory_text_terms(value: str) -> set[str]:
    normalized = value.lower()
    terms = set(re.findall(r"[a-z0-9][a-z0-9._-]{1,}", normalized))
    for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", value.upper()):
        terms.add(ticket_id.lower())

    chinese_markers = (
        "刚才",
        "之前",
        "上次",
        "关注",
        "记住",
        "工单",
        "部门",
        "指标",
        "政策",
        "制度",
        "远程",
        "报销",
        "安全",
        "工程",
        "研发",
        "客服",
        "销售",
        "相关",
    )
    for marker in chinese_markers:
        if marker in value:
            terms.add(marker)

    return terms


def _question_uses_memory_reference(question: str) -> bool:
    normalized = question.lower()
    english_markers = (
        "remember",
        "previous",
        "earlier",
        "last time",
        "follow up",
    )
    chinese_markers = (
        "刚才",
        "之前",
        "上次",
        "记住",
        "还记得",
        "关注",
        "相关",
        "继续",
        "那个",
        "这个",
    )
    return any(marker in normalized for marker in english_markers) or any(
        marker in question for marker in chinese_markers
    )


def _format_platform_memory_hit(
    record: dict[str, Any],
    score: float,
) -> dict[str, Any]:
    facts = [
        str(fact)
        for fact in record.get("facts", [])
        if str(fact).strip()
    ]
    snippet = "；".join(facts[:3]) or str(record.get("question", ""))
    return {
        "id": str(record.get("id", "")),
        "created_at": str(record.get("created_at", "")),
        "score": round(score, 3),
        "source": "platform_memory",
        "snippet": _truncate_text(snippet, 500),
        "facts": facts,
        "tool_names": list(record.get("tool_names") or []),
        "knowledge_base_ids": list(record.get("knowledge_base_ids") or []),
    }


class PlatformMemoryService:
    """Manage tenant-scoped long-term memory records."""

    def __init__(self, *, repository: PlatformMemoryRepository) -> None:
        self._repository = repository

    def path_for(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
    ) -> Path:
        return self._repository.path_for(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
        )

    def list_memories(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        return self._repository.list(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            limit=limit,
        )

    def extract_keywords(self, value: str, *, limit: int = 80) -> list[str]:
        return sorted(_memory_text_terms(value))[:limit]

    def search_memories(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        question: str,
        max_records: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        records = self.list_memories(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            limit=max_records,
        )
        if not records:
            return []

        question_terms = _memory_text_terms(question)
        asks_for_memory = _question_uses_memory_reference(question)
        scored: list[tuple[float, int, dict[str, Any]]] = []
        total = max(len(records), 1)
        for index, record in enumerate(records):
            memory_text = " ".join(
                [
                    str(record.get("question", "")),
                    " ".join(str(fact) for fact in record.get("facts", [])),
                    " ".join(str(term) for term in record.get("keywords", [])),
                ],
            )
            memory_terms = set(record.get("keywords") or [])
            memory_terms.update(_memory_text_terms(memory_text))
            overlap = question_terms & memory_terms
            score = float(len(overlap) * 2)
            if asks_for_memory:
                score += 1.0
            score += ((index + 1) / total) * 0.5

            if score <= 0.5 and not asks_for_memory:
                continue
            scored.append((score, index, record))

        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return [
            _format_platform_memory_hit(record, score)
            for score, _index, record in scored[:limit]
        ]

    def append_capped(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        record: dict[str, Any],
        max_records: int,
    ) -> dict[str, Any]:
        self._repository.append_capped(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            record=record,
            max_records=max_records,
        )
        return record
