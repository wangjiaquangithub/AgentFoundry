"""Service-layer orchestration for enterprise workflow templates."""

from datetime import datetime, timezone
from typing import Any, Callable

from repositories.workflows import (
    WorkflowTemplateRegistryError,
    WorkflowRunRepository,
    WorkflowTemplateRepository,
)


class PlatformWorkflowTemplateServiceError(ValueError):
    """Raised when a workflow template operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformWorkflowRunServiceError(ValueError):
    """Raised when a workflow run operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformWorkflowTemplateService:
    """Manage platform workflow template registry records."""

    def __init__(
        self,
        *,
        repository: WorkflowTemplateRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._repository = repository
        self._now = now or _utc_now_iso

    def default_templates(self) -> list[dict[str, Any]]:
        now = self._now()
        return [
            {
                "workflow_type": "daily_ops_brief",
                "name": "每日运营简报",
                "description": "按制度、工单和部门指标生成一份可审计的运营简报。",
                "enabled": True,
                "default_inputs": {
                    "policy_keyword": "remote",
                    "ticket_id": "INC-1001",
                    "department": "engineering",
                },
                "steps": [
                    {
                        "id": "policy",
                        "title": "查询制度",
                        "tool_name": "enterprise_lookup_policy",
                        "input_map": {"keyword": "policy_keyword"},
                    },
                    {
                        "id": "ticket",
                        "title": "查询工单",
                        "tool_name": "enterprise_get_ticket_status",
                        "input_map": {"ticket_id": "ticket_id"},
                    },
                    {
                        "id": "metrics",
                        "title": "汇总部门指标",
                        "tool_name": "enterprise_summarize_department_metrics",
                        "input_map": {"department": "department"},
                    },
                ],
                "updated_at": now,
                "updated_by": "system",
            },
            {
                "workflow_type": "ticket_followup",
                "name": "工单跟进",
                "description": "查询指定工单，并补充关联制度依据。",
                "enabled": True,
                "default_inputs": {
                    "policy_keyword": "remote",
                    "ticket_id": "INC-1001",
                    "department": "engineering",
                },
                "steps": [
                    {
                        "id": "ticket",
                        "title": "查询工单",
                        "tool_name": "enterprise_get_ticket_status",
                        "input_map": {"ticket_id": "ticket_id"},
                    },
                    {
                        "id": "policy",
                        "title": "补充相关制度",
                        "tool_name": "enterprise_lookup_policy",
                        "input_map": {"keyword": "policy_keyword"},
                    },
                ],
                "updated_at": now,
                "updated_by": "system",
            },
            {
                "workflow_type": "policy_review",
                "name": "制度复核",
                "description": "查询制度条款，并结合部门指标做复核。",
                "enabled": True,
                "default_inputs": {
                    "policy_keyword": "remote",
                    "ticket_id": "INC-1001",
                    "department": "engineering",
                },
                "steps": [
                    {
                        "id": "policy",
                        "title": "查询制度",
                        "tool_name": "enterprise_lookup_policy",
                        "input_map": {"keyword": "policy_keyword"},
                    },
                    {
                        "id": "metrics",
                        "title": "核对部门指标",
                        "tool_name": "enterprise_summarize_department_metrics",
                        "input_map": {"department": "department"},
                    },
                ],
                "updated_at": now,
                "updated_by": "system",
            },
        ]

    def save_templates(self, workflows: list[dict[str, Any]]) -> None:
        self._repository.save_all(workflows)

    def list_templates(self) -> list[dict[str, Any]]:
        if not self._repository.exists():
            workflows = self.default_templates()
            self.save_templates(workflows)
            return workflows

        try:
            return self._repository.list()
        except WorkflowTemplateRegistryError as exc:
            raise PlatformWorkflowTemplateServiceError(500, str(exc)) from exc

    def get_template(self, workflow_type: str) -> dict[str, Any]:
        for workflow in self.list_templates():
            if str(workflow.get("workflow_type", "")).strip() == workflow_type:
                return workflow

        raise PlatformWorkflowTemplateServiceError(
            400,
            f"Unknown enterprise workflow: {workflow_type}",
        )

    def update_template(
        self,
        *,
        workflow_type: str,
        payload: Any,
        actor: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        workflows = self.list_templates()
        workflow_index = next(
            (
                index
                for index, workflow in enumerate(workflows)
                if str(workflow.get("workflow_type", "")).strip() == workflow_type
            ),
            None,
        )
        if workflow_index is None:
            raise PlatformWorkflowTemplateServiceError(
                400,
                f"Unknown enterprise workflow: {workflow_type}",
            )

        workflow = dict(workflows[workflow_index])
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise PlatformWorkflowTemplateServiceError(
                    400,
                    "Workflow name cannot be empty.",
                )
            workflow["name"] = name
        if payload.description is not None:
            workflow["description"] = payload.description.strip()
        if payload.enabled is not None:
            workflow["enabled"] = payload.enabled
        if payload.default_inputs is not None:
            workflow["default_inputs"] = dict(payload.default_inputs)

        workflow["updated_at"] = self._now()
        workflow["updated_by"] = actor
        workflows[workflow_index] = workflow
        self.save_templates(workflows)
        return workflow, workflows

    def enable_disabled_templates(
        self,
        *,
        actor: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        workflows = self.list_templates()
        enabled_workflows: list[dict[str, Any]] = []
        changed = False
        now = self._now()
        for index, workflow in enumerate(workflows):
            if workflow.get("enabled") is False:
                updated_workflow = dict(workflow)
                updated_workflow["enabled"] = True
                updated_workflow["updated_at"] = now
                updated_workflow["updated_by"] = actor
                workflows[index] = updated_workflow
                enabled_workflows.append(updated_workflow)
                changed = True

        if changed:
            self.save_templates(workflows)

        return enabled_workflows, workflows


class PlatformWorkflowRunService:
    """Manage persisted enterprise workflow run history."""

    def __init__(self, *, repository: WorkflowRunRepository) -> None:
        self._repository = repository

    def list_runs(
        self,
        *,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        return {
            "runs": self._repository.list(
                limit=limit,
                workflow_type=_optional_filter(workflow_type),
                agent_id=_optional_filter(agent_id),
                tenant=_optional_filter(tenant),
                user_id=_optional_filter(user_id),
            ),
        }

    def list_run_records(
        self,
        *,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        return self.list_runs(
            limit=limit,
            workflow_type=workflow_type,
            agent_id=agent_id,
            tenant=tenant,
            user_id=user_id,
        )["runs"]

    def append_run(self, record: dict[str, Any]) -> dict[str, Any]:
        self._repository.append(record)
        return record

    def input_value(
        self,
        inputs: dict[str, Any],
        default_inputs: dict[str, Any],
        key: str,
        fallback: str = "",
    ) -> str:
        value = inputs.get(key)
        if value is None:
            value = default_inputs.get(key, fallback)

        normalized = str(value).strip()
        return normalized or fallback

    def normalize_inputs(
        self,
        inputs: dict[str, Any],
        default_inputs: dict[str, Any],
    ) -> dict[str, str]:
        keys = set(default_inputs) | set(inputs)
        return {
            key: self.input_value(inputs, default_inputs, key)
            for key in sorted(keys)
        }

    def build_step_specs(
        self,
        template: dict[str, Any],
        inputs: dict[str, str],
        *,
        enterprise_tool_names: set[str],
        enterprise_tool_catalog: dict[str, dict[str, Any]],
    ) -> list[tuple[str, str, str, dict[str, Any]]]:
        raw_steps = template.get("steps")
        if not isinstance(raw_steps, list) or not raw_steps:
            raise PlatformWorkflowRunServiceError(
                400,
                f"Workflow {template.get('workflow_type')} has no runnable steps.",
            )

        step_specs: list[tuple[str, str, str, dict[str, Any]]] = []
        for index, raw_step in enumerate(raw_steps, start=1):
            if not isinstance(raw_step, dict):
                continue

            tool_name = str(raw_step.get("tool_name", "")).strip()
            if tool_name not in enterprise_tool_names:
                raise PlatformWorkflowRunServiceError(
                    400,
                    f"Workflow step uses an unknown tool: {tool_name}",
                )

            input_map = raw_step.get("input_map")
            if not isinstance(input_map, dict):
                catalog = enterprise_tool_catalog[tool_name]
                input_map = {catalog["input_key"]: catalog["input_key"]}

            step_inputs = {
                str(tool_input): inputs.get(str(workflow_input), "")
                for tool_input, workflow_input in input_map.items()
            }
            step_specs.append(
                (
                    str(raw_step.get("id") or f"step_{index}"),
                    str(raw_step.get("title") or tool_name),
                    tool_name,
                    step_inputs,
                ),
            )

        if not step_specs:
            raise PlatformWorkflowRunServiceError(
                400,
                f"Workflow {template.get('workflow_type')} has no valid steps.",
            )

        return step_specs

    def status_counts(self, steps: list[dict[str, Any]]) -> dict[str, int]:
        counts = {"success": 0, "denied": 0, "failed": 0}
        for step in steps:
            status = str(step.get("status") or "failed")
            counts[status] = counts.get(status, 0) + 1
        return counts

    def run_status(self, counts: dict[str, int]) -> str:
        if counts.get("failed", 0) == 0 and counts.get("denied", 0) == 0:
            return "completed"
        if counts.get("success", 0) > 0:
            return "partial"
        return "failed"

    def summary(self, workflow_name: str, steps: list[dict[str, Any]]) -> str:
        success_count = sum(1 for step in steps if step.get("status") == "success")
        denied_count = sum(1 for step in steps if step.get("status") == "denied")
        failed_count = sum(1 for step in steps if step.get("status") == "failed")
        lines = [
            (
                f"{workflow_name}完成：{success_count} 步成功，"
                f"{denied_count} 步被权限拒绝，{failed_count} 步失败。"
            ),
        ]
        lines.extend(
            f"{step.get('title', step.get('tool_name', '步骤'))}: {step.get('message', '')}"
            for step in steps
            if step.get("message")
        )
        return "\n".join(lines)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _optional_filter(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None
