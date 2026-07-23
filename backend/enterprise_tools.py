# -*- coding: utf-8 -*-
"""Enterprise tool runtime factories and authorization wrappers."""
from __future__ import annotations

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
}


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
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self._tenant = tenant
        self._user_id = user_id
        self._authorization_policy = authorization_policy

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

        return PermissionDecision(
            behavior=PermissionBehavior.ALLOW,
            message=(
                f"Enterprise tool {self.name} is allowed for "
                f"user {self._user_id} in tenant {self._tenant}."
            ),
            decision_reason=decision.reason,
        )


@dataclass(frozen=True)
class EnterpriseToolRuntimeFactory:
    """Build and execute tenant-aware enterprise tools."""

    runtime_context: Callable[..., dict[str, Any]]
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    audit_logger: ToolAuditLogger
    authorization_policy: Callable[[], ToolAuthorizationPolicy]
    tool_names: list[str]

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

        authorization_policy = self.authorization_policy()
        return [
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
            ),
            ReadOnlyEnterpriseTool(
                get_ticket_status,
                name="enterprise_get_ticket_status",
                description="Read a tenant-scoped IT, finance, or support ticket.",
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
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
            ),
            ReadOnlyEnterpriseTool(
                get_weather_forecast,
                name="enterprise_get_weather_forecast",
                description="Query a real city weather forecast from Open-Meteo.",
                is_read_only=True,
                tenant=tenant,
                user_id=user_id,
                authorization_policy=authorization_policy,
            ),
        ]

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
