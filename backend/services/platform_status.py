"""Enterprise platform status, readiness, and operator task composition."""

from collections.abc import Callable
from typing import Any


class PlatformStatusService:
    """Compose platform console snapshots from repositories and runtime services."""

    AUTO_RESOLVABLE_OPS_TASKS = {"disabled_workflows"}

    def __init__(
        self,
        *,
        list_approval_records: Callable[..., list[dict[str, Any]]],
        load_workflow_runs: Callable[..., list[dict[str, Any]]],
        load_workflow_templates: Callable[[], list[dict[str, Any]]],
        load_agents: Callable[[], list[dict[str, Any]]],
        load_memories: Callable[..., list[dict[str, Any]]],
        agent_run_repository: Any,
        audit_logger: Any,
        tool_policy: Any,
        connector_health: Callable[[], dict[str, Any]],
        agent_readiness: Callable[[dict[str, Any]], dict[str, Any]],
        enterprise_tool_names: list[str],
        enterprise_tool_catalog: dict[str, dict[str, Any]],
        approval_required_tools: set[str],
        approval_required_workflows: set[str],
    ) -> None:
        self._list_approval_records = list_approval_records
        self._load_workflow_runs = load_workflow_runs
        self._load_workflow_templates = load_workflow_templates
        self._load_agents = load_agents
        self._load_memories = load_memories
        self._agent_run_repository = agent_run_repository
        self._audit_logger = audit_logger
        self._tool_policy = tool_policy
        self._connector_health = connector_health
        self._agent_readiness = agent_readiness
        self._enterprise_tool_names = enterprise_tool_names
        self._enterprise_tool_catalog = enterprise_tool_catalog
        self._approval_required_tools = approval_required_tools
        self._approval_required_workflows = approval_required_workflows

    @staticmethod
    def runtime_tenant(runtime: dict[str, Any]) -> str:
        """Return the tenant selected for the runtime context."""
        return str(runtime["tenant"])

    @staticmethod
    def runtime_connector_label(runtime: dict[str, Any]) -> str:
        """Return the human-readable connector label for the runtime context."""
        return str(runtime["connector_label"])

    @staticmethod
    def runtime_connector_source(runtime: dict[str, Any]) -> str:
        """Return the connector configuration source for the runtime context."""
        return str(runtime["connector_source"])

    @staticmethod
    def runtime_saved_config_enabled(runtime: dict[str, Any]) -> bool:
        """Return whether the runtime context came from saved connector config."""
        return bool(runtime["saved_config_enabled"])

    def runtime_selection(self, runtime: dict[str, Any]) -> dict[str, Any]:
        """Return normalized runtime metadata for platform status endpoints."""
        return {
            "tenant": self.runtime_tenant(runtime),
            "connector_label": self.runtime_connector_label(runtime),
            "connector_source": self.runtime_connector_source(runtime),
            "saved_config_enabled": self.runtime_saved_config_enabled(runtime),
        }

    def dashboard(self, *, tenant: str, user_id: str) -> dict[str, Any]:
        """Build a compact platform operations snapshot for the console."""
        pending_approvals = self._list_approval_records(
            limit=3,
            status="pending",
            tenant=tenant,
            user_id=user_id,
        )
        approved_approvals = self._list_approval_records(
            limit=100,
            status="approved",
            tenant=tenant,
            user_id=user_id,
        )
        recent_workflow_runs = self._load_workflow_runs(
            limit=3,
            tenant=tenant,
            user_id=user_id,
        )
        workflow_runs = self._load_workflow_runs(
            limit=100,
            tenant=tenant,
            user_id=user_id,
        )
        workflow_templates = self._load_workflow_templates()
        enabled_workflows = [
            workflow
            for workflow in workflow_templates
            if workflow.get("enabled") is not False
        ]
        disabled_workflows = [
            workflow
            for workflow in workflow_templates
            if workflow.get("enabled") is False
        ]
        workflow_status_counts = {
            "completed": 0,
            "partial": 0,
            "failed": 0,
        }
        for run in workflow_runs:
            status = str(run.get("status") or "failed")
            workflow_status_counts[status] = workflow_status_counts.get(status, 0) + 1

        workflow_pending_approvals = [
            approval
            for approval in pending_approvals
            if approval.get("request_type") == "workflow_run"
        ]
        tool_pending_approvals = [
            approval
            for approval in pending_approvals
            if approval.get("request_type") == "tool_run"
        ]
        governed_workflows = self._governed_workflows(
            workflow_templates,
            workflow_pending_approvals,
        )
        recent_audit_events = self._audit_logger.query(
            tenant=tenant,
            user_id=user_id,
            limit=4,
        )
        audit_events = self._audit_logger.query(
            tenant=tenant,
            user_id=user_id,
            limit=100,
        )
        risk_tools = self._risk_tools(tenant=tenant, user_id=user_id)
        todos = self._dashboard_todos(pending_approvals, recent_audit_events)
        operational_actions = self._recommended_actions(
            pending_approvals=pending_approvals,
            workflow_status_counts=workflow_status_counts,
            disabled_workflows=disabled_workflows,
            workflow_runs=workflow_runs,
            enabled_workflows=enabled_workflows,
        )

        return {
            "pending_approvals": {
                "count": len(pending_approvals),
                "items": pending_approvals,
            },
            "approved_approval_count": len(approved_approvals),
            "recent_workflow_runs": recent_workflow_runs,
            "workflow_run_count": len(workflow_runs),
            "recent_audit_events": recent_audit_events,
            "audit_event_count": len(audit_events),
            "risk_tools": risk_tools,
            "todos": todos,
            "operations": {
                "workflow_template_count": len(workflow_templates),
                "enabled_workflow_count": len(enabled_workflows),
                "disabled_workflow_count": len(disabled_workflows),
                "workflow_status_counts": workflow_status_counts,
                "pending_workflow_approval_count": len(workflow_pending_approvals),
                "pending_tool_approval_count": len(tool_pending_approvals),
                "governed_workflows": governed_workflows,
                "recommended_actions": operational_actions,
            },
        }

    def platform_snapshot(
        self,
        *,
        platform_version: str,
        data_dir: Any,
        runtime: dict[str, Any],
        tenant: str,
        user_id: str,
        identities: list[dict[str, Any]],
        tenant_workspaces: dict[str, Any],
        subagent_templates: list[Any],
    ) -> dict[str, Any]:
        """Build the top-level enterprise platform status payload."""
        return {
            "platform": {
                "name": "AgentScope Enterprise Agent Platform",
                "version": platform_version,
            },
            "current_user": {
                "user_id": user_id,
                "tenant": tenant,
            },
            "connector": {
                "name": self.runtime_connector_label(runtime),
                "source": self.runtime_connector_source(runtime),
                "saved_config_enabled": self.runtime_saved_config_enabled(runtime),
            },
            "identities": identities,
            "tenant_workspaces": tenant_workspaces,
            "current_workspace": tenant_workspaces.get(tenant),
            "storage": {
                "data_dir": str(data_dir),
                "audit_log_path": str(self._audit_logger.path),
            },
            "audit": {
                "enabled": self._audit_logger.enabled,
                "recent_events": self._audit_logger.recent(limit=12),
            },
            "dashboard": self.dashboard(
                tenant=tenant,
                user_id=user_id,
            ),
            "launch_readiness": self.launch_readiness(
                tenant=tenant,
                user_id=user_id,
                identities=identities,
            ),
            "tool_policy": {
                "mode": self._tool_policy.mode,
                "decisions": self._tool_policy.describe_for_user(
                    tenant,
                    user_id,
                    self._enterprise_tool_names,
                ),
            },
            "subagent_templates": [
                {
                    "type": template.type,
                    "description": template.description,
                    "permission_mode": getattr(
                        template.permission_context.mode,
                        "value",
                        str(template.permission_context.mode),
                    ),
                    "override_leader_mode": template.override_leader_mode,
                }
                for template in subagent_templates
            ],
        }

    def governance_snapshot(
        self,
        *,
        identities: list[dict[str, Any]],
        tenant_workspaces: dict[str, Any],
    ) -> dict[str, Any]:
        """Build the platform governance model used by the enterprise console."""
        pending_approvals = self._list_approval_records(
            status="pending",
            limit=100,
        )
        recent_audit_events = self._audit_logger.recent(limit=100)

        pending_by_user: dict[str, int] = {}
        pending_by_tenant: dict[str, int] = {}
        for approval in pending_approvals:
            user_id = str(approval.get("user_id") or "")
            tenant = str(approval.get("tenant") or "")
            if user_id:
                pending_by_user[user_id] = pending_by_user.get(user_id, 0) + 1
            if tenant:
                pending_by_tenant[tenant] = pending_by_tenant.get(tenant, 0) + 1

        audit_by_user: dict[str, list[dict[str, Any]]] = {}
        audit_by_tenant: dict[str, list[dict[str, Any]]] = {}
        for event in recent_audit_events:
            user_id = str(event.get("user_id") or "")
            tenant = str(event.get("tenant") or "")
            if user_id:
                audit_by_user.setdefault(user_id, []).append(event)
            if tenant:
                audit_by_tenant.setdefault(tenant, []).append(event)

        identity_summaries: list[dict[str, Any]] = []
        tenant_summaries: dict[str, dict[str, Any]] = {
            tenant: {
                "tenant": tenant,
                "identity_count": 0,
                "roles": set(),
                "allowed_count": 0,
                "denied_count": 0,
                "pending_approvals": pending_by_tenant.get(tenant, 0),
                "audit_events": len(audit_by_tenant.get(tenant, [])),
                "failed_audit_events": sum(
                    1
                    for event in audit_by_tenant.get(tenant, [])
                    if event.get("success") is False
                ),
                "workspace_source": str(
                    (tenant_workspaces.get(tenant) or {}).get("source")
                    or (tenant_workspaces.get(tenant) or {}).get(
                        "runtime_connector_source",
                        "",
                    ),
                ),
            }
            for tenant in tenant_workspaces
        }

        for identity in identities:
            user_id = str(identity.get("user_id") or "")
            tenant = str(identity.get("tenant") or "")
            decisions = (
                ((identity.get("tool_policy") or {}).get("decisions") or [])
                if isinstance(identity.get("tool_policy"), dict)
                else []
            )
            allowed_count = sum(1 for decision in decisions if decision.get("allowed"))
            denied_count = len(decisions) - allowed_count
            user_events = audit_by_user.get(user_id, [])
            failed_user_events = sum(
                1 for event in user_events if event.get("success") is False
            )
            pending_count = pending_by_user.get(user_id, 0)

            identity_summaries.append(
                {
                    "user_id": user_id,
                    "tenant": tenant,
                    "display_name": str(identity.get("display_name") or user_id),
                    "role": str(identity.get("role") or "Enterprise user"),
                    "allowed_count": allowed_count,
                    "denied_count": denied_count,
                    "pending_approvals": pending_count,
                    "recent_audit_events": len(user_events),
                    "failed_audit_events": failed_user_events,
                },
            )

            tenant_summary = tenant_summaries.setdefault(
                tenant,
                {
                    "tenant": tenant,
                    "identity_count": 0,
                    "roles": set(),
                    "allowed_count": 0,
                    "denied_count": 0,
                    "pending_approvals": pending_by_tenant.get(tenant, 0),
                    "audit_events": len(audit_by_tenant.get(tenant, [])),
                    "failed_audit_events": sum(
                        1
                        for event in audit_by_tenant.get(tenant, [])
                        if event.get("success") is False
                    ),
                    "workspace_source": "",
                },
            )
            tenant_summary["identity_count"] += 1
            tenant_summary["roles"].add(str(identity.get("role") or "Enterprise user"))
            tenant_summary["allowed_count"] += allowed_count
            tenant_summary["denied_count"] += denied_count

        normalized_tenant_summaries = []
        for tenant_summary in tenant_summaries.values():
            normalized_tenant_summaries.append(
                {
                    **tenant_summary,
                    "roles": sorted(tenant_summary["roles"]),
                },
            )

        risky_identity_count = sum(
            1
            for summary in identity_summaries
            if summary["denied_count"]
            or summary["pending_approvals"]
            or summary["failed_audit_events"]
        )

        return {
            "identities": identities,
            "tenant_workspaces": tenant_workspaces,
            "tenant_summaries": sorted(
                normalized_tenant_summaries,
                key=lambda item: item["tenant"],
            ),
            "identity_summaries": sorted(
                identity_summaries,
                key=lambda item: (item["tenant"], item["user_id"]),
            ),
            "pending_approvals": pending_approvals,
            "recent_audit_events": recent_audit_events[:20],
            "summary": {
                "tenant_count": len(normalized_tenant_summaries),
                "identity_count": len(identities),
                "risky_identity_count": risky_identity_count,
                "pending_approval_count": len(pending_approvals),
                "audit_event_count": len(recent_audit_events),
                "failed_audit_event_count": sum(
                    1
                    for event in recent_audit_events
                    if event.get("success") is False
                ),
            },
        }

    def launch_readiness(
        self,
        *,
        tenant: str,
        user_id: str,
        identities: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build an authoritative launch checklist for the enterprise console."""
        agents = self._load_agents()
        active_agents = [
            agent
            for agent in agents
            if agent.get("status") == "published"
            and str(agent.get("tenant") or tenant) == tenant
        ]
        agent_readiness = [self._agent_readiness(agent) for agent in active_agents]
        ready_agents = [
            agent
            for agent, readiness in zip(active_agents, agent_readiness)
            if readiness.get("status") == "ready"
        ]
        runnable_agents = [
            agent
            for agent, readiness in zip(active_agents, agent_readiness)
            if readiness.get("status") in {"ready", "partial"}
        ]
        agents_with_models = [
            agent for agent in active_agents if agent.get("model_config_id")
        ]
        agents_with_knowledge = [
            agent for agent in active_agents if agent.get("knowledge_base_ids")
        ]
        agents_with_tools = [agent for agent in active_agents if agent.get("tools")]
        memory_enabled_agents = [
            agent for agent in active_agents if agent.get("memory_enabled")
        ]
        memory_record_count = sum(
            len(
                self._load_memories(
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=str(agent.get("id", "")),
                ),
            )
            for agent in memory_enabled_agents
            if agent.get("id")
        )
        memory_enabled_ids = {agent.get("id") for agent in memory_enabled_agents}
        memory_hit_count = sum(
            int((run.get("evidence") or {}).get("memory_hit_count") or 0)
            for run in self._agent_run_repository.list(
                limit=100,
                tenant=tenant,
                user_id=user_id,
            )
            if run.get("agent_id") in memory_enabled_ids
        )
        workflow_templates = self._load_workflow_templates()
        enabled_workflows = [
            workflow
            for workflow in workflow_templates
            if workflow.get("enabled") is not False
        ]
        workflow_runs = self._load_workflow_runs(
            limit=100,
            tenant=tenant,
            user_id=user_id,
        )
        audit_events = self._audit_logger.query(
            tenant=tenant,
            user_id=user_id,
            limit=100,
        )
        connector = self._connector_health()
        decisions = self._tool_policy.describe_for_user(
            tenant,
            user_id,
            self._enterprise_tool_names,
        )
        tenant_identities = [
            identity for identity in identities if identity.get("tenant") == tenant
        ]
        items = [
            self._readiness_item(
                "model",
                "ready" if agents_with_models else "blocked",
                "credentials",
                {
                    "configured_agent_count": len(agents_with_models),
                    "published_agent_count": len(active_agents),
                },
            ),
            self._readiness_item(
                "agent",
                "ready"
                if ready_agents
                else "partial"
                if runnable_agents
                else "blocked",
                "agents",
                {
                    "published_agent_count": len(active_agents),
                    "ready_agent_count": len(ready_agents),
                    "runnable_agent_count": len(runnable_agents),
                },
            ),
            self._readiness_item(
                "knowledge",
                "ready"
                if agents_with_knowledge
                else "partial"
                if active_agents
                else "blocked",
                "knowledge",
                {
                    "bound_agent_count": len(agents_with_knowledge),
                    "published_agent_count": len(active_agents),
                },
            ),
            self._readiness_item(
                "tools",
                "ready"
                if agents_with_tools
                else "partial"
                if self._enterprise_tool_names
                else "blocked",
                "tools",
                {
                    "catalog_tool_count": len(self._enterprise_tool_names),
                    "agent_tool_count": sum(
                        len(agent.get("tools") or []) for agent in active_agents
                    ),
                    "configured_agent_count": len(agents_with_tools),
                },
            ),
            self._readiness_item(
                "memory",
                "ready"
                if memory_enabled_agents and (memory_record_count or memory_hit_count)
                else "partial"
                if memory_enabled_agents
                else "blocked",
                "memory",
                {
                    "enabled_agent_count": len(memory_enabled_agents),
                    "published_agent_count": len(active_agents),
                    "memory_record_count": memory_record_count,
                    "memory_hit_count": memory_hit_count,
                },
            ),
            self._readiness_item(
                "connector",
                "ready"
                if connector.get("status") == "ready"
                else "blocked"
                if connector.get("status") == "error"
                else "partial",
                "connectors",
                {
                    "name": connector.get("name"),
                    "mode": connector.get("mode"),
                    "status": connector.get("status"),
                },
            ),
            self._readiness_item(
                "governance",
                "ready"
                if tenant_identities and decisions
                else "partial"
                if identities or decisions
                else "blocked",
                "governance",
                {
                    "identity_count": len(tenant_identities),
                    "tool_policy_mode": self._tool_policy.mode,
                    "decision_count": len(decisions),
                },
            ),
            self._readiness_item(
                "workflow",
                "ready"
                if enabled_workflows and workflow_runs
                else "partial"
                if enabled_workflows
                else "blocked",
                "workflows",
                {
                    "enabled_workflow_count": len(enabled_workflows),
                    "workflow_run_count": len(workflow_runs),
                },
            ),
            self._readiness_item(
                "audit",
                "ready"
                if self._audit_logger.enabled and audit_events
                else "partial"
                if self._audit_logger.enabled
                else "blocked",
                "audit",
                {
                    "enabled": self._audit_logger.enabled,
                    "event_count": len(audit_events),
                },
            ),
        ]
        blocking_count = sum(
            1 for readiness_item in items if readiness_item["status"] == "blocked"
        )
        ready_count = sum(
            1 for readiness_item in items if readiness_item["status"] == "ready"
        )
        if blocking_count:
            status = "blocked"
        elif ready_count == len(items):
            status = "ready"
        else:
            status = "partial"
        primary_action = next(
            (
                {
                    "target": readiness_item["target"],
                    "code": readiness_item["code"],
                }
                for readiness_item in items
                if readiness_item["status"] != "ready"
            ),
            {"target": "audit", "code": "audit"},
        )

        return {
            "status": status,
            "ready_count": ready_count,
            "total_count": len(items),
            "blocking_count": blocking_count,
            "items": items,
            "primary_action": primary_action,
        }

    def ops_tasks(
        self,
        *,
        tenant: str,
        user_id: str,
        identities: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build the platform operator's action queue from live enterprise state."""
        tasks: list[dict[str, Any]] = []

        def add_task(
            *,
            code: str,
            severity: str,
            title: str,
            description: str,
            target: str,
            count: int = 1,
            evidence: dict[str, Any] | None = None,
            action: dict[str, Any] | None = None,
        ) -> None:
            tasks.append(
                {
                    "task_id": f"{tenant}:{user_id}:{code}",
                    "code": code,
                    "severity": severity,
                    "status": "open",
                    "title": title,
                    "description": description,
                    "target": target,
                    "count": count,
                    "evidence": evidence or {},
                    "action": action,
                },
            )

        pending_approvals = self._list_approval_records(
            limit=100,
            status="pending",
            tenant=tenant,
            user_id=user_id,
        )
        if pending_approvals:
            add_task(
                code="pending_approvals",
                severity="warning",
                title="处理待审批请求",
                description="有工具或工作流调用正在等待租户审批，处理后才能继续执行业务流程。",
                target="approvals",
                count=len(pending_approvals),
                evidence={
                    "approval_ids": [
                        approval.get("approval_id") for approval in pending_approvals[:5]
                    ],
                    "request_types": sorted(
                        {
                            str(approval.get("request_type"))
                            for approval in pending_approvals
                            if approval.get("request_type")
                        },
                    ),
                },
            )

        workflow_runs = self._load_workflow_runs(limit=100, tenant=tenant, user_id=user_id)
        failed_workflow_runs = [
            run for run in workflow_runs if str(run.get("status")) == "failed"
        ]
        if failed_workflow_runs:
            add_task(
                code="failed_workflows",
                severity="error",
                title="排查失败工作流",
                description="最近有自动化流程执行失败，需要检查输入、工具权限或外部系统响应。",
                target="workflows",
                count=len(failed_workflow_runs),
                evidence={
                    "run_ids": [run.get("run_id") for run in failed_workflow_runs[:5]],
                    "workflow_types": sorted(
                        {
                            str(run.get("workflow_type"))
                            for run in failed_workflow_runs
                            if run.get("workflow_type")
                        },
                    ),
                },
            )

        workflow_templates = self._load_workflow_templates()
        disabled_workflows = [
            workflow
            for workflow in workflow_templates
            if workflow.get("enabled") is False
        ]
        if disabled_workflows:
            add_task(
                code="disabled_workflows",
                severity="info",
                title="确认禁用的工作流",
                description="有工作流模板处于禁用状态，如果它属于上线范围，需要启用后再验证。",
                target="workflows",
                count=len(disabled_workflows),
                evidence={
                    "workflow_types": [
                        workflow.get("workflow_type")
                        for workflow in disabled_workflows
                    ],
                },
                action={
                    "type": "resolve",
                    "label": "启用工作流",
                    "method": "POST",
                    "endpoint": "/enterprise/platform/ops/tasks/disabled_workflows/resolve",
                },
            )

        active_agents = [
            agent
            for agent in self._load_agents()
            if agent.get("status") == "published"
            and str(agent.get("tenant") or tenant) == tenant
        ]
        unready_agents = []
        for agent in active_agents:
            readiness = self._agent_readiness(agent)
            if readiness.get("status") != "ready":
                unready_agents.append(
                    {
                        "id": agent.get("id"),
                        "name": agent.get("name"),
                        "status": readiness.get("status"),
                        "issues": readiness.get("issues") or [],
                    },
                )
        if unready_agents:
            blocking_count = sum(
                1 for agent in unready_agents if agent.get("status") == "blocked"
            )
            add_task(
                code="unready_agents",
                severity="error" if blocking_count else "warning",
                title="补齐未就绪 Agent 配置",
                description="已发布 Agent 还有模型、工具、记忆、工作流或访问控制配置未补齐。",
                target="agents",
                count=len(unready_agents),
                evidence={"agents": unready_agents[:5]},
            )

        launch_readiness = self.launch_readiness(
            tenant=tenant,
            user_id=user_id,
            identities=identities,
        )
        launch_items = [
            item
            for item in launch_readiness.get("items", [])
            if item.get("status") != "ready"
        ]
        if launch_items:
            add_task(
                code="launch_readiness",
                severity="error"
                if any(item.get("status") == "blocked" for item in launch_items)
                else "warning",
                title="完成平台上线检查",
                description="模型、Agent、知识库、工具、连接器、权限、工作流或审计仍有未完成项。",
                target=str(
                    (launch_readiness.get("primary_action") or {}).get("target")
                    or "audit"
                ),
                count=len(launch_items),
                evidence={
                    "status": launch_readiness.get("status"),
                    "items": launch_items,
                },
            )

        decisions = self._tool_policy.describe_for_user(
            tenant,
            user_id,
            self._enterprise_tool_names,
        )
        denied_decisions = [
            decision for decision in decisions if decision.get("allowed") is False
        ]
        if denied_decisions:
            add_task(
                code="tool_policy_denials",
                severity="warning",
                title="复核工具权限策略",
                description="当前身份有工具被策略拒绝，可能影响 Agent 或工作流的完整执行。",
                target="governance",
                count=len(denied_decisions),
                evidence={
                    "tools": [
                        {
                            "name": decision.get("name"),
                            "reason": decision.get("reason"),
                        }
                        for decision in denied_decisions[:8]
                    ],
                },
            )

        summary = {
            "total_count": len(tasks),
            "error_count": sum(1 for task in tasks if task["severity"] == "error"),
            "warning_count": sum(1 for task in tasks if task["severity"] == "warning"),
            "info_count": sum(1 for task in tasks if task["severity"] == "info"),
            "open_count": sum(1 for task in tasks if task["status"] == "open"),
        }
        severity_order = {"error": 0, "warning": 1, "info": 2}
        tasks.sort(key=lambda task: (severity_order.get(task["severity"], 3), task["code"]))
        return {"tasks": tasks, "summary": summary}

    def resolve_ops_task_context(
        self,
        *,
        task_code: str,
        actor: str | None,
        user_id: str | None,
    ) -> dict[str, str]:
        """Normalize the request context for auto-resolving operator tasks."""
        normalized_code = task_code.strip()
        if normalized_code not in self.AUTO_RESOLVABLE_OPS_TASKS:
            raise ValueError(
                f"Operations task cannot be auto-resolved: {normalized_code}",
            )
        return {
            "task_code": normalized_code,
            "actor": str(actor or "platform-admin").strip() or "platform-admin",
            "user_id": str(user_id or "acme:alice").strip() or "acme:alice",
        }

    def resolved_disabled_workflows_payload(
        self,
        *,
        task_code: str,
        enabled_workflows: list[dict[str, Any]],
        workflows: list[dict[str, Any]],
        tenant: str,
        user_id: str,
        identities: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build the console response after auto-resolving disabled workflows."""
        return {
            "task_code": task_code,
            "resolved": bool(enabled_workflows),
            "message": "Disabled workflows have been enabled."
            if enabled_workflows
            else "No disabled workflows were found.",
            "enabled_workflows": enabled_workflows,
            "workflows": workflows,
            "ops_tasks": self.ops_tasks(
                tenant=tenant,
                user_id=user_id,
                identities=identities,
            ),
        }

    def _governed_workflows(
        self,
        workflow_templates: list[dict[str, Any]],
        workflow_pending_approvals: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        governed_workflows = []
        for workflow in workflow_templates:
            workflow_type = str(workflow.get("workflow_type") or "")
            steps = workflow.get("steps")
            approval_tools = (
                sorted(
                    {
                        str(step.get("tool_name"))
                        for step in steps
                        if isinstance(step, dict)
                        and step.get("tool_name") in self._approval_required_tools
                    },
                )
                if isinstance(steps, list)
                else []
            )
            if (
                workflow_type not in self._approval_required_workflows
                and not approval_tools
            ):
                continue
            governed_workflows.append(
                {
                    "workflow_type": workflow_type,
                    "name": workflow.get("name") or workflow_type,
                    "enabled": workflow.get("enabled") is not False,
                    "requires_workflow_approval": workflow_type
                    in self._approval_required_workflows,
                    "approval_required_tools": approval_tools,
                    "pending_approval_count": sum(
                        1
                        for approval in workflow_pending_approvals
                        if approval.get("workflow_type") == workflow_type
                    ),
                },
            )
        return governed_workflows

    def _risk_tools(self, *, tenant: str, user_id: str) -> list[dict[str, Any]]:
        decisions = {
            decision["name"]: decision
            for decision in self._tool_policy.describe_for_user(
                tenant,
                user_id,
                self._enterprise_tool_names,
            )
        }
        risk_tools = []
        for tool_name in self._enterprise_tool_names:
            if tool_name != "enterprise_summarize_department_metrics" and (
                "summarize" not in tool_name
            ):
                continue
            catalog = self._enterprise_tool_catalog[tool_name]
            decision = decisions.get(tool_name, {})
            risk_tools.append(
                {
                    "name": tool_name,
                    "description": catalog["description"],
                    "allowed": bool(decision.get("allowed")),
                    "reason": decision.get("reason", ""),
                },
            )
        return risk_tools

    @staticmethod
    def _dashboard_todos(
        pending_approvals: list[dict[str, Any]],
        recent_audit_events: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        todos = []
        if pending_approvals:
            todos.append(
                {
                    "code": "pending_approvals",
                    "severity": "warning",
                    "count": len(pending_approvals),
                },
            )
        if any(event.get("success") is False for event in recent_audit_events):
            todos.append(
                {
                    "code": "recent_tool_failures",
                    "severity": "error",
                    "count": sum(
                        1
                        for event in recent_audit_events
                        if event.get("success") is False
                    ),
                },
            )
        return todos

    @staticmethod
    def _recommended_actions(
        *,
        pending_approvals: list[dict[str, Any]],
        workflow_status_counts: dict[str, int],
        disabled_workflows: list[dict[str, Any]],
        workflow_runs: list[dict[str, Any]],
        enabled_workflows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        operational_actions = []
        if pending_approvals:
            operational_actions.append(
                {
                    "code": "review_pending_approvals",
                    "severity": "warning",
                    "count": len(pending_approvals),
                    "target": "approvals",
                },
            )
        if workflow_status_counts.get("failed", 0):
            operational_actions.append(
                {
                    "code": "investigate_failed_workflows",
                    "severity": "error",
                    "count": workflow_status_counts["failed"],
                    "target": "workflows",
                },
            )
        if disabled_workflows:
            operational_actions.append(
                {
                    "code": "enable_disabled_workflows",
                    "severity": "info",
                    "count": len(disabled_workflows),
                    "target": "workflows",
                },
            )
        if not workflow_runs and enabled_workflows:
            operational_actions.append(
                {
                    "code": "run_first_workflow",
                    "severity": "info",
                    "count": len(enabled_workflows),
                    "target": "workflows",
                },
            )
        if not operational_actions:
            operational_actions.append(
                {
                    "code": "operations_ready",
                    "severity": "info",
                    "target": "audit",
                },
            )
        return operational_actions

    @staticmethod
    def _readiness_item(
        code: str,
        status: str,
        target: str,
        evidence: dict[str, Any],
    ) -> dict[str, Any]:
        severity = {
            "ready": "info",
            "partial": "warning",
            "blocked": "error",
        }.get(status, "warning")
        return {
            "code": code,
            "status": status,
            "severity": severity,
            "target": target,
            "evidence": evidence,
        }
