"""Service-layer orchestration for enterprise tool policy configuration."""

import json
from pathlib import Path
from typing import Any, Callable

from permissions import ToolAuthorizationPolicy
from repositories.tool_policy import ToolPolicyRepository


class PlatformToolPolicyServiceError(ValueError):
    """Raised when a tool policy operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformToolPolicyService:
    """Manage enterprise tool authorization policy configuration."""

    def __init__(
        self,
        *,
        policy_path: Callable[[], Path],
        default_policy: dict[str, Any],
        policy_mode: Callable[[], str],
        enterprise_tool_names: list[str],
        runtime_context: Callable[[str], dict[str, Any]],
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
    ) -> None:
        self._policy_path = policy_path
        self._default_policy = default_policy
        self._policy_mode = policy_mode
        self._enterprise_tool_names = enterprise_tool_names
        self._runtime_context = runtime_context
        self._identity_metadata = identity_metadata

    def load_policy(self) -> dict[str, Any]:
        try:
            return self._repository().load()
        except ValueError as exc:
            raise PlatformToolPolicyServiceError(500, str(exc)) from exc

    def save_policy(self, policy: dict[str, Any]) -> None:
        self._repository().save(policy)

    def merge_import_policy(
        self,
        current_policy: dict[str, Any],
        imported_policy: dict[str, Any],
    ) -> dict[str, Any]:
        return _deep_merge_dict(current_policy, imported_policy)

    def import_policy_payload(self, value: Any, *, mode: str) -> None:
        if not isinstance(value, dict):
            raise PlatformToolPolicyServiceError(
                400,
                "tool_policy must be a JSON object.",
            )

        policy = value
        if mode != "replace":
            policy = self.merge_import_policy(
                self.load_policy(),
                value,
            )
        self.save_policy(policy)

    def build_authorization_policy(self) -> ToolAuthorizationPolicy:
        return ToolAuthorizationPolicy(
            self.load_policy(),
            mode=self._policy_mode(),  # type: ignore[arg-type]
        )

    def decision_payload(self, tool_name: str, decision: Any) -> dict[str, Any]:
        return {
            "name": tool_name,
            "allowed": decision.allowed,
            "reason": decision.reason,
        }

    @staticmethod
    def runtime_tenant(runtime: dict[str, Any]) -> str:
        """Return the tenant selected for the tool runtime context."""
        return str(runtime["tenant"])

    @staticmethod
    def runtime_connector(runtime: dict[str, Any]) -> Any:
        """Return the enterprise connector selected for the runtime context."""
        return runtime["connector"]

    @staticmethod
    def runtime_connector_label(runtime: dict[str, Any]) -> str:
        """Return the display label for the selected tool connector."""
        return str(runtime["connector_label"])

    @staticmethod
    def runtime_connector_source(runtime: dict[str, Any]) -> str:
        """Return the configuration source for the selected tool connector."""
        return str(runtime["connector_source"])

    def runtime_selection(self, runtime: dict[str, Any]) -> dict[str, Any]:
        """Return runtime fields needed by enterprise tool execution."""
        return {
            "tenant": self.runtime_tenant(runtime),
            "connector": self.runtime_connector(runtime),
            "connector_label": self.runtime_connector_label(runtime),
            "connector_source": self.runtime_connector_source(runtime),
        }

    def audit_stats(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        calls = len(events)
        successes = sum(1 for event in events if event.get("success") is True)
        failures = sum(1 for event in events if event.get("success") is False)
        durations = [
            float(event["duration_ms"])
            for event in events
            if isinstance(event.get("duration_ms"), (int, float))
        ]
        return {
            "calls": calls,
            "successes": successes,
            "failures": failures,
            "last_called_at": events[0].get("timestamp") if events else None,
            "avg_duration_ms": round(sum(durations) / len(durations), 2)
            if durations
            else None,
        }

    def audit_log_response(
        self,
        *,
        events: list[dict[str, Any]],
        filters: dict[str, Any],
        limit: int,
    ) -> dict[str, Any]:
        stats = self.audit_stats(events)
        return {
            "events": events,
            "summary": {
                "total_returned": stats["calls"],
                "successes": stats["successes"],
                "failures": stats["failures"],
                "avg_duration_ms": stats["avg_duration_ms"],
                "unique_users": len(
                    {
                        event.get("user_id")
                        for event in events
                        if event.get("user_id")
                    }
                ),
                "unique_agents": len(
                    {
                        event.get("agent_id")
                        for event in events
                        if event.get("agent_id")
                    }
                ),
                "unique_tools": len(
                    {
                        event.get("tool_name")
                        for event in events
                        if event.get("tool_name")
                    }
                ),
            },
            "filters": filters,
            "limit": limit,
        }

    def catalog_tool_payload(
        self,
        *,
        tool_name: str,
        catalog: dict[str, Any],
        decision: dict[str, Any] | None,
        events: list[dict[str, Any]],
        published_agents: list[dict[str, Any]],
        configured_agent: dict[str, Any] | None,
        configured_agent_tools: set[str],
    ) -> dict[str, Any]:
        return {
            "name": tool_name,
            "description": catalog["description"],
            "input_key": catalog["input_key"],
            "default_input": catalog["default_input"],
            "allowed": bool(decision and decision.get("allowed")),
            "reason": decision.get("reason") if decision else "",
            "configured_by_agents": [
                str(agent.get("id"))
                for agent in published_agents
                if tool_name in (agent.get("tools") or [])
            ],
            "configured_for_agent": (
                tool_name in configured_agent_tools
                if configured_agent is not None
                else None
            ),
            "configured_agent_id": (
                str(configured_agent.get("id")) if configured_agent else None
            ),
            "stats": self.audit_stats(events),
        }

    def normalize_policy_tools(self, value: list[str] | None) -> list[str]:
        if not value:
            return []

        seen: set[str] = set()
        result: list[str] = []
        allowed_names = set(self._enterprise_tool_names)
        for item in value:
            name = str(item or "").strip()
            if name in allowed_names and name not in seen:
                seen.add(name)
                result.append(name)
        return result

    def build_connector_call(
        self,
        *,
        tenant: str,
        tool_name: str,
        inputs: dict[str, Any],
        runtime_connector: Any,
    ) -> tuple[dict[str, Any], Callable[[], Any]]:
        if tool_name == "enterprise_lookup_policy":
            keyword = str(inputs.get("keyword", "")).strip()
            return (
                {"keyword": keyword},
                lambda: runtime_connector.lookup_policy(tenant, keyword),
            )

        if tool_name == "enterprise_get_ticket_status":
            ticket_id = str(inputs.get("ticket_id", "")).strip()
            return (
                {"ticket_id": ticket_id},
                lambda: runtime_connector.get_ticket_status(tenant, ticket_id),
            )

        department = str(inputs.get("department", "")).strip()
        return (
            {"department": department},
            lambda: runtime_connector.summarize_department_metrics(
                tenant,
                department,
            ),
        )

    def format_tool_result_answer(
        self,
        *,
        tool_name: str,
        result: dict[str, Any] | None,
        tenant: str,
    ) -> str:
        if not result:
            return "已匹配到企业工具，但当前用户没有权限调用。"

        if tool_name == "enterprise_get_ticket_status":
            ticket_id = result.get("ticket_id", "")
            ticket = result.get("ticket")
            if not ticket:
                return f"在租户 {tenant} 下没有找到工单 {ticket_id}。"

            return (
                f"工单 {ticket_id} 当前状态是 {ticket.get('status', '-')}, "
                f"负责人是 {ticket.get('owner', '-')}, "
                f"摘要：{ticket.get('summary', '-')}。"
            )

        if tool_name == "enterprise_lookup_policy":
            matches = result.get("matches") or {}
            if not matches:
                available = ", ".join(result.get("available_policy_keys", []))
                return f"没有找到匹配的制度内容。当前可查关键词：{available}。"

            snippets = [
                f"{name}: {text}"
                for name, text in list(matches.items())[:3]
            ]
            return "查到这些制度内容：" + " ".join(snippets)

        metrics = result.get("metrics")
        department = result.get("department", "")
        if not metrics:
            available = ", ".join(result.get("available_departments", []))
            return f"没有找到 {department} 部门指标。当前可查部门：{available}。"

        return (
            f"{department} 部门当前有 {metrics.get('active_projects', '-')} 个活跃项目，"
            f"{metrics.get('open_incidents', '-')} 个未关闭事件，"
            f"SLA 为 {metrics.get('sla', '-')}。"
        )

    def policy_payload(
        self,
        *,
        authorization_policy: ToolAuthorizationPolicy,
        user_id: str | None = None,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        resolved_user_id = user_id or "acme:alice"
        runtime = self._runtime_context(resolved_user_id)
        resolved_tenant = tenant or self.runtime_tenant(runtime)
        identities = self._identity_metadata(resolved_user_id, resolved_tenant)
        return {
            "mode": authorization_policy.mode,
            "path": str(self._policy_path()),
            "policy": self.load_policy(),
            "identities": identities,
            "selected": {
                "tenant": resolved_tenant,
                "user_id": resolved_user_id,
            },
        }

    def policy_request_payload(
        self,
        *,
        authorization_policy: ToolAuthorizationPolicy,
        query_user_id: str | None = None,
        header_user_id: str | None = None,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        return self.policy_payload(
            authorization_policy=authorization_policy,
            user_id=query_user_id or header_user_id,
            tenant=tenant,
        )

    @staticmethod
    def catalog_request_user_id(
        *,
        query_user_id: str | None = None,
        header_user_id: str | None = None,
    ) -> str:
        return query_user_id or header_user_id or "acme:alice"

    @staticmethod
    def run_request_user_id(
        *,
        payload_user_id: str | None = None,
        header_user_id: str | None = None,
    ) -> str:
        return payload_user_id or header_user_id or "acme:alice"

    def update_user_policy(
        self,
        *,
        tenant: str,
        user_id: str,
        allow: list[str] | None,
        deny: list[str] | None,
    ) -> ToolAuthorizationPolicy:
        normalized_tenant = tenant.strip()
        normalized_user_id = user_id.strip()
        if not normalized_tenant or not normalized_user_id:
            raise PlatformToolPolicyServiceError(
                400,
                "tenant and user_id are required.",
            )

        normalized_allow = self.normalize_policy_tools(allow)
        normalized_deny = self.normalize_policy_tools(deny)
        deny_set = set(normalized_deny)
        normalized_allow = [
            name for name in normalized_allow if name not in deny_set
        ]

        policy = self.load_policy()
        tenants = policy.setdefault("tenants", {})
        tenant_policy = tenants.setdefault(normalized_tenant, {})
        users = tenant_policy.setdefault("users", {})
        users[normalized_user_id] = {
            "allow": normalized_allow,
            "deny": normalized_deny,
        }

        self.save_policy(policy)
        return self.build_authorization_policy()

    def update_user_policy_payload(
        self,
        *,
        tenant: str,
        user_id: str,
        allow: list[str] | None,
        deny: list[str] | None,
    ) -> tuple[ToolAuthorizationPolicy, dict[str, Any]]:
        authorization_policy = self.update_user_policy(
            tenant=tenant,
            user_id=user_id,
            allow=allow,
            deny=deny,
        )
        return (
            authorization_policy,
            self.policy_payload(
                authorization_policy=authorization_policy,
                user_id=user_id.strip(),
                tenant=tenant.strip(),
            ),
        )

    def update_user_policy_request_payload(
        self,
        payload: dict[str, Any],
    ) -> tuple[ToolAuthorizationPolicy, dict[str, Any]]:
        return self.update_user_policy_payload(
            tenant=str(payload.get("tenant") or ""),
            user_id=str(payload.get("user_id") or ""),
            allow=payload.get("allow"),
            deny=payload.get("deny"),
        )

    def _repository(self) -> ToolPolicyRepository:
        return ToolPolicyRepository(
            self._policy_path(),
            json.loads(json.dumps(self._default_policy)),
        )


def _deep_merge_dict(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(base))
    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged
