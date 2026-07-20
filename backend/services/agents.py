"""Service-layer orchestration for enterprise platform agents."""

from datetime import datetime, timezone
from typing import Any, Callable, Iterable
from uuid import uuid4

from repositories.agents import AgentRegistryError, AgentRepository


class PlatformAgentServiceError(ValueError):
    """Raised when an agent registry operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformAgentService:
    """Manage tenant-scoped platform agent registry records."""

    def __init__(
        self,
        *,
        repository: AgentRepository,
        templates: list[dict[str, Any]],
        approval_required_tools: set[str],
        tenant_for_user: Callable[[str], str],
        access_scope_diagnostics: Callable[
            [str, dict[str, list[str]]],
            dict[str, Any],
        ],
    ) -> None:
        self._repository = repository
        self._templates = templates
        self._approval_required_tools = approval_required_tools
        self._tenant_for_user = tenant_for_user
        self._access_scope_diagnostics = access_scope_diagnostics

    def list_agents(self) -> list[dict[str, Any]]:
        try:
            return self._repository.list()
        except AgentRegistryError as exc:
            raise PlatformAgentServiceError(500, str(exc)) from exc

    def save_agents(self, agents: list[dict[str, Any]]) -> None:
        self._repository.save_all(agents)

    def import_agents_payload(self, value: Any, *, mode: str) -> None:
        imported_agents = self.normalize_import_agents(value)
        agents = (
            imported_agents
            if mode == "replace"
            else _merge_by_key(self.list_agents(), imported_agents, "id")
        )
        self.save_agents(agents)

    def normalize_import_agents(self, value: Any) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise PlatformAgentServiceError(
                400,
                "agents must be a JSON array.",
            )
        return [
            dict(item)
            for item in value
            if isinstance(item, dict) and item.get("id")
        ]

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        try:
            agent = self._repository.get(agent_id)
        except AgentRegistryError as exc:
            raise PlatformAgentServiceError(500, str(exc)) from exc

        if agent is not None:
            return agent

        raise PlatformAgentServiceError(
            404,
            f"Unknown platform agent: {agent_id}",
        )

    def published_tool_scope(self, agent_id: str) -> tuple[dict[str, Any], set[str]]:
        agent = self.get_agent(agent_id)
        if agent.get("status") != "published":
            raise PlatformAgentServiceError(
                409,
                "该 Agent 实例已停用，不能运行。",
            )
        return agent, set(agent.get("tools") or [])

    def list_published_agents(self) -> list[dict[str, Any]]:
        return [
            agent
            for agent in self.list_agents()
            if agent.get("status") == "published"
        ]

    def get_published_agent(self, agent_id: str) -> dict[str, Any]:
        agent = next(
            (
                item
                for item in self.list_published_agents()
                if str(item.get("id")) == agent_id
            ),
            None,
        )
        if agent is None:
            raise PlatformAgentServiceError(
                404,
                f"Unknown published platform agent: {agent_id}",
            )
        return agent

    def published_tool_scope_for_user(
        self,
        agent_id: str,
        *,
        user_id: str,
        member: dict[str, Any] | None,
        role: str,
    ) -> tuple[dict[str, Any], set[str]]:
        agent, configured_tools = self.published_tool_scope(agent_id)
        self.assert_user_access(
            agent,
            user_id=user_id,
            member=member,
            role=role,
        )
        return agent, configured_tools

    def template_metadata(self) -> list[dict[str, Any]]:
        return [
            {
                "id": template["id"],
                "name": template["name"],
                "description": template["description"],
                "tools": list(template["tools"]),
                "capabilities": list(template["capabilities"]),
            }
            for template in self._templates
        ]

    def normalize_resource_ids(self, values: Iterable[Any] | None) -> list[str]:
        return _normalize_values(values)

    def normalize_access_values(self, values: Iterable[Any] | None) -> list[str]:
        return _normalize_values(values)

    def agent_access(self, agent: dict[str, Any]) -> dict[str, list[str]]:
        return {
            "allowed_user_ids": self.normalize_access_values(
                agent.get("allowed_user_ids"),
            ),
            "allowed_roles": self.normalize_access_values(agent.get("allowed_roles")),
        }

    def assert_user_access(
        self,
        agent: dict[str, Any],
        *,
        user_id: str,
        member: dict[str, Any] | None,
        role: str,
    ) -> None:
        agent_tenant = str(agent.get("tenant") or "").strip()
        runtime_tenant = self._tenant_for_user(user_id)
        if agent_tenant and runtime_tenant != agent_tenant:
            raise PlatformAgentServiceError(
                403,
                "当前身份不属于该 Agent 租户，无法运行该 Agent 实例。",
            )

        access = self.agent_access(agent)
        allowed_user_ids = access["allowed_user_ids"]
        allowed_roles = access["allowed_roles"]
        if member is not None and member.get("status") != "active":
            raise PlatformAgentServiceError(
                403,
                "当前身份已停用，无法运行该 Agent 实例。",
            )
        if not allowed_user_ids and not allowed_roles:
            return
        if user_id in allowed_user_ids:
            return
        if role and role in allowed_roles:
            return
        raise PlatformAgentServiceError(
            403,
            "当前身份无权运行该 Agent 实例。",
        )

    def access_summary(self, agent: dict[str, Any]) -> dict[str, Any]:
        tenant = str(agent.get("tenant") or "").strip()
        access = self.agent_access(agent)
        diagnostics = self._access_scope_diagnostics(tenant, access)
        return {
            **diagnostics,
            "allowed_user_count": len(access["allowed_user_ids"]),
            "allowed_role_count": len(access["allowed_roles"]),
            "open_to_tenant": not access["allowed_user_ids"]
            and not access["allowed_roles"],
            "access_scope_valid": not diagnostics["tenant_mismatched_user_ids"]
            and not diagnostics["unknown_roles"],
        }

    def readiness(self, agent: dict[str, Any]) -> dict[str, Any]:
        tools = list(agent.get("tools") or [])
        knowledge_base_ids = list(agent.get("knowledge_base_ids") or [])
        tenant = str(agent.get("tenant") or "").strip()
        model_configured = bool(agent.get("model_config_id"))
        memory_enabled = bool(agent.get("memory_enabled", False))
        workflow_enabled = bool(agent.get("workflow_enabled", False))
        access = self.agent_access(agent)
        access_summary = self.access_summary(agent)
        access_restricted = bool(access["allowed_user_ids"] or access["allowed_roles"])
        approval_required_tools = [
            tool_name
            for tool_name in tools
            if tool_name in self._approval_required_tools
        ]
        checks = {
            "tenant_configured": bool(tenant),
            "model_configured": model_configured,
            "knowledge_configured": bool(knowledge_base_ids),
            "tools_configured": bool(tools),
            "memory_enabled": memory_enabled,
            "workflow_enabled": workflow_enabled,
            "access_restricted": access_restricted,
            "access_scope_valid": bool(access_summary["access_scope_valid"]),
            "approval_required_tools": approval_required_tools,
        }
        issues = []

        if not tenant:
            issues.append(
                {
                    "code": "missing_tenant",
                    "severity": "blocking",
                    "message": "未配置租户，Agent 不能安全发布给企业身份。",
                },
            )
        if not model_configured:
            issues.append(
                {
                    "code": "missing_model",
                    "severity": "blocking",
                    "message": "未绑定模型配置，Agent 不能稳定执行。",
                },
            )
        if not tools:
            issues.append(
                {
                    "code": "missing_tools",
                    "severity": "warning",
                    "message": "未启用工具，只能做纯对话或知识检索。",
                },
            )
        if not knowledge_base_ids:
            issues.append(
                {
                    "code": "missing_knowledge",
                    "severity": "warning",
                    "message": "未绑定知识库，回答不会引用企业资料。",
                },
            )
        if approval_required_tools:
            issues.append(
                {
                    "code": "approval_required_tools",
                    "severity": "warning",
                    "message": "包含需要审批的高风险工具，运行时会进入审批流。",
                    "tools": approval_required_tools,
                },
            )
        if not memory_enabled:
            issues.append(
                {
                    "code": "memory_disabled",
                    "severity": "info",
                    "message": "长期记忆未启用，跨轮偏好和上下文不会沉淀。",
                },
            )
        if not workflow_enabled:
            issues.append(
                {
                    "code": "workflow_disabled",
                    "severity": "info",
                    "message": "工作流未启用，复杂任务不会自动编排。",
                },
            )
        if not access_summary["access_scope_valid"]:
            issues.append(
                {
                    "code": "invalid_access_scope",
                    "severity": "blocking",
                    "message": "访问范围包含跨租户用户或未知角色，请重新配置。",
                },
            )

        if not tenant or not model_configured or not access_summary["access_scope_valid"]:
            status = "blocked"
        elif any(issue["severity"] == "warning" for issue in issues):
            status = "partial"
        else:
            status = "ready"

        return {
            "status": status,
            "summary": {
                "knowledge_base_count": len(knowledge_base_ids),
                "tool_count": len(tools),
                "approval_required_tool_count": len(approval_required_tools),
                "tenant_configured": bool(tenant),
                "model_configured": model_configured,
                "memory_enabled": memory_enabled,
                "workflow_enabled": workflow_enabled,
                "access_restricted": access_restricted,
                "access_scope_valid": bool(access_summary["access_scope_valid"]),
            },
            "checks": checks,
            "issues": issues,
        }

    def response(self, agent: dict[str, Any]) -> dict[str, Any]:
        response = dict(agent)
        response["access_summary"] = self.access_summary(agent)
        response["readiness"] = self.readiness(agent)
        return response

    def registry_response(
        self,
        agents: Iterable[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        listed_agents = self.list_agents() if agents is None else list(agents)
        return {
            "templates": self.template_metadata(),
            "agents": [self.response(agent) for agent in listed_agents],
        }

    def mutation_response(
        self,
        agent: dict[str, Any],
        agents: Iterable[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "agent": self.response(agent),
            "agents": [self.response(item) for item in agents],
        }

    def run_metadata(self, agent: dict[str, Any] | None) -> dict[str, Any]:
        if agent is None:
            return {}
        access = self.agent_access(agent)
        return {
            "agent_id": agent.get("id"),
            "agent_name": agent.get("name"),
            "configured_tenant": agent.get("tenant"),
            "configured_tools": list(agent.get("tools") or []),
            "knowledge_base_ids": list(agent.get("knowledge_base_ids") or []),
            "model_config_id": agent.get("model_config_id"),
            "memory_enabled": bool(agent.get("memory_enabled", False)),
            "workflow_enabled": bool(agent.get("workflow_enabled", False)),
            "allowed_user_ids": access["allowed_user_ids"],
            "allowed_roles": access["allowed_roles"],
        }

    def resource_validation_inputs(
        self,
        payload: Any,
        *,
        existing_agent: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if existing_agent is None:
            return {
                "model_config_id": (payload.model_config_id or "").strip() or None,
                "knowledge_base_ids": self.normalize_resource_ids(
                    payload.knowledge_base_ids,
                ),
            }

        changes = payload.model_dump(exclude_unset=True)
        if "model_config_id" in changes:
            model_config_id = (payload.model_config_id or "").strip() or None
        else:
            model_config_id = (
                str(existing_agent.get("model_config_id") or "").strip() or None
            )

        if "knowledge_base_ids" in changes:
            knowledge_base_ids = self.normalize_resource_ids(
                payload.knowledge_base_ids,
            )
        else:
            knowledge_base_ids = self.normalize_resource_ids(
                existing_agent.get("knowledge_base_ids"),
            )

        return {
            "model_config_id": model_config_id,
            "knowledge_base_ids": knowledge_base_ids,
        }

    def create_agent(
        self,
        payload: Any,
        user_id: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        template = self.get_template(payload.template_id)
        template_tools = list(template["tools"])
        selected_tools = payload.tools if payload.tools is not None else template_tools
        self.validate_tools(template, selected_tools)

        now = datetime.now(timezone.utc).isoformat()
        tenant = self.normalize_tenant(payload.tenant, user_id)
        name = (payload.name or "").strip() or str(template["name"])
        description = (payload.description or "").strip() or str(
            template["description"],
        )
        model_config_id = (payload.model_config_id or "").strip() or None
        knowledge_base_ids = self.normalize_resource_ids(payload.knowledge_base_ids)
        allowed_user_ids = self.normalize_access_values(payload.allowed_user_ids)
        allowed_roles = self.normalize_access_values(payload.allowed_roles)
        self.validate_access_scope(
            tenant=tenant,
            allowed_user_ids=allowed_user_ids,
            allowed_roles=allowed_roles,
        )
        agent = {
            "id": str(uuid4()),
            "template_id": template["id"],
            "name": name,
            "description": description,
            "tenant": tenant,
            "tools": list(selected_tools),
            "knowledge_base_ids": knowledge_base_ids,
            "model_config_id": model_config_id,
            "memory_enabled": payload.memory_enabled,
            "workflow_enabled": payload.workflow_enabled,
            "allowed_user_ids": allowed_user_ids,
            "allowed_roles": allowed_roles,
            "capabilities": list(template["capabilities"]),
            "status": "published",
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
        }

        agents = self.list_agents()
        agents.append(agent)
        self.save_agents(agents)
        return agent, agents

    def update_agent(
        self,
        agent_id: str,
        payload: Any,
        user_id: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        agents = self.list_agents()
        agent_index = next(
            (
                index
                for index, item in enumerate(agents)
                if str(item.get("id", "")) == agent_id
            ),
            None,
        )
        if agent_index is None:
            raise PlatformAgentServiceError(
                404,
                f"Unknown platform agent: {agent_id}",
            )

        agent = dict(agents[agent_index])
        template = self.get_template(str(agent.get("template_id", "")))
        changes = payload.model_dump(exclude_unset=True)

        if "name" in changes:
            agent["name"] = (payload.name or "").strip() or str(template["name"])
        if "description" in changes:
            agent["description"] = (payload.description or "").strip() or str(
                template["description"],
            )
        if "tenant" in changes:
            agent["tenant"] = self.normalize_tenant(payload.tenant, user_id)
        if "tools" in changes:
            selected_tools = payload.tools if payload.tools is not None else []
            self.validate_tools(template, selected_tools)
            agent["tools"] = list(selected_tools)
        if "knowledge_base_ids" in changes:
            agent["knowledge_base_ids"] = self.normalize_resource_ids(
                payload.knowledge_base_ids,
            )
        if "model_config_id" in changes:
            agent["model_config_id"] = (payload.model_config_id or "").strip() or None
        if "memory_enabled" in changes:
            agent["memory_enabled"] = bool(payload.memory_enabled)
        if "workflow_enabled" in changes:
            agent["workflow_enabled"] = bool(payload.workflow_enabled)
        if "allowed_user_ids" in changes:
            agent["allowed_user_ids"] = self.normalize_access_values(
                payload.allowed_user_ids,
            )
        if "allowed_roles" in changes:
            agent["allowed_roles"] = self.normalize_access_values(
                payload.allowed_roles,
            )
        if "status" in changes:
            status = (payload.status or "").strip()
            if status not in {"published", "archived"}:
                raise PlatformAgentServiceError(
                    400,
                    "Platform agent status must be published or archived.",
                )
            agent["status"] = status

        self.validate_access_scope(
            tenant=str(agent.get("tenant") or "").strip(),
            allowed_user_ids=self.normalize_access_values(agent.get("allowed_user_ids")),
            allowed_roles=self.normalize_access_values(agent.get("allowed_roles")),
        )
        agent["capabilities"] = list(template["capabilities"])
        agent["updated_at"] = datetime.now(timezone.utc).isoformat()
        agents[agent_index] = agent
        self.save_agents(agents)
        return agent, agents

    def archive_agent(
        self,
        agent_id: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        agents = self.list_agents()
        agent_index = next(
            (
                index
                for index, item in enumerate(agents)
                if str(item.get("id", "")) == agent_id
            ),
            None,
        )
        if agent_index is None:
            raise PlatformAgentServiceError(
                404,
                f"Unknown platform agent: {agent_id}",
            )

        agent = dict(agents[agent_index])
        template = self.get_template(str(agent.get("template_id", "")))
        self.validate_access_scope(
            tenant=str(agent.get("tenant") or "").strip(),
            allowed_user_ids=self.normalize_access_values(agent.get("allowed_user_ids")),
            allowed_roles=self.normalize_access_values(agent.get("allowed_roles")),
        )
        agent["status"] = "archived"
        agent["capabilities"] = list(template["capabilities"])
        agent["updated_at"] = datetime.now(timezone.utc).isoformat()
        agents[agent_index] = agent
        self.save_agents(agents)
        return agent, agents

    def get_template(self, template_id: str) -> dict[str, Any]:
        template = next(
            (
                item
                for item in self._templates
                if item["id"] == template_id
            ),
            None,
        )
        if template is None:
            raise PlatformAgentServiceError(
                404,
                f"Unknown platform agent template: {template_id}",
            )

        return template

    def validate_tools(
        self,
        template: dict[str, Any],
        selected_tools: list[str],
    ) -> None:
        template_tools = list(template["tools"])
        unsupported_tools = [
            tool_name for tool_name in selected_tools if tool_name not in template_tools
        ]
        if unsupported_tools:
            raise PlatformAgentServiceError(
                400,
                {
                    "message": "Requested tools are not allowed by the template.",
                    "unsupported_tools": unsupported_tools,
                },
            )

    def normalize_tenant(self, value: Any, user_id: str) -> str:
        tenant = str(value or "").strip() or self._tenant_for_user(user_id)
        if not tenant:
            raise PlatformAgentServiceError(400, "Agent tenant is required.")
        return tenant

    def validate_access_scope(
        self,
        *,
        tenant: str,
        allowed_user_ids: list[str],
        allowed_roles: list[str],
    ) -> None:
        diagnostics = self._access_scope_diagnostics(
            tenant,
            {
                "allowed_user_ids": allowed_user_ids,
                "allowed_roles": allowed_roles,
            },
        )
        if diagnostics["tenant_mismatched_user_ids"] or diagnostics["unknown_roles"]:
            raise PlatformAgentServiceError(
                400,
                {
                    "message": (
                        "Agent access scope must stay inside the selected tenant."
                    ),
                    "tenant": tenant,
                    "tenant_mismatched_user_ids": diagnostics[
                        "tenant_mismatched_user_ids"
                    ],
                    "unknown_roles": diagnostics["unknown_roles"],
                },
            )


def _normalize_values(values: Iterable[Any] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        item = str(value).strip()
        if item and item not in seen:
            normalized.append(item)
            seen.add(item)
    return normalized


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
