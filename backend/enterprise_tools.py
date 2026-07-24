# -*- coding: utf-8 -*-
"""Enterprise tool runtime factories and authorization wrappers."""
from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Callable

from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
)
from agentscope.tool import FunctionTool, ToolBase

from audit import ToolAuditLogger
from permissions import ToolAuthorizationPolicy
from services.tools import PlatformToolPolicyService


APPROVAL_REQUIRED_TOOLS = {"enterprise_summarize_department_metrics"}
APPROVAL_REQUIRED_WORKFLOWS = {"policy_review"}
ENTERPRISE_TOOL_INPUT_FIELDS = {
    "enterprise_lookup_policy": "keyword",
    "enterprise_get_ticket_status": "ticket_id",
    "enterprise_summarize_department_metrics": "department",
    "enterprise_get_weather_forecast": "city",
    "enterprise_submit_leave_request": "business_run_id",
}
ENTERPRISE_TOOL_CATALOG = {
    "enterprise_lookup_policy": {
        "description": "Read a tenant-scoped enterprise policy snippet by keyword.",
        "input_key": "keyword",
        "default_input": "remote",
    },
    "enterprise_get_ticket_status": {
        "description": "Read a tenant-scoped IT, finance, or support ticket.",
        "input_key": "ticket_id",
        "default_input": "INC-1001",
    },
    "enterprise_summarize_department_metrics": {
        "description": "Read a tenant-scoped department operations metrics summary.",
        "input_key": "department",
        "default_input": "engineering",
    },
    "enterprise_get_weather_forecast": {
        "description": "Query a real city weather forecast from Open-Meteo.",
        "input_key": "city",
        "default_input": "北京",
    },
    "enterprise_submit_leave_request": {
        "description": "Submit an approved leave request to the governed HR service.",
        "input_key": "business_run_id",
        "default_input": "",
    },
}


@dataclass(frozen=True)
class EnterpriseToolInvocationContext:
    """Request-scoped context used by AgentScope permission checks."""

    approval_id: str | None
    agent_id: str
    tool_call_records: list[dict[str, Any]]
    request_id: str | None = None
    business_run_id: str | None = None
    session_id: str | None = None
    runtime_execution_id: str | None = None
    authorization_decision_id: str | None = None
    continuation_id: str | None = None
    immutable_digest: str | None = None
    idempotency_key: str | None = None


_ENTERPRISE_TOOL_INVOCATION: ContextVar[
    EnterpriseToolInvocationContext | None
] = ContextVar("enterprise_tool_invocation", default=None)


def start_enterprise_tool_invocation(
    *,
    approval_id: str | None,
    agent_id: str,
    tool_call_records: list[dict[str, Any]],
    request_id: str | None = None,
    business_run_id: str | None = None,
    session_id: str | None = None,
    runtime_execution_id: str | None = None,
    authorization_decision_id: str | None = None,
    continuation_id: str | None = None,
    immutable_digest: str | None = None,
    idempotency_key: str | None = None,
) -> Any:
    """Bind approval and evidence state for one AgentScope invocation."""
    return _ENTERPRISE_TOOL_INVOCATION.set(
        EnterpriseToolInvocationContext(
            approval_id=approval_id,
            agent_id=agent_id,
            tool_call_records=tool_call_records,
            request_id=request_id,
            business_run_id=business_run_id,
            session_id=session_id,
            runtime_execution_id=runtime_execution_id,
            authorization_decision_id=authorization_decision_id,
            continuation_id=continuation_id,
            immutable_digest=immutable_digest,
            idempotency_key=idempotency_key,
        ),
    )


def finish_enterprise_tool_invocation(token: Any) -> None:
    """Restore the previous AgentScope invocation context."""
    _ENTERPRISE_TOOL_INVOCATION.reset(token)


def current_enterprise_tool_invocation() -> EnterpriseToolInvocationContext | None:
    """Return the invocation context while AgentScope is executing a tool."""
    return _ENTERPRISE_TOOL_INVOCATION.get()


class EnterpriseToolRuntimeError(ValueError):
    """Raised when an enterprise tool invocation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class ReadOnlyEnterpriseTool(FunctionTool):
    """Read-only function tool gated by enterprise authorization policy."""

    def __init__(
        self,
        *args: Any,
        tenant: str,
        user_id: str,
        authorization_policy: ToolAuthorizationPolicy,
        approval_required_tools: set[str],
        approval_validator: Callable[..., str],
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._tenant = tenant
        self._user_id = user_id
        self._authorization_policy = authorization_policy
        self._approval_required_tools = approval_required_tools
        self._approval_validator = approval_validator

    async def check_read_only(
        self,
        _tool_input: dict[str, Any],
    ) -> bool:
        return self.is_read_only and self._authorization_policy.is_allowed(
            self._tenant,
            self._user_id,
            self.name,
        )

    async def check_permissions(
        self,
        _tool_input: dict[str, Any],
        _context: PermissionContext,
    ) -> PermissionDecision:
        decision = self._authorization_policy.authorize(
            self._tenant,
            self._user_id,
            self.name,
        )
        if not decision.allowed:
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message=(
                    f"Enterprise tool {self.name} is not allowed for "
                    f"user {self._user_id} in tenant {self._tenant}."
                ),
                decision_reason=decision.reason,
            )

        invocation = _ENTERPRISE_TOOL_INVOCATION.get()
        if self.name in self._approval_required_tools:
            approval_id = invocation.approval_id if invocation is not None else None
            agent_id = invocation.agent_id if invocation is not None else ""
            try:
                self._approval_validator(
                    approval_id=approval_id,
                    request_type="tool_run",
                    target_key="tool_name",
                    target_value=self.name,
                    tenant=self._tenant,
                    user_id=self._user_id,
                    agent_id=agent_id,
                    inputs=dict(_tool_input),
                )
            except Exception as exc:
                status_code = getattr(exc, "status_code", None)
                detail = getattr(exc, "detail", None)
                if (
                    status_code != 403
                    or not isinstance(detail, dict)
                    or not detail.get("approval_required")
                ):
                    raise
                if invocation is not None:
                    invocation.tool_call_records.append(
                        {
                            "tool_name": self.name,
                            "inputs": dict(_tool_input),
                            "allowed": False,
                            "approval_required": True,
                            "approval_detail": dict(detail),
                            "connector": getattr(
                                self,
                                "_agentfoundry_connector",
                                None,
                            ),
                            "connector_source": getattr(
                                self,
                                "_agentfoundry_connector_source",
                                None,
                            ),
                            "routing_source": "agentscope",
                            "routing_reason": (
                                "AgentScope denied the governed tool at the "
                                "permission enforcement point because a matching "
                                "approval was not available."
                            ),
                            "decision": {
                                "allowed": False,
                                "reason": str(
                                    detail.get(
                                        "message",
                                        "该工具需要审批后才能运行。",
                                    ),
                                ),
                                "approval_required": True,
                            },
                        },
                    )
                return PermissionDecision(
                    behavior=PermissionBehavior.DENY,
                    message=str(
                        detail.get("message", "该工具需要审批后才能运行。"),
                    ),
                    decision_reason="approval_required",
                )

        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message=(
                f"Enterprise tool {self.name} is allowed for "
                f"user {self._user_id} in tenant {self._tenant}."
            ),
            decision_reason=decision.reason,
        )


class GovernedLeaveTool(FunctionTool):
    """State-changing HR tool enforced at AgentScope's permission point."""

    def __init__(
        self,
        *args: Any,
        tenant: str,
        user_id: str,
        authorization_policy: ToolAuthorizationPolicy,
        leave_permission_validator: Callable[..., Any],
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._tenant = tenant
        self._user_id = user_id
        self._authorization_policy = authorization_policy
        self._leave_permission_validator = leave_permission_validator

    async def check_permissions(
        self,
        tool_input: dict[str, Any],
        _context: PermissionContext,
    ) -> PermissionDecision:
        policy = self._authorization_policy.authorize(
            self._tenant, self._user_id, self.name,
        )
        if not policy.allowed:
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message="当前账号没有提交请假申请的工具权限。",
                decision_reason=policy.reason,
            )
        invocation = current_enterprise_tool_invocation()
        try:
            if invocation is None:
                raise ValueError("missing trusted invocation context")
            self._leave_permission_validator(
                tenant_id=self._tenant,
                actor_id=self._user_id,
                tool_input=dict(tool_input),
                invocation=invocation,
            )
        except Exception as exc:
            if invocation is not None:
                invocation.tool_call_records.append({
                    "tool_name": self.name,
                    "inputs": dict(tool_input),
                    "allowed": False,
                    "connector": "HR Demo Service",
                    "connector_source": "governed_http_service",
                    "routing_source": "agentscope",
                    "routing_reason": "AgentScope denied the HR write at the permission enforcement point.",
                    "decision": {"allowed": False, "reason": str(exc)},
                })
            return PermissionDecision(
                behavior=PermissionBehavior.DENY,
                message="请假审批或恢复凭据无效，已阻止提交。",
                decision_reason="leave_continuation_invalid",
            )
        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message="已验证审批、申请摘要和恢复凭据。",
            decision_reason="approved_leave_continuation",
        )


@dataclass(frozen=True)
class EnterpriseToolRuntimeFactory:
    """Build and execute tenant-aware enterprise tools."""

    runtime_context: Callable[..., dict[str, Any]]
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    audit_logger: ToolAuditLogger
    authorization_policy: Callable[[], ToolAuthorizationPolicy]
    tool_names: list[str]
    approval_required_tools: set[str]
    approval_validator: Callable[..., str]
    leave_permission_validator: Callable[..., Any] | None = None
    leave_tool_executor: Callable[..., dict[str, Any]] | None = None

    async def build_tools(
        self,
        user_id: str,
        agent_id: str,
        session_id: str,
    ) -> list[ToolBase]:
        """Create tenant-aware business tools for one agent invocation."""
        runtime = self.runtime_context(user_id)
        runtime_selection = self.tool_policy_service().runtime_selection(runtime)
        tenant = runtime_selection["tenant"]
        runtime_connector = runtime_selection["connector"]
        connector_label = runtime_selection["connector_label"]

        def audit_tool_call(
            tool_name: str,
            inputs: dict[str, Any],
            call: Any,
        ) -> dict[str, Any]:
            return self.audit_logger.capture(
                user_id=user_id,
                tenant=tenant,
                agent_id=agent_id,
                session_id=session_id,
                tool_name=tool_name,
                connector=connector_label,
                inputs=inputs,
                call=call,
            )

        def lookup_policy(keyword: str) -> dict[str, Any]:
            """Look up tenant policy snippets by keyword.

            Args:
                keyword: Policy keyword, for example remote, expense, or security.
            """
            return audit_tool_call(
                "enterprise_lookup_policy",
                {"keyword": keyword},
                lambda: runtime_connector.lookup_policy(tenant, keyword),
            )

        def get_ticket_status(ticket_id: str) -> dict[str, Any]:
            """Return the status of a tenant-scoped ticket.

            Args:
                ticket_id: Ticket id visible inside the caller's tenant.
            """
            return audit_tool_call(
                "enterprise_get_ticket_status",
                {"ticket_id": ticket_id},
                lambda: runtime_connector.get_ticket_status(tenant, ticket_id),
            )

        def summarize_department_metrics(department: str) -> dict[str, Any]:
            """Return a compact operational summary for one department.

            Args:
                department: Department name, such as engineering or support.
            """
            return audit_tool_call(
                "enterprise_summarize_department_metrics",
                {"department": department},
                lambda: runtime_connector.summarize_department_metrics(
                    tenant,
                    department,
                ),
            )

        def get_weather_forecast(
            city: str,
            days: int = 1,
            start_day: int = 0,
        ) -> dict[str, Any]:
            """Return a real Open-Meteo daily forecast for a city.

            Args:
                city: City name, for example 北京 or Shanghai.
                days: Number of forecast days, from 1 to 7.
                start_day: Day offset where 0 is today and 1 is tomorrow.
            """
            clean_inputs, call = self.tool_policy_service().build_connector_call(
                tenant=tenant,
                tool_name="enterprise_get_weather_forecast",
                inputs={"city": city, "days": days, "start_day": start_day},
                runtime_connector=runtime_connector,
            )
            return self.audit_logger.capture(
                user_id=user_id,
                tenant=tenant,
                agent_id=agent_id,
                session_id=session_id,
                tool_name="enterprise_get_weather_forecast",
                connector="Open-Meteo",
                inputs=clean_inputs,
                call=call,
            )

        def submit_leave_request(business_run_id: str) -> dict[str, Any]:
            """Submit one approved leave request through the HR connector.

            Args:
                business_run_id: Trusted business run identifier supplied by AgentFoundry.
            """
            if self.leave_tool_executor is None:
                raise EnterpriseToolRuntimeError(503, "Leave connector is unavailable.")
            invocation = current_enterprise_tool_invocation()
            if invocation is None:
                raise EnterpriseToolRuntimeError(403, "Trusted leave context is missing.")
            return self.leave_tool_executor(
                tenant_id=tenant,
                actor_id=user_id,
                business_run_id=business_run_id,
                invocation=invocation,
            )

        authorization_policy = self.authorization_policy()
        tools = [
            ReadOnlyEnterpriseTool(
                lookup_policy,
                name="enterprise_lookup_policy",
                description=(
                    "Read a tenant-scoped enterprise policy snippet by keyword."
                ),
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
                approval_required_tools=self.approval_required_tools,
                approval_validator=self.approval_validator,
            ),
            ReadOnlyEnterpriseTool(
                get_ticket_status,
                name="enterprise_get_ticket_status",
                description="Read a tenant-scoped IT, finance, or support ticket.",
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
                approval_required_tools=self.approval_required_tools,
                approval_validator=self.approval_validator,
            ),
            ReadOnlyEnterpriseTool(
                summarize_department_metrics,
                name="enterprise_summarize_department_metrics",
                description=(
                    "Read a tenant-scoped department operations metrics summary."
                ),
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
                approval_required_tools=self.approval_required_tools,
                approval_validator=self.approval_validator,
            ),
            ReadOnlyEnterpriseTool(
                get_weather_forecast,
                name="enterprise_get_weather_forecast",
                description="Query a real city weather forecast from Open-Meteo.",
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
                approval_required_tools=self.approval_required_tools,
                approval_validator=self.approval_validator,
            ),
        ]
        if self.leave_permission_validator is not None and self.leave_tool_executor is not None:
            tools.append(
                GovernedLeaveTool(
                    submit_leave_request,
                    name="enterprise_submit_leave_request",
                    description="Submit the already approved leave request exactly once.",
                    is_read_only=False,
                    tenant=tenant,
                    user_id=user_id,
                    authorization_policy=authorization_policy,
                    leave_permission_validator=self.leave_permission_validator,
                ),
            )
        for tool in tools:
            if tool.name == "enterprise_submit_leave_request":
                tool._agentfoundry_connector = "HR Demo Service"
                tool._agentfoundry_connector_source = "governed_http_service"
            elif tool.name == "enterprise_get_weather_forecast":
                tool._agentfoundry_connector = "Open-Meteo"
                tool._agentfoundry_connector_source = "public_read_only_api"
            else:
                tool._agentfoundry_connector = connector_label
                tool._agentfoundry_connector_source = runtime_selection[
                    "connector_source"
                ]
        return tools

    def run_authorized_tool(
        self,
        *,
        user_id: str,
        tenant: str | None = None,
        tool_name: str,
        inputs: dict[str, Any],
        agent_id: str,
        session_id: str,
        fail_on_denied: bool = True,
    ) -> dict[str, Any]:
        runtime = (
            self.runtime_context(user_id, tenant=tenant)
            if tenant is not None
            else self.runtime_context(user_id)
        )
        tool_policy_service = self.tool_policy_service()
        runtime_selection = tool_policy_service.runtime_selection(runtime)
        tenant = runtime_selection["tenant"]
        runtime_connector = runtime_selection["connector"]
        connector_label = runtime_selection["connector_label"]
        connector_source = runtime_selection["connector_source"]
        if tool_name == "enterprise_get_weather_forecast":
            connector_label = "Open-Meteo"
            connector_source = "public_read_only_api"

        if tool_name not in self.tool_names:
            raise EnterpriseToolRuntimeError(
                400,
                f"Unknown enterprise tool: {tool_name}",
            )

        decision = self.authorization_policy().authorize(tenant, user_id, tool_name)
        decision_payload = tool_policy_service.decision_payload(
            tool_name,
            decision,
        )
        if not decision.allowed:
            if fail_on_denied:
                raise EnterpriseToolRuntimeError(
                    403,
                    {"decision": decision_payload},
                )

            return {
                "tool_name": tool_name,
                "allowed": False,
                "tenant": tenant,
                "user_id": user_id,
                "connector": connector_label,
                "connector_source": connector_source,
                "decision": decision_payload,
            }

        clean_inputs, call = tool_policy_service.build_connector_call(
            tenant=tenant,
            tool_name=tool_name,
            inputs=inputs,
            runtime_connector=runtime_connector,
        )

        result = self.audit_logger.capture(
            user_id=user_id,
            tenant=tenant,
            agent_id=agent_id,
            session_id=session_id,
            tool_name=tool_name,
            connector=connector_label,
            inputs=clean_inputs,
            call=call,
        )

        return {
            "tool_name": tool_name,
            "allowed": True,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector_label,
            "connector_source": connector_source,
            "decision": decision_payload,
            "result": result,
        }
