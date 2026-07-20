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
