"""Service-layer orchestration for enterprise approval requests."""

from typing import Any, Callable
from uuid import uuid4

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
        return {
            "approvals": self.list_records(
                status=status,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                limit=limit,
            ),
        }

    def list_records(
        self,
        *,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        normalized_status = _optional_filter(status)
        if normalized_status and normalized_status not in self._VALID_STATUSES:
            raise PlatformApprovalServiceError(
                400,
                f"Unknown approval status: {normalized_status}",
            )

        return self._repository.list(
            limit=limit,
            status=normalized_status,
            tenant=_optional_filter(tenant),
            user_id=_optional_filter(user_id),
            agent_id=_optional_filter(agent_id),
        )

    def build_create_request_context(
        self,
        *,
        payload: Any,
        actor: str | None,
    ) -> dict[str, str]:
        requested_by = actor
        user_id = payload.user_id or requested_by or "acme:alice"
        return {
            "user_id": user_id,
            "requested_by": requested_by or user_id,
        }

    def build_create_request_payload(
        self,
        *,
        payload: Any,
        tenant: str,
        user_id: str,
        requested_by: str,
    ) -> dict[str, Any]:
        request_type = payload.request_type.strip()
        default_agent_id = (
            "platform-workflow"
            if request_type == "workflow_run"
            else "platform-console"
        )
        return {
            "request_type": request_type,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": (payload.agent_id or "").strip() or default_agent_id,
            "tool_name": _optional_filter(payload.tool_name),
            "workflow_type": _optional_filter(payload.workflow_type),
            "inputs": payload.inputs,
            "reason": payload.reason,
            "requested_by": requested_by,
        }

    def build_decision_payload(
        self,
        *,
        payload: Any,
        actor: str | None,
    ) -> dict[str, Any]:
        return {
            "decided_by": _optional_filter(payload.decided_by)
            or actor
            or "platform-admin",
            "decision_note": payload.decision_note,
        }

    def create_request(
        self,
        *,
        request_type: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        inputs: dict[str, Any],
        requested_by: str,
        tool_name: str | None = None,
        workflow_type: str | None = None,
        reason: str | None = None,
    ) -> dict[str, Any]:
        normalized_request_type = request_type.strip()
        if normalized_request_type not in {"tool_run", "workflow_run", "agent_action"}:
            raise PlatformApprovalServiceError(
                400,
                f"Unknown approval type: {normalized_request_type}",
            )

        normalized_tool_name = _optional_filter(tool_name)
        normalized_workflow_type = _optional_filter(workflow_type)
        if normalized_request_type == "tool_run" and not normalized_tool_name:
            raise PlatformApprovalServiceError(
                400,
                "tool_name is required for tool approvals.",
            )
        if normalized_request_type == "workflow_run" and not normalized_workflow_type:
            raise PlatformApprovalServiceError(
                400,
                "workflow_type is required for workflow approvals.",
            )

        record = {
            "approval_id": uuid4().hex,
            "status": "pending",
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "request_type": normalized_request_type,
            "tool_name": normalized_tool_name,
            "workflow_type": normalized_workflow_type,
            "inputs": dict(inputs),
            "reason": _optional_filter(reason),
            "requested_at": self._now(),
            "requested_by": requested_by,
            "decided_at": None,
            "decided_by": None,
            "decision_note": None,
        }
        self._repository.append(record)
        return record

    def require_approval(
        self,
        *,
        approval_id: str | None,
        request_type: str,
        target_key: str,
        target_value: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        inputs: dict[str, Any],
    ) -> str:
        """Validate that a high-risk platform action has a matching approval."""
        normalized_approval_id = (approval_id or "").strip()
        if not normalized_approval_id:
            raise PlatformApprovalServiceError(
                403,
                _approval_required_detail(
                    message="该操作需要先在审批中心批准后才能运行。",
                    request_type=request_type,
                    target_key=target_key,
                    target_value=target_value,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=agent_id,
                    inputs=inputs,
                ),
            )

        approval = self._get_request(normalized_approval_id)
        approval_agent_id = str(approval.get("agent_id") or "").strip()
        approved_inputs = approval.get("inputs")
        if not isinstance(approved_inputs, dict):
            approved_inputs = {}

        input_mismatch = any(
            str(inputs.get(key)) != str(value) for key, value in approved_inputs.items()
        )
        if (
            approval.get("status") != "approved"
            or approval.get("request_type") != request_type
            or approval.get(target_key) != target_value
            or approval.get("tenant") != tenant
            or approval.get("user_id") != user_id
            or (
                approval_agent_id
                and approval_agent_id != agent_id
                and not (
                    request_type == "workflow_run"
                    and approval_agent_id == "platform-console"
                    and agent_id == "platform-workflow"
                )
            )
            or input_mismatch
        ):
            raise PlatformApprovalServiceError(
                403,
                _approval_required_detail(
                    message="审批记录与本次操作不匹配，或尚未批准。",
                    request_type=request_type,
                    target_key=target_key,
                    target_value=target_value,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=agent_id,
                    inputs=inputs,
                ),
            )

        return normalized_approval_id

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

    def _get_request(self, approval_id: str) -> dict[str, Any]:
        normalized_id = approval_id.strip()
        for record in self._repository.read_all():
            if record.get("approval_id") == normalized_id:
                return record
        raise PlatformApprovalServiceError(
            404,
            f"Unknown approval request: {normalized_id}",
        )


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def _approval_required_detail(
    *,
    message: str,
    request_type: str,
    target_key: str,
    target_value: str,
    tenant: str,
    user_id: str,
    agent_id: str,
    inputs: dict[str, Any],
) -> dict[str, Any]:
    return {
        "approval_required": True,
        "message": message,
        "request_type": request_type,
        "target_key": target_key,
        "target": target_value,
        "tenant": tenant,
        "user_id": user_id,
        "agent_id": agent_id,
        "inputs": inputs,
    }
