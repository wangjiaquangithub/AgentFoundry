"""Service-layer orchestration for enterprise approval requests."""

from typing import Any

from repositories.approvals import ApprovalRequestRepository


class PlatformApprovalServiceError(ValueError):
    """Raised when an approval request operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformApprovalService:
    """Manage persisted enterprise approval request history."""

    _VALID_STATUSES = {"pending", "approved", "rejected"}

    def __init__(self, *, repository: ApprovalRequestRepository) -> None:
        self._repository = repository

    def list_requests(
        self,
        *,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        normalized_status = _optional_filter(status)
        if normalized_status and normalized_status not in self._VALID_STATUSES:
            raise PlatformApprovalServiceError(
                400,
                f"Unknown approval status: {normalized_status}",
            )

        return {
            "approvals": self._repository.list(
                limit=limit,
                status=normalized_status,
                tenant=_optional_filter(tenant),
                user_id=_optional_filter(user_id),
                agent_id=_optional_filter(agent_id),
            ),
        }


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None
