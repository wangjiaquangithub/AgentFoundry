"""Service-layer access to development knowledge fixtures."""

import re
from typing import Any

from repositories.dev_knowledge import DevKnowledgeRepository


def _truncate_text(value: str, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _knowledge_query_terms(value: str) -> set[str]:
    normalized = value.lower()
    terms = set(re.findall(r"[a-z0-9][a-z0-9._-]{1,}", normalized))
    chinese_text = "".join(re.findall(r"[\u4e00-\u9fff]+", value))
    for size in (2, 3, 4):
        for index in range(0, max(len(chinese_text) - size + 1, 0)):
            terms.add(chinese_text[index : index + size])
    for marker in (
        "知识库",
        "知识助手",
        "agentscope",
        "agentfoundry",
        "多租户",
        "权限",
        "工具",
        "审批",
        "记忆",
        "rag",
        "embedding",
        "模型",
        "运行",
        "日志",
        "来源",
    ):
        if marker.lower() in normalized or marker in value:
            terms.add(marker.lower())
    return terms


class PlatformDevKnowledgeService:
    """Load development knowledge records used by the local fallback path."""

    def __init__(self, *, repository: DevKnowledgeRepository) -> None:
        self._repository = repository

    def list_records(self) -> list[dict[str, Any]]:
        return self._repository.list()

    def search(
        self,
        *,
        question: str,
        knowledge_base_ids: list[str],
        provider: str,
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        if not knowledge_base_ids:
            return []

        allowed_knowledge_base_ids = set(knowledge_base_ids)
        query_terms = _knowledge_query_terms(question)
        if not query_terms:
            return []

        hits: list[dict[str, Any]] = []
        for index, record in enumerate(self.list_records()):
            knowledge_base_id = str(record.get("knowledge_base_id") or "").strip()
            if knowledge_base_id not in allowed_knowledge_base_ids:
                continue

            title = str(record.get("title") or "").strip()
            content = str(record.get("content") or "").strip()
            tags = [str(tag) for tag in record.get("tags") or []]
            haystack = " ".join([title, content, " ".join(tags)])
            haystack_terms = _knowledge_query_terms(haystack)
            overlap = query_terms & haystack_terms
            if not overlap:
                continue

            score = min(1.0, 0.35 + (len(overlap) / max(len(query_terms), 1)))
            hits.append(
                {
                    "knowledge_base_id": knowledge_base_id,
                    "score": round(score, 4),
                    "document_id": str(record.get("id") or f"dev-doc-{index + 1}"),
                    "source": str(record.get("source") or title or knowledge_base_id),
                    "chunk_index": 0,
                    "total_chunks": 1,
                    "snippet": _truncate_text(content, 500),
                    "metadata": {
                        "provider": provider,
                        "dev_fallback": True,
                        "title": title,
                        "tags": tags,
                    },
                },
            )

        hits.sort(key=lambda item: item["score"], reverse=True)
        return hits[:top_k]
