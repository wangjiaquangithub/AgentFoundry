"""Service-layer orchestration for platform long-term memory."""

from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord
from repositories.memories import PlatformMemoryRepository


class AuditEventWriter(Protocol):
    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        ...


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


def _dedupe_strings(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _extract_tool_memory_facts(
    tool_calls: list[dict[str, Any]],
) -> list[str]:
    facts: list[str] = []
    for call in tool_calls:
        tool_name = str(call.get("tool_name", "")).strip()
        result = call.get("result")
        if not tool_name or not isinstance(result, dict):
            continue

        if tool_name == "enterprise_lookup_policy":
            matches = result.get("matches")
            if isinstance(matches, dict):
                for keyword, policy_text in matches.items():
                    facts.append(
                        "工具结果：制度 "
                        f"{keyword} = {_truncate_text(str(policy_text), 160)}",
                    )
            continue

        if tool_name == "enterprise_get_ticket_status":
            ticket_id = str(result.get("ticket_id", "")).strip()
            ticket = result.get("ticket")
            if isinstance(ticket, dict):
                status = str(ticket.get("status", "")).strip()
                owner = str(ticket.get("owner", "")).strip()
                summary = _truncate_text(str(ticket.get("summary", "")), 120)
                facts.append(
                    "工具结果：工单 "
                    f"{ticket_id} status={status} owner={owner} summary={summary}",
                )
            elif ticket_id:
                facts.append(f"工具结果：工单 {ticket_id} 未找到")
            continue

        if tool_name == "enterprise_summarize_department_metrics":
            department = str(result.get("department", "")).strip()
            metrics = result.get("metrics")
            if isinstance(metrics, dict):
                active_projects = metrics.get("active_projects")
                open_incidents = metrics.get("open_incidents")
                sla = metrics.get("sla")
                facts.append(
                    "工具结果：部门指标 "
                    f"{department} active_projects={active_projects} "
                    f"open_incidents={open_incidents} sla={sla}",
                )

    return facts


def _extract_platform_memory_facts(
    *,
    question: str,
    tool_calls: list[dict[str, Any]],
    knowledge_base_ids: list[str],
) -> list[str]:
    facts: list[str] = []
    normalized = question.lower()

    name_match = re.search(r"(?:我叫|我是)\s*([^，。,.！!\s]{1,32})", question)
    if name_match:
        facts.append(f"用户自称：{name_match.group(1).strip()}")

    for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", question.upper()):
        facts.append(f"用户关注工单：{ticket_id}")

    department_markers = {
        "engineering": ("engineering", "engineering"),
        "工程": ("engineering", "工程"),
        "研发": ("engineering", "研发"),
        "support": ("support", "support"),
        "客服": ("support", "客服"),
        "支持": ("support", "支持"),
        "sales": ("sales", "sales"),
        "销售": ("sales", "销售"),
    }
    for marker, (department, label) in department_markers.items():
        if marker in normalized or marker in question:
            facts.append(f"用户关注部门：{department} ({label})")

    policy_markers = {
        "remote": ("remote", "remote"),
        "远程": ("remote", "远程"),
        "expense": ("expense", "expense"),
        "报销": ("expense", "报销"),
        "security": ("security", "security"),
        "安全": ("security", "安全"),
    }
    for marker, (policy, label) in policy_markers.items():
        if marker in normalized or marker in question:
            facts.append(f"用户关注制度关键词：{policy} ({label})")

    if (
        "关注" in question
        or "记住" in question
        or "remember" in normalized
    ):
        facts.append(f"用户明确要求记住：{_truncate_text(question, 160)}")

    tool_names = _dedupe_strings(
        [
            str(call.get("tool_name", "")).strip()
            for call in tool_calls
            if call.get("tool_name")
        ],
    )
    if tool_names:
        facts.append(f"本轮使用工具：{', '.join(tool_names)}")
        facts.extend(_extract_tool_memory_facts(tool_calls))

    if knowledge_base_ids:
        facts.append(f"本轮使用知识库：{', '.join(knowledge_base_ids)}")

    if not facts:
        facts.append(f"用户问过：{_truncate_text(question, 160)}")

    return _dedupe_strings(facts)


class PlatformMemoryService:
    """Manage tenant-scoped long-term memory records."""

    def __init__(
        self,
        *,
        repository: PlatformMemoryRepository,
        audit_event_writer: AuditEventWriter | None = None,
    ) -> None:
        self._repository = repository
        self._audit_event_writer = audit_event_writer

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

    def is_agent_turn_memory_lookup(self, question: str) -> bool:
        normalized = question.lower()
        english_markers = (
            "what did i",
            "what was i",
            "what were we",
            "what did we",
            "do you remember",
        )
        chinese_markers = (
            "我刚才",
            "刚才我",
            "我之前",
            "之前我",
            "我上次",
            "上次我",
            "还记得",
        )
        return any(marker in normalized for marker in english_markers) or any(
            marker in question for marker in chinese_markers
        )

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

    def build_agent_run_context(
        self,
        *,
        enabled: bool,
        tenant: str,
        user_id: str,
        agent_id: str,
        question: str,
        max_records: int,
        limit: int,
    ) -> dict[str, Any]:
        memory_hits = (
            self.search_memories(
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                question=question,
                max_records=max_records,
                limit=limit,
            )
            if enabled
            else []
        )
        return {
            "memory_enabled": enabled,
            "memory_hits": memory_hits,
            "memory_scope": {
                "tenant": tenant,
                "user_id": user_id,
                "agent_id": agent_id,
            },
        }

    def agent_run_state(
        self,
        memory_payload: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "memory_enabled": bool(memory_payload["memory_enabled"]),
            "memory_hits": list(memory_payload["memory_hits"]),
        }

    def format_answer(self, memory_hits: list[dict[str, Any]]) -> str:
        snippets = _dedupe_strings(
            [
                str(hit.get("snippet", "")).strip()
                for hit in memory_hits
                if str(hit.get("snippet", "")).strip()
            ],
        )
        lines = [
            f"{index}. {snippet}"
            for index, snippet in enumerate(snippets[:3], start=1)
        ]
        return "我找到这些长期记忆：\n" + "\n".join(lines)

    def format_context(self, memory_hits: list[dict[str, Any]]) -> str:
        context_lines: list[str] = []
        for hit in memory_hits[:3]:
            facts = [
                str(fact)
                for fact in hit.get("facts", [])
                if str(fact).strip()
            ]
            context_lines.extend(facts[:4] or [str(hit.get("snippet", ""))])

        return "\n".join(_dedupe_strings(context_lines))

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
        self._append_memory_audit_event(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            record=record,
        )
        return record

    def _append_memory_audit_event(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        record: dict[str, Any],
    ) -> None:
        if self._audit_event_writer is None:
            return

        created_at = str(record.get("created_at") or "").strip()
        if not created_at:
            created_at = datetime.now(timezone.utc).isoformat()

        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=tenant,
                    actor_user_id=user_id,
                    event_type="memory_item.created",
                    target_type="memory_item",
                    target_id=str(record.get("id") or ""),
                    payload={
                        "schema_version": 1,
                        "tenant": tenant,
                        "user_id": user_id,
                        "agent_id": agent_id,
                        "session_id": str(record.get("session_id") or ""),
                        "fact_count": len(record.get("facts") or []),
                        "tool_names": [
                            str(tool_name)
                            for tool_name in record.get("tool_names") or []
                        ],
                        "knowledge_base_ids": [
                            str(knowledge_base_id)
                            for knowledge_base_id in (
                                record.get("knowledge_base_ids") or []
                            )
                        ],
                        "keywords": [
                            str(keyword)
                            for keyword in record.get("keywords") or []
                        ],
                    },
                    created_at=created_at,
                ),
            )
            if not persisted_audit_event.id:
                return
        except Exception:
            return

    def append_agent_turn_memory(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        question: str,
        answer: str,
        tool_calls: list[dict[str, Any]],
        knowledge_base_ids: list[str],
        max_records: int,
    ) -> dict[str, Any]:
        facts = _extract_platform_memory_facts(
            question=question,
            tool_calls=tool_calls,
            knowledge_base_ids=knowledge_base_ids,
        )
        tool_names = _dedupe_strings(
            [
                str(call.get("tool_name", "")).strip()
                for call in tool_calls
                if call.get("tool_name")
            ],
        )
        keyword_text = " ".join(
            [question, " ".join(facts), " ".join(tool_names)],
        )
        record = {
            "id": str(uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
            "question": _truncate_text(question, 1000),
            "facts": facts,
            "tool_names": tool_names,
            "knowledge_base_ids": list(knowledge_base_ids),
            "keywords": self.extract_keywords(keyword_text),
        }
        return self.append_capped(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            record=record,
            max_records=max_records,
        )

    def append_agent_turn_if_enabled(
        self,
        *,
        enabled: bool,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        question: str,
        answer: str,
        tool_calls: list[dict[str, Any]],
        knowledge_base_ids: list[str],
        max_records: int,
    ) -> bool:
        if not enabled or self.is_agent_turn_memory_lookup(question):
            return False

        self.append_agent_turn_memory(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            question=question,
            answer=answer,
            tool_calls=tool_calls,
            knowledge_base_ids=knowledge_base_ids,
            max_records=max_records,
        )
        return True
