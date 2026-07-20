"""Service-layer orchestration for enterprise approval requests."""

from typing import Any, Callable

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

    _DECISION_STATUSES = {"approved", "rejected"}

    def __init__(
        self,
        *,
        repository: ApprovalRequestRepository,
        now: Callable[[], str],
    ) -> None:
        self._repository = repository
        self._now = now

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

    def update_status(
        self,
        *,
        approval_id: str,
        status: str,
        decided_by: str,
        decision_note: str | None,
    ) -> dict[str, Any]:
        normalized_id = approval_id.strip()
        normalized_status = status.strip()
        if normalized_status not in self._DECISION_STATUSES:
            raise PlatformApprovalServiceError(
                400,
                f"Unknown approval decision: {normalized_status}",
            )

        records = self._repository.read_all()
        for index, record in enumerate(records):
            if record.get("approval_id") != normalized_id:
                continue
            if record.get("status") != "pending":
                raise PlatformApprovalServiceError(
                    409,
                    f"Approval request is already {record.get('status')}.",
                )
            updated = {
                **record,
                "status": normalized_status,
                "decided_at": self._now(),
                "decided_by": decided_by,
                "decision_note": _optional_filter(decision_note),
            }
            records[index] = updated
            self._repository.replace_all(records)
            return updated

        raise PlatformApprovalServiceError(
            404,
            f"Unknown approval request: {normalized_id}",
        )


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None
