"""Service-layer orchestration for enterprise agent run history."""

from typing import Any

from repositories.agent_runs import AgentRunRepository


class PlatformAgentRunServiceError(ValueError):
    """Raised when an agent run history operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformAgentRunService:
    """Manage persisted enterprise agent question-answer turns."""

    def __init__(self, *, repository: AgentRunRepository) -> None:
        self._repository = repository

    def list_runs(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        return {
            "runs": self._repository.list(
                limit=limit,
                agent_id=_optional_filter(agent_id),
                tenant=_optional_filter(tenant),
                user_id=_optional_filter(user_id),
                session_id=_optional_filter(session_id),
            ),
        }

    def get_run(self, turn_id: str) -> dict[str, Any]:
        run = self._repository.get(turn_id.strip())
        if run is None:
            raise PlatformAgentRunServiceError(404, "Agent run not found.")
        return run

    def append_run(self, record: dict[str, Any]) -> dict[str, Any]:
        self._repository.append(record)
        return record

    def build_evidence(
        self,
        *,
        turn_id: str,
        created_at: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
        tool_calls: list[dict[str, Any]],
        knowledge_hits: list[dict[str, Any]],
        memory_hits: list[dict[str, Any]],
        memory_saved: bool,
    ) -> dict[str, Any]:
        """Build a compact evidence summary for enterprise traceability."""
        allowed_tool_calls = [call for call in tool_calls if call.get("allowed")]
        denied_tool_calls = [
            call for call in tool_calls if call.get("allowed") is False
        ]
        approval_required_calls = [
            call for call in tool_calls if call.get("approval_required")
        ]
        approval_ids = sorted(
            {
                str(call.get("approval_id"))
                for call in tool_calls
                if call.get("approval_id")
            },
        )
        tool_names = [
            str(call.get("tool_name"))
            for call in tool_calls
            if call.get("tool_name")
        ]
        audit_filter: dict[str, Any] = {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
        }
        if tool_names:
            audit_filter["tool_names"] = sorted(set(tool_names))
        if approval_ids:
            audit_filter["approval_ids"] = approval_ids

        return {
            "run_id": turn_id,
            "turn_id": turn_id,
            "created_at": created_at,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
            "tool_call_count": len(tool_calls),
            "allowed_tool_call_count": len(allowed_tool_calls),
            "denied_tool_call_count": len(denied_tool_calls),
            "approval_required_count": len(approval_required_calls),
            "approval_ids": approval_ids,
            "knowledge_hit_count": len(knowledge_hits),
            "memory_hit_count": len(memory_hits),
            "memory_saved": memory_saved,
            "audit_filter": audit_filter,
        }

    def clear_runs(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        filters = {
            "agent_id": _optional_filter(agent_id),
            "tenant": _optional_filter(tenant),
            "user_id": _optional_filter(user_id),
            "session_id": _optional_filter(session_id),
        }
        if not any(filters.values()):
            raise PlatformAgentRunServiceError(
                400,
                "At least one agent run filter is required.",
            )

        return {"deleted_count": self._repository.delete(**filters)}


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None
