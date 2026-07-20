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

    def normalize_import_templates(self, value: Any) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise PlatformWorkflowTemplateServiceError(
                400,
                "workflow_templates must be a JSON array.",
            )
        return [
            dict(item)
            for item in value
            if isinstance(item, dict) and item.get("workflow_type")
        ]

    def merge_import_templates(
        self,
        existing: list[dict[str, Any]],
        imported: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return _merge_by_key(existing, imported, "workflow_type")

    def import_templates_payload(self, value: Any, *, mode: str) -> None:
        imported_workflows = self.normalize_import_templates(value)
        workflows = imported_workflows
        if mode != "replace":
            workflows = self.merge_import_templates(
                self.list_templates(),
                imported_workflows,
            )
        self.save_templates(workflows)

    def list_templates(self) -> list[dict[str, Any]]:
        if not self._repository.exists():
            workflows = self.default_templates()
            self.save_templates(workflows)
            return workflows

        try:
            return self._repository.list()
        except WorkflowTemplateRegistryError as exc:
            raise PlatformWorkflowTemplateServiceError(500, str(exc)) from exc

    def list_templates_response(self) -> dict[str, Any]:
        return {"workflows": self.list_templates()}

    @staticmethod
    def update_template_response(
        *,
        workflow: dict[str, Any],
        workflows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {"workflow": workflow, "workflows": workflows}

    def get_template(self, workflow_type: str) -> dict[str, Any]:
        for workflow in self.list_templates():
            if str(workflow.get("workflow_type", "")).strip() == workflow_type:
                return workflow

        raise PlatformWorkflowTemplateServiceError(
            400,
            f"Unknown enterprise workflow: {workflow_type}",
        )

    def get_enabled_template(self, workflow_type: str) -> dict[str, Any]:
        workflow = self.get_template(workflow_type)
        if workflow.get("enabled") is False:
            raise PlatformWorkflowTemplateServiceError(
                400,
                f"Workflow is disabled: {workflow_type}",
            )
        return workflow

    def update_template_context(
        self,
        *,
        workflow_type: str,
        actor: str | None,
    ) -> dict[str, str]:
        return {
            "workflow_type": workflow_type.strip(),
            "actor": str(actor or "platform-admin").strip() or "platform-admin",
        }

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

    def list_runs_request_payload(
        self,
        *,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        return {
            "workflow_type": _optional_filter(workflow_type),
            "agent_id": _optional_filter(agent_id),
            "tenant": _optional_filter(tenant),
            "user_id": _optional_filter(user_id),
            "limit": limit,
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

    def build_run_request_payload(
        self,
        *,
        payload: Any,
        actor: str | None,
    ) -> dict[str, Any]:
        user_id = payload.user_id or actor or "acme:alice"
        requested_agent_id = _optional_filter(payload.agent_id) or ""
        return {
            "user_id": user_id,
            "requested_agent_id": requested_agent_id,
            "agent_id": requested_agent_id or "platform-workflow",
            "workflow_type": payload.workflow_type.strip(),
            "inputs": payload.inputs,
            "approval_id": payload.approval_id,
        }

    def build_platform_scenarios(
        self,
        *,
        workflows: list[dict[str, Any]],
        workflow_runs: list[dict[str, Any]],
        pending_approvals: list[dict[str, Any]],
        enterprise_tool_catalog: dict[str, dict[str, Any]],
        approval_required_tools: set[str],
        approval_required_workflows: set[str],
    ) -> dict[str, Any]:
        scenarios: list[dict[str, Any]] = []

        for workflow in workflows:
            workflow_type = str(workflow.get("workflow_type", "")).strip()
            steps = (
                workflow.get("steps")
                if isinstance(workflow.get("steps"), list)
                else []
            )
            tools = [
                str(step.get("tool_name", "")).strip()
                for step in steps
                if isinstance(step, dict) and str(step.get("tool_name", "")).strip()
            ]
            missing_tools = [
                tool_name
                for tool_name in tools
                if tool_name not in enterprise_tool_catalog
            ]
            approval_tools = [
                tool_name for tool_name in tools if tool_name in approval_required_tools
            ]
            approval_required = workflow_type in approval_required_workflows or bool(
                approval_tools,
            )
            pending_approval_count = sum(
                1
                for approval in pending_approvals
                if approval.get("workflow_type") == workflow_type
                or approval.get("tool_name") in approval_tools
            )
            matching_runs = [
                run
                for run in workflow_runs
                if run.get("workflow_type") == workflow_type
            ]

            if workflow.get("enabled") is False:
                status = "blocked"
                next_action = {"code": "enable_workflow", "target": "workflows"}
            elif missing_tools or approval_required:
                status = "partial"
                next_action = {
                    "code": "request_approval"
                    if approval_required
                    else "configure_tools",
                    "target": "governance" if approval_required else "tools",
                }
            else:
                status = "ready"
                next_action = {"code": "run", "target": "workflows"}

            scenarios.append(
                {
                    "scenario_id": workflow_type,
                    "name": workflow.get("name") or workflow_type,
                    "description": workflow.get("description") or "",
                    "status": status,
                    "workflow_type": workflow_type,
                    "enabled": workflow.get("enabled") is not False,
                    "tools": tools,
                    "approval_required": approval_required,
                    "approval_required_tools": approval_tools,
                    "pending_approval_count": pending_approval_count,
                    "run_count": len(matching_runs),
                    "last_run": matching_runs[0] if matching_runs else None,
                    "evidence": {
                        "enabled": workflow.get("enabled") is not False,
                        "tool_count": len(tools),
                        "missing_tool_count": len(missing_tools),
                        "has_last_run": bool(matching_runs),
                    },
                    "next_action": next_action,
                },
            )

        status_counts = {
            "ready": sum(
                1 for scenario in scenarios if scenario["status"] == "ready"
            ),
            "partial": sum(
                1 for scenario in scenarios if scenario["status"] == "partial"
            ),
            "blocked": sum(
                1 for scenario in scenarios if scenario["status"] == "blocked"
            ),
        }
        return {
            "scenarios": scenarios,
            "summary": {
                "total_count": len(scenarios),
                "ready_count": status_counts["ready"],
                "partial_count": status_counts["partial"],
                "blocked_count": status_counts["blocked"],
            },
        }

    def append_run(self, record: dict[str, Any]) -> dict[str, Any]:
        self._repository.append(record)
        return record

    def workflow_name(self, template: dict[str, Any], workflow_type: str) -> str:
        return str(template.get("name") or workflow_type)

    def session_id(self, workflow_type: str, run_id: str) -> str:
        return f"platform-workflow:{workflow_type}:{run_id[:8]}"

    def audit_filter(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        session_id: str,
    ) -> dict[str, str]:
        return {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
        }

    def build_run_record(
        self,
        *,
        run_id: str,
        workflow_type: str,
        workflow_name: str,
        started_at: str,
        finished_at: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        connector: str,
        connector_source: str,
        approval_id: str | None,
        inputs: dict[str, str],
        steps: list[dict[str, Any]],
        tool_calls: list[dict[str, Any]],
        session_id: str,
    ) -> dict[str, Any]:
        status_counts = self.status_counts(steps)
        status = self.run_status(status_counts)
        return {
            "run_id": run_id,
            "workflow_type": workflow_type,
            "workflow_name": workflow_name,
            "status": status,
            "status_counts": status_counts,
            "started_at": started_at,
            "finished_at": finished_at,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "connector": connector,
            "connector_source": connector_source,
            "approval_id": approval_id,
            "inputs": inputs,
            "summary": self.summary(workflow_name, steps),
            "steps": steps,
            "tool_calls": tool_calls,
            "audit_filter": self.audit_filter(
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
            ),
        }

    def build_run_record_context(
        self,
        *,
        workflow_type: str,
        execution_context: dict[str, Any],
        finished_at: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        connector: str,
        connector_source: str,
        approval_id: str | None,
        steps: list[dict[str, Any]],
        tool_calls: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "run_id": str(execution_context["run_id"]),
            "workflow_type": workflow_type,
            "workflow_name": str(execution_context["workflow_name"]),
            "started_at": str(execution_context["started_at"]),
            "finished_at": finished_at,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "connector": connector,
            "connector_source": connector_source,
            "approval_id": approval_id,
            "inputs": execution_context["normalized_inputs"],
            "steps": steps,
            "tool_calls": tool_calls,
            "session_id": str(execution_context["session_id"]),
        }

    def denied_step_record(
        self,
        *,
        step_id: str,
        title: str,
        tool_name: str,
        inputs: dict[str, Any],
        decision: dict[str, Any],
        tenant: str,
        user_id: str,
        connector: str,
        connector_source: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        message = str(decision["reason"])
        step = {
            "id": step_id,
            "title": title,
            "tool_name": tool_name,
            "inputs": inputs,
            "status": "denied",
            "decision": decision,
            "message": message,
        }
        tool_call = {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": False,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector,
            "connector_source": connector_source,
            "decision": decision,
            "answer": message,
        }
        return step, tool_call

    def append_step_result(
        self,
        *,
        steps: list[dict[str, Any]],
        tool_calls: list[dict[str, Any]],
        step_result: tuple[dict[str, Any], dict[str, Any]],
    ) -> None:
        step, tool_call = step_result
        steps.append(step)
        tool_calls.append(tool_call)

    def run_step_tool_from_context(
        self,
        *,
        run_authorized_enterprise_tool: Callable[..., dict[str, Any]],
        user_id: str,
        tool_name: str,
        inputs: dict[str, Any],
        agent_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        return run_authorized_enterprise_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=inputs,
            agent_id=agent_id,
            session_id=session_id,
            fail_on_denied=False,
        )

    def build_tool_result_answer_context(
        self,
        *,
        tool_name: str,
        tool_response: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "tool_name": tool_name,
            "result": self.tool_response_result(tool_response),
            "tenant": self.tool_response_tenant(tool_response),
        }

    def executed_step_record(
        self,
        *,
        step_id: str,
        title: str,
        tool_name: str,
        inputs: dict[str, Any],
        tool_response: dict[str, Any],
        message: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        allowed = self.tool_response_allowed(tool_response)
        result = self.tool_response_result(tool_response)
        decision = self.tool_response_decision(tool_response)
        status = "success" if allowed else "denied"

        step = {
            "id": step_id,
            "title": title,
            "tool_name": tool_name,
            "inputs": inputs,
            "status": status,
            "result": result,
            "decision": decision,
            "message": message,
        }
        tool_call = {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": allowed,
            "tenant": self.tool_response_tenant(tool_response),
            "user_id": self.tool_response_user_id(tool_response),
            "connector": self.tool_response_connector(tool_response),
            "connector_source": self.tool_response_connector_source(
                tool_response,
            ),
            "decision": decision,
            "result": result,
            "answer": message,
        }
        return step, tool_call

    def executed_step_record_from_context(
        self,
        *,
        format_tool_result_answer: Callable[..., str],
        step_id: str,
        title: str,
        tool_name: str,
        inputs: dict[str, Any],
        tool_response: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        allowed = self.tool_response_allowed(tool_response)
        decision = self.tool_response_decision(tool_response)
        message = (
            format_tool_result_answer(
                **self.build_tool_result_answer_context(
                    tool_name=tool_name,
                    tool_response=tool_response,
                ),
            )
            if allowed
            else str((decision or {}).get("reason") or "当前用户无权调用该工具。")
        )
        return self.executed_step_record(
            step_id=step_id,
            title=title,
            tool_name=tool_name,
            inputs=inputs,
            tool_response=tool_response,
            message=message,
        )

    def error_detail_decision(self, detail: Any) -> dict[str, Any] | None:
        if isinstance(detail, dict) and isinstance(detail.get("decision"), dict):
            return detail["decision"]
        return None

    def error_detail_message(self, detail: Any) -> str:
        if isinstance(detail, dict):
            decision = detail.get("decision")
            if isinstance(decision, dict) and decision.get("reason"):
                return str(decision["reason"])
            if detail.get("detail"):
                return str(detail["detail"])
        return str(detail)

    def failed_step_record(
        self,
        *,
        step_id: str,
        title: str,
        tool_name: str,
        inputs: dict[str, Any],
        decision: dict[str, Any] | None,
        message: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        step = {
            "id": step_id,
            "title": title,
            "tool_name": tool_name,
            "inputs": inputs,
            "status": "failed",
            "decision": decision,
            "message": message,
        }
        tool_call = {
            "tool_name": tool_name,
            "inputs": inputs,
            "allowed": False,
            "decision": decision,
            "answer": message,
        }
        return step, tool_call

    def tool_response_allowed(self, tool_response: dict[str, Any]) -> bool:
        return bool(tool_response.get("allowed"))

    def tool_response_result(self, tool_response: dict[str, Any]) -> Any:
        return tool_response.get("result")

    def tool_response_decision(
        self,
        tool_response: dict[str, Any],
    ) -> dict[str, Any] | None:
        decision = tool_response.get("decision")
        if isinstance(decision, dict):
            return decision
        return None

    def tool_response_tenant(self, tool_response: dict[str, Any]) -> str:
        return str(tool_response["tenant"])

    def tool_response_user_id(self, tool_response: dict[str, Any]) -> Any:
        return tool_response.get("user_id")

    def tool_response_connector(self, tool_response: dict[str, Any]) -> Any:
        return tool_response.get("connector")

    def tool_response_connector_source(self, tool_response: dict[str, Any]) -> Any:
        return tool_response.get("connector_source")

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

    def default_inputs(self, template: dict[str, Any]) -> dict[str, Any]:
        default_inputs = template.get("default_inputs")
        if isinstance(default_inputs, dict):
            return default_inputs
        return {}

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

    def build_execution_context(
        self,
        *,
        workflow_type: str,
        workflow_template: dict[str, Any],
        inputs: dict[str, Any],
        run_id: str,
        started_at: str,
    ) -> dict[str, Any]:
        default_inputs = self.default_inputs(workflow_template)
        return {
            "run_id": run_id,
            "started_at": started_at,
            "session_id": self.session_id(workflow_type, run_id),
            "workflow_name": self.workflow_name(workflow_template, workflow_type),
            "default_inputs": default_inputs,
            "normalized_inputs": self.normalize_inputs(inputs, default_inputs),
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

    def approval_required_tools(
        self,
        step_specs: list[tuple[str, str, str, dict[str, Any]]],
        approval_required_tools: set[str],
    ) -> list[str]:
        return sorted(
            {
                tool_name
                for _step_id, _title, tool_name, _step_inputs in step_specs
                if tool_name in approval_required_tools
            },
        )

    def requires_approval(
        self,
        workflow_type: str,
        approval_required_tools: list[str],
        approval_required_workflows: set[str],
    ) -> bool:
        return workflow_type in approval_required_workflows or bool(
            approval_required_tools,
        )

    def build_approval_request_context(
        self,
        *,
        approval_id: str | None,
        workflow_type: str,
        tenant: str,
        user_id: str,
        agent_id: str,
        inputs: dict[str, str],
    ) -> dict[str, Any]:
        return {
            "approval_id": approval_id,
            "request_type": "workflow_run",
            "target_key": "workflow_type",
            "target_value": workflow_type,
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "inputs": inputs,
        }

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


def _merge_by_key(
    existing: list[dict[str, Any]],
    imported: list[dict[str, Any]],
    key: str,
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in [*existing, *imported]:
        item_key = str(item.get(key) or "").strip()
        if not item_key:
            continue
        if item_key not in merged:
            order.append(item_key)
        merged[item_key] = item
    return [merged[item_key] for item_key in order]
