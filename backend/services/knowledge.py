"""Formatting helpers for platform knowledge search responses."""

import json
from typing import Any


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _chunk_text(chunk: Any) -> str:
    content = getattr(chunk, "content", None)
    if getattr(content, "type", None) == "text":
        return str(getattr(content, "text", "")).strip()

    name = getattr(content, "name", None)
    if name:
        return str(name).strip()

    source = getattr(chunk, "source", None)
    return str(source or "").strip()


class PlatformKnowledgeResponseService:
    """Build API response payloads from platform knowledge search hits."""

    def format_hit(
        self,
        knowledge_base_id: str,
        hit: Any,
    ) -> dict[str, Any]:
        chunk = getattr(hit, "chunk", None)
        snippet = _chunk_text(chunk)
        if len(snippet) > 500:
            snippet = f"{snippet[:497]}..."

        metadata = getattr(chunk, "metadata", {}) if chunk is not None else {}
        return {
            "knowledge_base_id": knowledge_base_id,
            "score": float(getattr(hit, "score", 0.0) or 0.0),
            "document_id": str(getattr(hit, "document_id", "")),
            "source": str(getattr(chunk, "source", "") or ""),
            "chunk_index": getattr(chunk, "chunk_index", None),
            "total_chunks": getattr(chunk, "total_chunks", None),
            "snippet": snippet,
            "metadata": _json_safe(metadata or {}),
        }

    async def search_agent_knowledge_bases(
        self,
        *,
        knowledge_base_service: Any | None,
        dev_knowledge_service: Any,
        dev_knowledge_provider: str,
        user_id: str,
        question: str,
        knowledge_base_ids: list[str],
        top_k: int = 3,
    ) -> tuple[list[dict[str, Any]], str | None]:
        if not knowledge_base_ids:
            return [], None

        hits: list[dict[str, Any]] = []
        errors: list[str] = []
        if knowledge_base_service is not None:
            for knowledge_base_id in knowledge_base_ids:
                try:
                    results = await knowledge_base_service.search(
                        user_id=user_id,
                        knowledge_base_id=knowledge_base_id,
                        query=question,
                        top_k=top_k,
                    )
                except Exception as exc:  # Do not let RAG failures break tool answers.
                    errors.append(f"{knowledge_base_id}: {exc}")
                    continue

                hits.extend(
                    self.format_hit(knowledge_base_id, hit)
                    for hit in results
                )

        if len(hits) < top_k:
            seen = {
                (
                    str(hit.get("knowledge_base_id") or ""),
                    str(hit.get("document_id") or ""),
                )
                for hit in hits
            }
            for hit in dev_knowledge_service.search(
                question=question,
                knowledge_base_ids=knowledge_base_ids,
                provider=dev_knowledge_provider,
                top_k=top_k,
            ):
                key = (
                    str(hit.get("knowledge_base_id") or ""),
                    str(hit.get("document_id") or ""),
                )
                if key in seen:
                    continue
                seen.add(key)
                hits.append(hit)

        hits.sort(key=lambda item: item["score"], reverse=True)
        return hits[:top_k], "; ".join(errors) if errors and not hits else None

    def format_answer(
        self,
        knowledge_hits: list[dict[str, Any]],
    ) -> str:
        snippets = []
        for index, hit in enumerate(knowledge_hits[:3], start=1):
            source = (
                hit.get("source")
                or hit.get("document_id")
                or hit["knowledge_base_id"]
            )
            snippets.append(f"{index}. {source}: {hit.get('snippet', '')}")

        return "我在该 Agent 绑定的知识库中找到这些相关内容：\n" + "\n".join(snippets)
