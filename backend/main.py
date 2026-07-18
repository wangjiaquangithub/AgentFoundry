# -*- coding: utf-8 -*-
"""Enterprise knowledge assistant service example.

This example turns AgentScope's app service into an enterprise-style
assistant backend with tenant-aware tools, long-term memory, RAG endpoints,
and custom sub-agent templates.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Any, Iterable
from uuid import uuid4

import httpx
import uvicorn
from fastapi import HTTPException, Request
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agentscope.app import SubAgentTemplate, create_app
from agentscope.app.message_bus import InMemoryMessageBus, RedisMessageBus
from agentscope.app.rag.blob_store import LocalBlobStore
from agentscope.app.rag.knowledge_base_manager import CollectionPerKbManager
from agentscope.app.storage import RedisStorage
from agentscope.app.workspace_manager import LocalWorkspaceManager
from agentscope.middleware import AgenticMemoryMiddleware
from agentscope.permission import (
    PermissionBehavior,
    PermissionContext,
    PermissionDecision,
    PermissionMode,
)
from agentscope.rag import QdrantStore
from agentscope.tool import FunctionTool, ToolBase

from audit import ToolAuditLogger
from connectors import (
    EnterpriseConnector,
    HttpEnterpriseConnector,
    build_enterprise_connector,
)
from permissions import (
    DEFAULT_TOOL_POLICY,
    ENTERPRISE_TOOL_NAMES,
    ToolAuthorizationPolicy,
)


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PLATFORM_AGENTS_PATH = DATA_DIR / "platform_agents.json"
PLATFORM_CONNECTOR_CONFIGS_PATH = DATA_DIR / "platform_connector_configs.json"
PLATFORM_WORKFLOW_TEMPLATES_PATH = DATA_DIR / "platform_workflow_templates.json"
PLATFORM_WORKFLOW_RUNS_PATH = DATA_DIR / "platform_workflow_runs.jsonl"
PLATFORM_AGENT_RUNS_PATH = DATA_DIR / "platform_agent_runs.jsonl"
PLATFORM_APPROVAL_REQUESTS_PATH = DATA_DIR / "platform_approval_requests.jsonl"
PLATFORM_TOOL_POLICY_PATH = DATA_DIR / "platform_tool_policy.json"
PLATFORM_MEMBERS_PATH = DATA_DIR / "platform_members.json"
PLATFORM_MEMORY_DIR = DATA_DIR / "platform_memory"
PLATFORM_VERSION = "0.1.0"
ROUTING_SOURCE_MODEL = "model"
ROUTING_SOURCE_RULES = "rules"
PLATFORM_MEMORY_MAX_RECORDS = 200
PLATFORM_MEMORY_SEARCH_LIMIT = 4
APPROVAL_REQUIRED_TOOLS = {"enterprise_summarize_department_metrics"}
APPROVAL_REQUIRED_WORKFLOWS = {"policy_review"}
ENTERPRISE_TOOL_INPUT_FIELDS = {
    "enterprise_lookup_policy": "keyword",
    "enterprise_get_ticket_status": "ticket_id",
    "enterprise_summarize_department_metrics": "department",
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
}


def _load_local_env() -> None:
    """Load example-local .env values before building service components."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    try:
        from dotenv import load_dotenv
    except ModuleNotFoundError:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        return

    load_dotenv(env_path, override=False)


_load_local_env()
DATA_DIR.mkdir(parents=True, exist_ok=True)
enterprise_connector = build_enterprise_connector()
tool_audit_logger = ToolAuditLogger.from_env(
    DATA_DIR / "audit" / "tool_calls.jsonl",
)


def _default_tool_policy_copy() -> dict[str, Any]:
    return json.loads(json.dumps(DEFAULT_TOOL_POLICY))


def _platform_tool_policy_path() -> Path:
    env_policy_path = os.getenv("ENTERPRISE_TOOL_POLICY_PATH")
    if env_policy_path:
        return Path(env_policy_path).expanduser()
    return PLATFORM_TOOL_POLICY_PATH


def _load_platform_tool_policy_config() -> dict[str, Any]:
    policy_path = _platform_tool_policy_path()
    if policy_path.exists():
        value = json.loads(policy_path.read_text(encoding="utf-8"))
    else:
        value = _default_tool_policy_copy()

    if not isinstance(value, dict):
        raise ValueError("Enterprise tool policy JSON must be an object.")
    return value


def _save_platform_tool_policy_config(policy: dict[str, Any]) -> None:
    policy_path = _platform_tool_policy_path()
    policy_path.parent.mkdir(parents=True, exist_ok=True)
    policy_path.write_text(
        json.dumps(policy, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _build_tool_authorization_policy() -> ToolAuthorizationPolicy:
    mode = os.getenv("ENTERPRISE_TOOL_POLICY_MODE", "permissive").strip().lower()
    return ToolAuthorizationPolicy(
        _load_platform_tool_policy_config(),
        mode=mode,  # type: ignore[arg-type]
    )


tool_authorization_policy = _build_tool_authorization_policy()


def _safe_path_part(value: str) -> str:
    """Turn an external id into a filesystem-safe path segment."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "unknown"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


def _tool_audit_stats(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize audit events for a tool center card."""
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


def _audit_query_summary(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize filtered audit events for the platform audit view."""
    stats = _tool_audit_stats(events)
    return {
        "total_returned": stats["calls"],
        "successes": stats["successes"],
        "failures": stats["failures"],
        "avg_duration_ms": stats["avg_duration_ms"],
        "unique_users": len(
            {event.get("user_id") for event in events if event.get("user_id")}
        ),
        "unique_agents": len(
            {event.get("agent_id") for event in events if event.get("agent_id")}
        ),
        "unique_tools": len(
            {event.get("tool_name") for event in events if event.get("tool_name")}
        ),
    }


def _enterprise_platform_dashboard(
    *,
    tenant: str,
    user_id: str,
) -> dict[str, Any]:
    """Build a compact platform operations snapshot for the console."""
    pending_approvals = _load_platform_approval_requests(
        limit=3,
        status="pending",
        tenant=tenant,
        user_id=user_id,
    )
    approved_approvals = _load_platform_approval_requests(
        limit=100,
        status="approved",
        tenant=tenant,
        user_id=user_id,
    )
    recent_workflow_runs = _load_workflow_runs(
        limit=3,
        tenant=tenant,
        user_id=user_id,
    )
    workflow_runs = _load_workflow_runs(
        limit=100,
        tenant=tenant,
        user_id=user_id,
    )
    workflow_templates = _load_platform_workflow_templates()
    enabled_workflows = [
        workflow for workflow in workflow_templates if workflow.get("enabled") is not False
    ]
    disabled_workflows = [
        workflow for workflow in workflow_templates if workflow.get("enabled") is False
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
    governed_workflows = []
    for workflow in workflow_templates:
        workflow_type = str(workflow.get("workflow_type") or "")
        steps = workflow.get("steps")
        approval_tools = sorted(
            {
                str(step.get("tool_name"))
                for step in steps
                if isinstance(step, dict)
                and step.get("tool_name") in APPROVAL_REQUIRED_TOOLS
            },
        ) if isinstance(steps, list) else []
        if workflow_type not in APPROVAL_REQUIRED_WORKFLOWS and not approval_tools:
            continue
        governed_workflows.append(
            {
                "workflow_type": workflow_type,
                "name": workflow.get("name") or workflow_type,
                "enabled": workflow.get("enabled") is not False,
                "requires_workflow_approval": workflow_type in APPROVAL_REQUIRED_WORKFLOWS,
                "approval_required_tools": approval_tools,
                "pending_approval_count": sum(
                    1
                    for approval in workflow_pending_approvals
                    if approval.get("workflow_type") == workflow_type
                ),
            },
        )
    recent_audit_events = tool_audit_logger.query(
        tenant=tenant,
        user_id=user_id,
        limit=4,
    )
    audit_events = tool_audit_logger.query(
        tenant=tenant,
        user_id=user_id,
        limit=100,
    )
    decisions = {
        decision["name"]: decision
        for decision in tool_authorization_policy.describe_for_user(
            tenant,
            user_id,
            ENTERPRISE_TOOL_NAMES,
        )
    }
    risk_tools = []
    for tool_name in ENTERPRISE_TOOL_NAMES:
        if (
            tool_name != "enterprise_summarize_department_metrics"
            and "summarize" not in tool_name
        ):
            continue
        catalog = ENTERPRISE_TOOL_CATALOG[tool_name]
        decision = decisions.get(tool_name, {})
        risk_tools.append(
            {
                "name": tool_name,
                "description": catalog["description"],
                "allowed": bool(decision.get("allowed")),
                "reason": decision.get("reason", ""),
            },
        )

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
                    1 for event in recent_audit_events if event.get("success") is False
                ),
            },
        )

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


def _enterprise_platform_launch_readiness(
    *,
    tenant: str,
    user_id: str,
    identities: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build an authoritative launch checklist for the enterprise console."""
    agents = _load_platform_agents()
    active_agents = [
        agent
        for agent in agents
        if agent.get("status") == "published"
        and str(agent.get("tenant") or tenant) == tenant
    ]
    agent_readiness = [_platform_agent_readiness(agent) for agent in active_agents]
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
            _load_platform_memories(
                tenant=tenant,
                user_id=user_id,
                agent_id=str(agent.get("id", "")),
            ),
        )
        for agent in memory_enabled_agents
        if agent.get("id")
    )
    memory_hit_count = sum(
        int((run.get("evidence") or {}).get("memory_hit_count") or 0)
        for run in _load_platform_agent_runs(
            limit=100,
            tenant=tenant,
            user_id=user_id,
        )
        if run.get("agent_id")
        in {agent.get("id") for agent in memory_enabled_agents}
    )
    workflow_templates = _load_platform_workflow_templates()
    enabled_workflows = [
        workflow for workflow in workflow_templates if workflow.get("enabled") is not False
    ]
    workflow_runs = _load_workflow_runs(
        limit=100,
        tenant=tenant,
        user_id=user_id,
    )
    audit_events = tool_audit_logger.query(
        tenant=tenant,
        user_id=user_id,
        limit=100,
    )
    connector = _enterprise_connector_health()
    decisions = tool_authorization_policy.describe_for_user(
        tenant,
        user_id,
        ENTERPRISE_TOOL_NAMES,
    )
    tenant_identities = [
        identity for identity in identities if identity.get("tenant") == tenant
    ]

    def item(
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

    items = [
        item(
            "model",
            "ready" if agents_with_models else "blocked",
            "credentials",
            {
                "configured_agent_count": len(agents_with_models),
                "published_agent_count": len(active_agents),
            },
        ),
        item(
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
        item(
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
        item(
            "tools",
            "ready"
            if agents_with_tools
            else "partial"
            if ENTERPRISE_TOOL_NAMES
            else "blocked",
            "tools",
            {
                "catalog_tool_count": len(ENTERPRISE_TOOL_NAMES),
                "agent_tool_count": sum(
                    len(agent.get("tools") or []) for agent in active_agents
                ),
                "configured_agent_count": len(agents_with_tools),
            },
        ),
        item(
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
        item(
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
        item(
            "governance",
            "ready"
            if tenant_identities and decisions
            else "partial"
            if identities or decisions
            else "blocked",
            "governance",
            {
                "identity_count": len(tenant_identities),
                "tool_policy_mode": tool_authorization_policy.mode,
                "decision_count": len(decisions),
            },
        ),
        item(
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
        item(
            "audit",
            "ready"
            if tool_audit_logger.enabled and audit_events
            else "partial"
            if tool_audit_logger.enabled
            else "blocked",
            "audit",
            {
                "enabled": tool_audit_logger.enabled,
                "event_count": len(audit_events),
            },
        ),
    ]
    blocking_count = sum(1 for readiness_item in items if readiness_item["status"] == "blocked")
    ready_count = sum(1 for readiness_item in items if readiness_item["status"] == "ready")
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


def _enterprise_platform_ops_tasks(
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

    pending_approvals = _load_platform_approval_requests(
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

    workflow_runs = _load_workflow_runs(limit=100, tenant=tenant, user_id=user_id)
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

    workflow_templates = _load_platform_workflow_templates()
    disabled_workflows = [
        workflow for workflow in workflow_templates if workflow.get("enabled") is False
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
                    workflow.get("workflow_type") for workflow in disabled_workflows
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
        for agent in _load_platform_agents()
        if agent.get("status") == "published"
        and str(agent.get("tenant") or tenant) == tenant
    ]
    unready_agents = []
    for agent in active_agents:
        readiness = _platform_agent_readiness(agent)
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

    launch_readiness = _enterprise_platform_launch_readiness(
        tenant=tenant,
        user_id=user_id,
        identities=identities,
    )
    launch_items = [
        item for item in launch_readiness.get("items", []) if item.get("status") != "ready"
    ]
    if launch_items:
        add_task(
            code="launch_readiness",
            severity="error"
            if any(item.get("status") == "blocked" for item in launch_items)
            else "warning",
            title="完成平台上线检查",
            description="模型、Agent、知识库、工具、连接器、权限、工作流或审计仍有未完成项。",
            target=str((launch_readiness.get("primary_action") or {}).get("target") or "audit"),
            count=len(launch_items),
            evidence={
                "status": launch_readiness.get("status"),
                "items": launch_items,
            },
        )

    decisions = tool_authorization_policy.describe_for_user(
        tenant,
        user_id,
        ENTERPRISE_TOOL_NAMES,
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


class EnterpriseToolRunRequest(BaseModel):
    """Direct enterprise tool invocation payload from the platform console."""

    tool_name: str = Field(min_length=1)
    inputs: dict[str, Any] = Field(default_factory=dict)
    user_id: str | None = None
    agent_id: str | None = None
    approval_id: str | None = None


class EnterpriseToolPolicyUpdateRequest(BaseModel):
    """Update one tenant user's enterprise tool authorization policy."""

    tenant: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    allow: list[str] | None = None
    deny: list[str] | None = None


class EnterprisePlatformConfigImportRequest(BaseModel):
    """Import portable enterprise platform configuration."""

    config: dict[str, Any] = Field(default_factory=dict)
    mode: str = "merge"


class EnterprisePlatformMemberUpsertRequest(BaseModel):
    """Create or update a tenant member visible to the enterprise platform."""

    user_id: str = Field(min_length=1)
    tenant: str = Field(default="acme", min_length=1)
    display_name: str | None = None
    role: str = Field(default="Enterprise user", min_length=1)
    status: str = "active"


class EnterprisePlatformMemberPatchRequest(BaseModel):
    """Patch editable tenant member fields from the platform console."""

    tenant: str | None = Field(default=None, min_length=1)
    display_name: str | None = None
    role: str | None = Field(default=None, min_length=1)
    status: str | None = None


class EnterpriseAgentRunRequest(BaseModel):
    """Natural-language enterprise agent test run payload."""

    question: str = Field(min_length=1)
    agent_id: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    approval_id: str | None = None


class EnterpriseWorkflowRunRequest(BaseModel):
    """Run a predefined enterprise automation workflow from the platform."""

    workflow_type: str = Field(min_length=1)
    inputs: dict[str, Any] = Field(default_factory=dict)
    agent_id: str | None = None
    user_id: str | None = None
    approval_id: str | None = None


class EnterpriseApprovalCreateRequest(BaseModel):
    """Create a governance approval request for a platform action."""

    request_type: str = Field(min_length=1)
    tool_name: str | None = None
    workflow_type: str | None = None
    inputs: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None
    agent_id: str | None = None
    user_id: str | None = None


class EnterpriseApprovalDecisionRequest(BaseModel):
    """Approve or reject a pending platform governance request."""

    decision_note: str | None = None
    decided_by: str | None = None


class EnterpriseWorkflowTemplateUpdateRequest(BaseModel):
    """Update a tenant-visible enterprise workflow template."""

    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    default_inputs: dict[str, Any] | None = None


class EnterpriseAgentPublishRequest(BaseModel):
    """Publish a business agent template as a tenant-scoped platform agent."""

    template_id: str = Field(min_length=1)
    name: str | None = None
    description: str | None = None
    tenant: str | None = None
    tools: list[str] | None = None
    knowledge_base_ids: list[str] | None = None
    model_config_id: str | None = None
    memory_enabled: bool = True
    workflow_enabled: bool = False
    allowed_user_ids: list[str] | None = None
    allowed_roles: list[str] | None = None


class EnterpriseAgentUpdateRequest(BaseModel):
    """Update a published platform agent instance."""

    name: str | None = None
    description: str | None = None
    tenant: str | None = None
    tools: list[str] | None = None
    knowledge_base_ids: list[str] | None = None
    model_config_id: str | None = None
    memory_enabled: bool | None = None
    workflow_enabled: bool | None = None
    allowed_user_ids: list[str] | None = None
    allowed_roles: list[str] | None = None
    status: str | None = None


class EnterpriseConnectorTestRequest(BaseModel):
    """Ad-hoc HTTP connector validation payload from the platform console."""

    base_url: str = Field(min_length=1)
    token: str | None = None
    tenant: str = "acme"
    policy_keyword: str = "remote"
    ticket_id: str = "INC-1001"
    department: str = "engineering"
    policy_path: str = HttpEnterpriseConnector.policy_path
    ticket_path: str = HttpEnterpriseConnector.ticket_path
    metrics_path: str = HttpEnterpriseConnector.metrics_path
    timeout_seconds: float = Field(default=5.0, gt=0)


class EnterpriseConnectorConfigSaveRequest(BaseModel):
    """Persist a tenant-scoped enterprise HTTP connector configuration."""

    base_url: str = Field(min_length=1)
    token: str | None = None
    tenant: str = "acme"
    policy_path: str = HttpEnterpriseConnector.policy_path
    ticket_path: str = HttpEnterpriseConnector.ticket_path
    metrics_path: str = HttpEnterpriseConnector.metrics_path
    timeout_seconds: float = Field(default=5.0, gt=0)
    enabled: bool = True


class EnterpriseRouterError(RuntimeError):
    """Raised when the optional model router cannot produce a valid route."""


def _tool_decision_payload(tool_name: str, decision: Any) -> dict[str, Any]:
    return {
        "name": tool_name,
        "allowed": decision.allowed,
        "reason": decision.reason,
    }


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


async def build_enterprise_tools(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[ToolBase]:
    """Create tenant-aware business tools for one agent invocation."""
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    runtime_connector = runtime["connector"]
    connector_label = str(runtime["connector_label"])

    def audit_tool_call(
        tool_name: str,
        inputs: dict[str, Any],
        call: Any,
    ) -> dict[str, Any]:
        return tool_audit_logger.capture(
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
            authorization_policy=tool_authorization_policy,
        ),
        ReadOnlyEnterpriseTool(
            get_ticket_status,
            name="enterprise_get_ticket_status",
            description="Read a tenant-scoped IT, finance, or support ticket.",
            is_read_only=True,
            tenant=tenant,
            user_id=user_id,
            authorization_policy=tool_authorization_policy,
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
            authorization_policy=tool_authorization_policy,
        ),
    ]


async def build_enterprise_middlewares(
    user_id: str,
    agent_id: str,
    session_id: str,
) -> list[AgenticMemoryMiddleware]:
    """Attach session-isolated long-term memory to every agent run."""
    memory_workdir = (
        DATA_DIR
        / "memory"
        / _safe_path_part(user_id)
        / _safe_path_part(agent_id)
        / _safe_path_part(session_id)
    )
    return [
        AgenticMemoryMiddleware(
            workdir=str(memory_workdir),
            memory_dir="Memory",
        ),
    ]


def _build_storage() -> RedisStorage:
    """Build the app storage backend."""
    return RedisStorage(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        password=os.getenv("REDIS_PASSWORD"),
    )


def _build_message_bus() -> InMemoryMessageBus | RedisMessageBus:
    """Use in-memory bus by default and Redis bus when requested."""
    if os.getenv("AGENTSCOPE_REDIS_BUS") != "1":
        return InMemoryMessageBus()

    return RedisMessageBus(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        password=os.getenv("REDIS_PASSWORD"),
    )


def _build_vector_store() -> QdrantStore:
    """Build a local or remote Qdrant vector store."""
    qdrant_url = os.getenv("QDRANT_URL")
    if qdrant_url:
        return QdrantStore(
            url=qdrant_url,
            api_key=os.getenv("QDRANT_API_KEY"),
        )
    return QdrantStore(path=str(DATA_DIR / "qdrant"))


storage = _build_storage()

ENTERPRISE_SUBAGENT_TEMPLATES = [
    SubAgentTemplate(
        type="policy_researcher",
        description=(
            "A read-only enterprise researcher for policy, knowledge-base, "
            "and ticket investigation."
        ),
        system_prompt_template="""You are {member_name}, an enterprise \
policy researcher in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Work only from the tenant-scoped tools, attached knowledge bases, and readable \
workspace files. Cite which source or tool result supports each conclusion. \
Do not modify files or external systems. Report your findings back to \
{leader_name} with TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.EXPLORE,
        ),
        override_leader_mode=True,
    ),
    SubAgentTemplate(
        type="workflow_operator",
        description=(
            "A controlled worker for drafting workflow steps, runbooks, "
            "and automation plans inside the approved workspace."
        ),
        system_prompt_template="""You are {member_name}, a workflow \
operator in team '{team_name}' led by {leader_name}.

Team purpose: {team_description}
Your role: {member_description}

Turn the leader's business goal into concrete operating steps, checklists, or \
draft artifacts. Keep tenant boundaries strict. Use tools only when their \
scope is clear, and report every material action back to {leader_name} with \
TeamSay.""",
        permission_context=PermissionContext(
            mode=PermissionMode.ACCEPT_EDITS,
        ),
    ),
]

ENTERPRISE_AGENT_TEMPLATES = [
    {
        "id": "enterprise_knowledge_assistant",
        "name": "企业知识助手",
        "description": "面向员工问答、制度查询、工单状态和部门指标的业务助手。",
        "tools": ENTERPRISE_TOOL_NAMES,
        "capabilities": [
            "knowledge_qa",
            "ticket_lookup",
            "policy_lookup",
            "metrics_summary",
        ],
    },
    {
        "id": "customer_support_assistant",
        "name": "智能客服助手",
        "description": "处理客户请求、查询工单和沉淀服务审计记录。",
        "tools": [
            "enterprise_get_ticket_status",
            "enterprise_lookup_policy",
        ],
        "capabilities": [
            "ticket_lookup",
            "policy_lookup",
            "customer_reply",
        ],
    },
    {
        "id": "data_analysis_assistant",
        "name": "数据分析助手",
        "description": "查询部门指标并生成可审计的分析摘要。",
        "tools": ["enterprise_summarize_department_metrics"],
        "capabilities": [
            "metrics_summary",
            "analysis_report",
        ],
    },
]


def _permission_mode_label(template: SubAgentTemplate) -> str:
    mode = template.permission_context.mode
    return getattr(mode, "value", str(mode))


def _enterprise_subagent_template_metadata() -> list[dict[str, Any]]:
    return [
        {
            "type": template.type,
            "description": template.description,
            "permission_mode": _permission_mode_label(template),
            "override_leader_mode": template.override_leader_mode,
        }
        for template in ENTERPRISE_SUBAGENT_TEMPLATES
    ]


def _load_platform_agents() -> list[dict[str, Any]]:
    if not PLATFORM_AGENTS_PATH.exists():
        return []

    try:
        agents = json.loads(PLATFORM_AGENTS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail="Platform agent registry is not valid JSON.",
        ) from exc

    if not isinstance(agents, list):
        raise HTTPException(
            status_code=500,
            detail="Platform agent registry must be a JSON array.",
        )

    return agents


def _get_platform_agent(agent_id: str) -> dict[str, Any]:
    for agent in _load_platform_agents():
        if str(agent.get("id", "")) == agent_id:
            return agent

    raise HTTPException(
        status_code=404,
        detail=f"Unknown platform agent: {agent_id}",
    )


def _get_platform_agent_template(template_id: str) -> dict[str, Any]:
    template = next(
        (
            item
            for item in ENTERPRISE_AGENT_TEMPLATES
            if item["id"] == template_id
        ),
        None,
    )
    if template is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown platform agent template: {template_id}",
        )

    return template


def _validate_platform_agent_tools(
    template: dict[str, Any],
    selected_tools: list[str],
) -> None:
    template_tools = list(template["tools"])
    unsupported_tools = [
        tool_name for tool_name in selected_tools if tool_name not in template_tools
    ]
    if unsupported_tools:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Requested tools are not allowed by the template.",
                "unsupported_tools": unsupported_tools,
            },
        )


def _normalize_agent_access_values(values: Iterable[Any] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        item = str(value).strip()
        if item and item not in seen:
            normalized.append(item)
            seen.add(item)
    return normalized


def _normalize_platform_resource_ids(values: Iterable[Any] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        item = str(value).strip()
        if item and item not in seen:
            normalized.append(item)
            seen.add(item)
    return normalized


def _platform_agent_access(agent: dict[str, Any]) -> dict[str, list[str]]:
    return {
        "allowed_user_ids": _normalize_agent_access_values(
            agent.get("allowed_user_ids"),
        ),
        "allowed_roles": _normalize_agent_access_values(agent.get("allowed_roles")),
    }


def _load_platform_members_config() -> dict[str, Any]:
    if not PLATFORM_MEMBERS_PATH.exists():
        return {"members": []}
    config = json.loads(PLATFORM_MEMBERS_PATH.read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError("Enterprise platform members JSON must be an object.")
    members = config.get("members")
    if not isinstance(members, list):
        config["members"] = []
    return config


def _save_platform_members_config(config: dict[str, Any]) -> None:
    PLATFORM_MEMBERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLATFORM_MEMBERS_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _normalize_platform_member(
    raw: dict[str, Any],
    *,
    fallback_user_id: str | None = None,
    updated_by: str | None = None,
    now: str | None = None,
) -> dict[str, Any]:
    timestamp = now or _now_iso()
    user_id = str(raw.get("user_id") or fallback_user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="成员 user_id 不能为空。")
    tenant = str(raw.get("tenant") or _tenant_hint_from_user_id(user_id) or "acme").strip()
    role = str(raw.get("role") or "Enterprise user").strip()
    status = str(raw.get("status") or "active").strip().lower()
    if status not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="成员状态只能是 active 或 inactive。")

    return {
        "user_id": user_id,
        "tenant": tenant,
        "display_name": str(raw.get("display_name") or user_id).strip(),
        "role": role,
        "status": status,
        "sample_questions": list(raw.get("sample_questions") or []),
        "created_at": str(raw.get("created_at") or timestamp),
        "updated_at": timestamp,
        "updated_by": str(updated_by or raw.get("updated_by") or user_id),
        "source": "member_registry",
    }


def _platform_member_registry(
    *,
    include_inactive: bool = True,
) -> list[dict[str, Any]]:
    members: list[dict[str, Any]] = []
    for raw in _load_platform_members_config().get("members", []):
        if not isinstance(raw, dict):
            continue
        member = _normalize_platform_member(raw)
        if include_inactive or member["status"] == "active":
            members.append(member)
    members.sort(key=lambda item: (item["tenant"], item["user_id"]))
    return members


def _platform_member_by_user(
    user_id: str,
    *,
    include_inactive: bool = True,
) -> dict[str, Any] | None:
    for member in _platform_member_registry(include_inactive=include_inactive):
        if member["user_id"] == user_id:
            return member
    return None


def _platform_member_roles(members: list[dict[str, Any]]) -> list[str]:
    roles = sorted(
        {
            str(member.get("role") or "").strip()
            for member in members
            if str(member.get("role") or "").strip()
        },
    )
    return roles


def _normalize_platform_agent_tenant(value: Any, user_id: str) -> str:
    tenant = str(value or "").strip() or _runtime_tenant_for_user(user_id)
    if not tenant:
        raise HTTPException(status_code=400, detail="Agent tenant is required.")
    return tenant


def _platform_identities_for_tenant(tenant: str) -> list[dict[str, Any]]:
    return [
        identity
        for identity in _platform_identity_metadata(f"{tenant}:system", tenant)
        if str(identity.get("tenant") or "").strip() == tenant
    ]


def _platform_roles_for_tenant(tenant: str) -> set[str]:
    return {
        str(identity.get("role") or "").strip()
        for identity in _platform_identities_for_tenant(tenant)
        if str(identity.get("role") or "").strip()
    }


def _platform_agent_access_scope_diagnostics(
    tenant: str,
    access: dict[str, list[str]],
) -> dict[str, Any]:
    identities = _platform_identities_for_tenant(tenant)
    identity_by_user_id = {
        str(identity.get("user_id") or "").strip(): identity
        for identity in identities
        if str(identity.get("user_id") or "").strip()
    }
    roles = _platform_roles_for_tenant(tenant)
    tenant_mismatched_user_ids: list[str] = []
    unknown_user_ids: list[str] = []
    inactive_user_ids: list[str] = []

    for user_id in access["allowed_user_ids"]:
        hinted_tenant = _tenant_hint_from_user_id(user_id)
        if hinted_tenant and hinted_tenant != tenant:
            tenant_mismatched_user_ids.append(user_id)
            continue
        identity = identity_by_user_id.get(user_id)
        if identity is None:
            unknown_user_ids.append(user_id)
        elif identity.get("status") != "active":
            inactive_user_ids.append(user_id)

    unknown_roles = [
        role for role in access["allowed_roles"] if role not in roles
    ]
    active_member_count = 0
    inactive_member_count = 0
    for identity in identities:
        user_id = str(identity.get("user_id") or "").strip()
        role = str(identity.get("role") or "").strip()
        if not user_id:
            continue
        matched = user_id in access["allowed_user_ids"] or role in access["allowed_roles"]
        if not matched:
            continue
        if identity.get("status") == "active":
            active_member_count += 1
        else:
            inactive_member_count += 1

    return {
        "tenant": tenant,
        "tenant_mismatched_user_ids": tenant_mismatched_user_ids,
        "unknown_user_ids": unknown_user_ids,
        "inactive_user_ids": inactive_user_ids,
        "unknown_roles": unknown_roles,
        "active_member_count": active_member_count,
        "inactive_member_count": inactive_member_count,
    }


def _validate_platform_agent_access_scope(
    *,
    tenant: str,
    allowed_user_ids: list[str],
    allowed_roles: list[str],
) -> None:
    diagnostics = _platform_agent_access_scope_diagnostics(
        tenant,
        {
            "allowed_user_ids": allowed_user_ids,
            "allowed_roles": allowed_roles,
        },
    )
    if diagnostics["tenant_mismatched_user_ids"] or diagnostics["unknown_roles"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Agent access scope must stay inside the selected tenant.",
                "tenant": tenant,
                "tenant_mismatched_user_ids": diagnostics[
                    "tenant_mismatched_user_ids"
                ],
                "unknown_roles": diagnostics["unknown_roles"],
            },
        )


def _platform_agent_access_summary(agent: dict[str, Any]) -> dict[str, Any]:
    tenant = str(agent.get("tenant") or "").strip()
    access = _platform_agent_access(agent)
    diagnostics = _platform_agent_access_scope_diagnostics(tenant, access)
    return {
        **diagnostics,
        "allowed_user_count": len(access["allowed_user_ids"]),
        "allowed_role_count": len(access["allowed_roles"]),
        "open_to_tenant": not access["allowed_user_ids"] and not access["allowed_roles"],
        "access_scope_valid": not diagnostics["tenant_mismatched_user_ids"]
        and not diagnostics["unknown_roles"],
    }


def _identity_role_for_user(user_id: str) -> str:
    tenant_hint = _tenant_hint_from_user_id(user_id)
    current_tenant = (
        tenant_hint
        or _runtime_tenant_for_user(user_id)
        or _configured_tenant_for_user(user_id)
    )
    for identity in _platform_identity_metadata(user_id, current_tenant):
        if identity.get("user_id") == user_id:
            return str(identity.get("role") or "").strip()
    return ""


def _assert_platform_agent_access(agent: dict[str, Any], user_id: str) -> None:
    agent_tenant = str(agent.get("tenant") or "").strip()
    runtime_tenant = _runtime_tenant_for_user(user_id)
    if agent_tenant and runtime_tenant != agent_tenant:
        raise HTTPException(
            status_code=403,
            detail="当前身份不属于该 Agent 租户，无法运行该 Agent 实例。",
        )

    access = _platform_agent_access(agent)
    allowed_user_ids = access["allowed_user_ids"]
    allowed_roles = access["allowed_roles"]
    member = _platform_member_by_user(user_id, include_inactive=True)
    if member is not None and member.get("status") != "active":
        raise HTTPException(
            status_code=403,
            detail="当前身份已停用，无法运行该 Agent 实例。",
        )
    if not allowed_user_ids and not allowed_roles:
        return
    if user_id in allowed_user_ids:
        return
    role = _identity_role_for_user(user_id)
    if role and role in allowed_roles:
        return
    raise HTTPException(
        status_code=403,
        detail="当前身份无权运行该 Agent 实例。",
    )


def _platform_agent_run_metadata(
    agent: dict[str, Any] | None,
) -> dict[str, Any]:
    if agent is None:
        return {}
    access = _platform_agent_access(agent)

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


def _platform_agent_readiness(agent: dict[str, Any]) -> dict[str, Any]:
    tools = list(agent.get("tools") or [])
    knowledge_base_ids = list(agent.get("knowledge_base_ids") or [])
    tenant = str(agent.get("tenant") or "").strip()
    model_configured = bool(agent.get("model_config_id"))
    memory_enabled = bool(agent.get("memory_enabled", False))
    workflow_enabled = bool(agent.get("workflow_enabled", False))
    access = _platform_agent_access(agent)
    access_summary = _platform_agent_access_summary(agent)
    access_restricted = bool(access["allowed_user_ids"] or access["allowed_roles"])
    approval_required_tools = [
        tool_name for tool_name in tools if tool_name in APPROVAL_REQUIRED_TOOLS
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


def _platform_agent_response(agent: dict[str, Any]) -> dict[str, Any]:
    response = dict(agent)
    response["access_summary"] = _platform_agent_access_summary(agent)
    response["readiness"] = _platform_agent_readiness(agent)
    return response


def _resource_record_id(record: Any) -> str | None:
    if isinstance(record, dict):
        value = record.get("id")
    else:
        value = getattr(record, "id", None)
    if value is None:
        return None
    item = str(value).strip()
    return item or None


async def _validate_platform_agent_resources(
    request: Request,
    user_id: str,
    *,
    model_config_id: str | None,
    knowledge_base_ids: list[str],
) -> None:
    if model_config_id:
        access_service = getattr(request.app.state, "resource_access_service", None)
        storage = getattr(request.app.state, "storage", None)
        credential = None

        if access_service is not None:
            try:
                credential = await access_service.resolve_credential(
                    user_id,
                    model_config_id,
                )
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
        elif storage is not None:
            try:
                credential = await storage.get_credential(user_id, model_config_id)
            except AttributeError:
                credential = None

        if credential is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": (
                        "Unknown model credential configured for platform agent."
                    ),
                    "unknown_model_config_id": model_config_id,
                },
            )

    if not knowledge_base_ids:
        return

    knowledge_base_service = getattr(request.app.state, "knowledge_base_service", None)
    storage = getattr(request.app.state, "storage", None)
    knowledge_bases = []
    if knowledge_base_service is not None:
        knowledge_bases = await knowledge_base_service.list_knowledge_bases(user_id)
    elif storage is not None:
        try:
            knowledge_bases = await storage.list_knowledge_bases(user_id)
        except AttributeError:
            knowledge_bases = []

    visible_ids = {
        record_id
        for record_id in (_resource_record_id(record) for record in knowledge_bases)
        if record_id
    }
    missing_ids = [
        knowledge_base_id
        for knowledge_base_id in knowledge_base_ids
        if knowledge_base_id not in visible_ids
    ]
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Unknown knowledge bases configured for platform agent.",
                "unknown_knowledge_base_ids": missing_ids,
            },
        )


def _agent_tool_denial(tool_name: str) -> dict[str, Any]:
    reason = (
        f"该 Agent 实例未启用工具 {tool_name}，所以本次没有执行。"
        "请在发布配置里启用对应工具，或选择具备该能力的 Agent 实例。"
    )
    return {
        "name": tool_name,
        "allowed": False,
        "reason": reason,
        "denied_by_agent_config": True,
    }


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _chunk_text(chunk: Any) -> str:
    content = getattr(chunk, "content", None)
    if getattr(content, "type", None) == "text":
        return str(getattr(content, "text", "")).strip()

    name = getattr(content, "name", None)
    if name:
        return str(name).strip()

    source = getattr(chunk, "source", None)
    return str(source or "").strip()


def _format_knowledge_hit(
    knowledge_base_id: str,
    hit: Any,
) -> dict[str, Any]:
    chunk = getattr(hit, "chunk", None)
    snippet = _chunk_text(chunk)
    if len(snippet) > 500:
        snippet = f"{snippet[:497]}..."

    metadata = getattr(chunk, "metadata", {}) if chunk is not None else {}
    return {
        "knowledge_base_id": knowledge_base_id,
        "score": float(getattr(hit, "score", 0.0) or 0.0),
        "document_id": str(getattr(hit, "document_id", "")),
        "source": str(getattr(chunk, "source", "") or ""),
        "chunk_index": getattr(chunk, "chunk_index", None),
        "total_chunks": getattr(chunk, "total_chunks", None),
        "snippet": snippet,
        "metadata": _json_safe(metadata or {}),
    }


def _format_knowledge_answer(
    knowledge_hits: list[dict[str, Any]],
) -> str:
    snippets = []
    for index, hit in enumerate(knowledge_hits[:3], start=1):
        source = hit.get("source") or hit.get("document_id") or hit["knowledge_base_id"]
        snippets.append(f"{index}. {source}: {hit.get('snippet', '')}")

    return "我在该 Agent 绑定的知识库中找到这些相关内容：\n" + "\n".join(snippets)


def _truncate_text(value: str, limit: int = 300) -> str:
    text = re.sub(r"\s+", " ", value).strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3]}..."


def _platform_memory_path(
    *,
    tenant: str,
    user_id: str,
    agent_id: str,
) -> Path:
    return (
        PLATFORM_MEMORY_DIR
        / _safe_path_part(tenant)
        / _safe_path_part(user_id)
        / _safe_path_part(agent_id)
        / "memories.jsonl"
    )


def _memory_text_terms(value: str) -> set[str]:
    normalized = value.lower()
    terms = set(re.findall(r"[a-z0-9][a-z0-9._-]{1,}", normalized))
    for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", value.upper()):
        terms.add(ticket_id.lower())

    chinese_markers = (
        "刚才",
        "之前",
        "上次",
        "关注",
        "记住",
        "工单",
        "部门",
        "指标",
        "政策",
        "制度",
        "远程",
        "报销",
        "安全",
        "工程",
        "研发",
        "客服",
        "销售",
        "相关",
    )
    for marker in chinese_markers:
        if marker in value:
            terms.add(marker)

    return terms


def _question_uses_memory_reference(question: str) -> bool:
    normalized = question.lower()
    english_markers = (
        "remember",
        "previous",
        "earlier",
        "last time",
        "follow up",
    )
    chinese_markers = (
        "刚才",
        "之前",
        "上次",
        "记住",
        "还记得",
        "关注",
        "相关",
        "继续",
        "那个",
        "这个",
    )
    return any(marker in normalized for marker in english_markers) or any(
        marker in question for marker in chinese_markers
    )


def _question_is_memory_lookup(question: str) -> bool:
    normalized = question.lower()
    english_markers = (
        "what did i",
        "what was i",
        "what were we",
        "what did we",
        "do you remember",
    )
    chinese_markers = (
        "我刚才",
        "刚才我",
        "我之前",
        "之前我",
        "我上次",
        "上次我",
        "还记得",
    )
    return any(marker in normalized for marker in english_markers) or any(
        marker in question for marker in chinese_markers
    )


def _dedupe_strings(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = value.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def _extract_tool_memory_facts(
    tool_calls: list[dict[str, Any]],
) -> list[str]:
    facts: list[str] = []
    for call in tool_calls:
        tool_name = str(call.get("tool_name", "")).strip()
        result = call.get("result")
        if not tool_name or not isinstance(result, dict):
            continue

        if tool_name == "enterprise_lookup_policy":
            matches = result.get("matches")
            if isinstance(matches, dict):
                for keyword, policy_text in matches.items():
                    facts.append(
                        "工具结果：制度 "
                        f"{keyword} = {_truncate_text(str(policy_text), 160)}",
                    )
            continue

        if tool_name == "enterprise_get_ticket_status":
            ticket_id = str(result.get("ticket_id", "")).strip()
            ticket = result.get("ticket")
            if isinstance(ticket, dict):
                status = str(ticket.get("status", "")).strip()
                owner = str(ticket.get("owner", "")).strip()
                summary = _truncate_text(str(ticket.get("summary", "")), 120)
                facts.append(
                    "工具结果：工单 "
                    f"{ticket_id} status={status} owner={owner} summary={summary}",
                )
            elif ticket_id:
                facts.append(f"工具结果：工单 {ticket_id} 未找到")
            continue

        if tool_name == "enterprise_summarize_department_metrics":
            department = str(result.get("department", "")).strip()
            metrics = result.get("metrics")
            if isinstance(metrics, dict):
                active_projects = metrics.get("active_projects")
                open_incidents = metrics.get("open_incidents")
                sla = metrics.get("sla")
                facts.append(
                    "工具结果：部门指标 "
                    f"{department} active_projects={active_projects} "
                    f"open_incidents={open_incidents} sla={sla}",
                )

    return facts


def _extract_platform_memory_facts(
    *,
    question: str,
    tool_calls: list[dict[str, Any]],
    knowledge_base_ids: list[str],
) -> list[str]:
    facts: list[str] = []
    normalized = question.lower()

    name_match = re.search(r"(?:我叫|我是)\s*([^，。,.！!\s]{1,32})", question)
    if name_match:
        facts.append(f"用户自称：{name_match.group(1).strip()}")

    for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", question.upper()):
        facts.append(f"用户关注工单：{ticket_id}")

    department_markers = {
        "engineering": ("engineering", "engineering"),
        "工程": ("engineering", "工程"),
        "研发": ("engineering", "研发"),
        "support": ("support", "support"),
        "客服": ("support", "客服"),
        "支持": ("support", "支持"),
        "sales": ("sales", "sales"),
        "销售": ("sales", "销售"),
    }
    for marker, (department, label) in department_markers.items():
        if marker in normalized or marker in question:
            facts.append(f"用户关注部门：{department} ({label})")

    policy_markers = {
        "remote": ("remote", "remote"),
        "远程": ("remote", "远程"),
        "expense": ("expense", "expense"),
        "报销": ("expense", "报销"),
        "security": ("security", "security"),
        "安全": ("security", "安全"),
    }
    for marker, (policy, label) in policy_markers.items():
        if marker in normalized or marker in question:
            facts.append(f"用户关注制度关键词：{policy} ({label})")

    if (
        "关注" in question
        or "记住" in question
        or "remember" in normalized
    ):
        facts.append(f"用户明确要求记住：{_truncate_text(question, 160)}")

    tool_names = _dedupe_strings(
        [
            str(call.get("tool_name", "")).strip()
            for call in tool_calls
            if call.get("tool_name")
        ],
    )
    if tool_names:
        facts.append(f"本轮使用工具：{', '.join(tool_names)}")
        facts.extend(_extract_tool_memory_facts(tool_calls))

    if knowledge_base_ids:
        facts.append(f"本轮使用知识库：{', '.join(knowledge_base_ids)}")

    if not facts:
        facts.append(f"用户问过：{_truncate_text(question, 160)}")

    return _dedupe_strings(facts)


def _load_platform_memories(
    *,
    tenant: str,
    user_id: str,
    agent_id: str,
    limit: int = PLATFORM_MEMORY_MAX_RECORDS,
) -> list[dict[str, Any]]:
    path = _platform_memory_path(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
    )
    if not path.exists():
        return []

    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        try:
            record = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            record = dict(record)
            record.pop("answer", None)
            record["facts"] = [
                str(fact)
                for fact in record.get("facts", [])
                if str(fact).strip()
                and not str(fact).startswith("上次回答摘要：")
            ]
            records.append(record)

    return records[-limit:]


def _format_platform_memory_hit(
    record: dict[str, Any],
    score: float,
) -> dict[str, Any]:
    facts = [
        str(fact)
        for fact in record.get("facts", [])
        if str(fact).strip()
    ]
    snippet = "；".join(facts[:3]) or str(record.get("question", ""))
    return {
        "id": str(record.get("id", "")),
        "created_at": str(record.get("created_at", "")),
        "score": round(score, 3),
        "source": "platform_memory",
        "snippet": _truncate_text(snippet, 500),
        "facts": facts,
        "tool_names": list(record.get("tool_names") or []),
        "knowledge_base_ids": list(record.get("knowledge_base_ids") or []),
    }


def _search_platform_memories(
    *,
    tenant: str,
    user_id: str,
    agent_id: str,
    question: str,
    limit: int = PLATFORM_MEMORY_SEARCH_LIMIT,
) -> list[dict[str, Any]]:
    records = _load_platform_memories(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
    )
    if not records:
        return []

    question_terms = _memory_text_terms(question)
    asks_for_memory = _question_uses_memory_reference(question)
    scored: list[tuple[float, int, dict[str, Any]]] = []
    total = max(len(records), 1)
    for index, record in enumerate(records):
        memory_text = " ".join(
            [
                str(record.get("question", "")),
                " ".join(str(fact) for fact in record.get("facts", [])),
                " ".join(str(term) for term in record.get("keywords", [])),
            ],
        )
        memory_terms = set(record.get("keywords") or [])
        memory_terms.update(_memory_text_terms(memory_text))
        overlap = question_terms & memory_terms
        score = float(len(overlap) * 2)
        if asks_for_memory:
            score += 1.0
        score += ((index + 1) / total) * 0.5

        if score <= 0.5 and not asks_for_memory:
            continue
        scored.append((score, index, record))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [
        _format_platform_memory_hit(record, score)
        for score, _index, record in scored[:limit]
    ]


def _format_memory_answer(memory_hits: list[dict[str, Any]]) -> str:
    snippets = _dedupe_strings(
        [
            str(hit.get("snippet", "")).strip()
            for hit in memory_hits
            if str(hit.get("snippet", "")).strip()
        ],
    )
    lines = [
        f"{index}. {snippet}"
        for index, snippet in enumerate(snippets[:3], start=1)
    ]
    return "我找到这些长期记忆：\n" + "\n".join(lines)


def _format_memory_context(memory_hits: list[dict[str, Any]]) -> str:
    context_lines: list[str] = []
    for hit in memory_hits[:3]:
        facts = [
            str(fact)
            for fact in hit.get("facts", [])
            if str(fact).strip()
        ]
        context_lines.extend(facts[:4] or [str(hit.get("snippet", ""))])

    return "\n".join(_dedupe_strings(context_lines))


def _append_platform_memory(
    *,
    tenant: str,
    user_id: str,
    agent_id: str,
    session_id: str,
    question: str,
    answer: str,
    tool_calls: list[dict[str, Any]],
    knowledge_base_ids: list[str],
) -> dict[str, Any]:
    facts = _extract_platform_memory_facts(
        question=question,
        tool_calls=tool_calls,
        knowledge_base_ids=knowledge_base_ids,
    )
    tool_names = _dedupe_strings(
        [
            str(call.get("tool_name", "")).strip()
            for call in tool_calls
            if call.get("tool_name")
        ],
    )
    keyword_text = " ".join(
        [question, " ".join(facts), " ".join(tool_names)],
    )
    record = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tenant": tenant,
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id,
        "question": _truncate_text(question, 1000),
        "facts": facts,
        "tool_names": tool_names,
        "knowledge_base_ids": list(knowledge_base_ids),
        "keywords": sorted(_memory_text_terms(keyword_text))[:80],
    }
    path = _platform_memory_path(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
    )
    previous = _load_platform_memories(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
        limit=PLATFORM_MEMORY_MAX_RECORDS - 1,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    records = [*previous, record]
    path.write_text(
        "\n".join(json.dumps(item, ensure_ascii=False) for item in records) + "\n",
        encoding="utf-8",
    )
    return record


async def _search_agent_knowledge_bases(
    request: Request,
    *,
    user_id: str,
    question: str,
    knowledge_base_ids: list[str],
    top_k: int = 3,
) -> tuple[list[dict[str, Any]], str | None]:
    service = getattr(request.app.state, "knowledge_base_service", None)
    if service is None or not knowledge_base_ids:
        return [], None

    hits: list[dict[str, Any]] = []
    errors: list[str] = []
    for knowledge_base_id in knowledge_base_ids:
        try:
            results = await service.search(
                user_id=user_id,
                knowledge_base_id=knowledge_base_id,
                query=question,
                top_k=top_k,
            )
        except Exception as exc:  # Do not let RAG failures break tool answers.
            errors.append(f"{knowledge_base_id}: {exc}")
            continue

        hits.extend(
            _format_knowledge_hit(knowledge_base_id, hit)
            for hit in results
        )

    hits.sort(key=lambda item: item["score"], reverse=True)
    return hits[:top_k], "; ".join(errors) if errors else None


def _save_platform_agents(agents: list[dict[str, Any]]) -> None:
    PLATFORM_AGENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLATFORM_AGENTS_PATH.write_text(
        json.dumps(agents, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_platform_connector_configs() -> dict[str, dict[str, Any]]:
    if not PLATFORM_CONNECTOR_CONFIGS_PATH.exists():
        return {}

    try:
        raw_configs = json.loads(
            PLATFORM_CONNECTOR_CONFIGS_PATH.read_text(encoding="utf-8"),
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail="Platform connector registry is not valid JSON.",
        ) from exc

    if not isinstance(raw_configs, dict):
        raise HTTPException(
            status_code=500,
            detail="Platform connector registry must be a JSON object.",
        )

    configs: dict[str, dict[str, Any]] = {}
    for key, value in raw_configs.items():
        if not isinstance(value, dict):
            continue
        tenant = str(value.get("tenant") or key).strip()
        if tenant:
            configs[tenant] = {**value, "tenant": tenant}

    return configs


def _save_platform_connector_configs(configs: dict[str, dict[str, Any]]) -> None:
    PLATFORM_CONNECTOR_CONFIGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLATFORM_CONNECTOR_CONFIGS_PATH.write_text(
        json.dumps(configs, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _redact_connector_config(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "tenant": str(config.get("tenant") or ""),
        "base_url": str(config.get("base_url") or ""),
        "policy_path": str(
            config.get("policy_path") or HttpEnterpriseConnector.policy_path,
        ),
        "ticket_path": str(
            config.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
        ),
        "metrics_path": str(
            config.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
        ),
        "timeout_seconds": float(config.get("timeout_seconds") or 5.0),
        "enabled": bool(config.get("enabled", True)),
        "token_configured": bool(str(config.get("token") or "").strip()),
        "updated_at": str(config.get("updated_at") or ""),
        "updated_by": str(config.get("updated_by") or ""),
    }


def _redacted_connector_configs() -> list[dict[str, Any]]:
    configs = _load_platform_connector_configs()
    return [
        _redact_connector_config(config)
        for _tenant, config in sorted(configs.items())
    ]


def _tenant_hint_from_user_id(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    tenant, _user = user_id.split(":", 1)
    tenant = tenant.strip()
    return tenant or None


def _runtime_tenant_for_user(user_id: str) -> str:
    hinted_tenant = _tenant_hint_from_user_id(user_id)
    if hinted_tenant:
        hinted_config = _load_platform_connector_configs().get(hinted_tenant)
        if hinted_config and bool(hinted_config.get("enabled", True)):
            return hinted_tenant
    return enterprise_connector.tenant_for_user(user_id)


def _configured_tenant_for_user(user_id: str) -> str:
    hinted_tenant = _tenant_hint_from_user_id(user_id)
    if hinted_tenant and hinted_tenant in _load_platform_connector_configs():
        return hinted_tenant
    return enterprise_connector.tenant_for_user(user_id)


def _connector_config_for_tenant(tenant: str) -> dict[str, Any] | None:
    config = _load_platform_connector_configs().get(tenant)
    if not config or not bool(config.get("enabled", True)):
        return None
    if not str(config.get("base_url") or "").strip():
        return None
    return config


def _connector_from_saved_config(
    config: dict[str, Any],
) -> HttpEnterpriseConnector:
    return HttpEnterpriseConnector(
        base_url=str(config.get("base_url") or "").strip().rstrip("/"),
        token=str(config.get("token") or "").strip() or None,
        timeout_seconds=float(config.get("timeout_seconds") or 5.0),
        policy_path=str(
            config.get("policy_path") or HttpEnterpriseConnector.policy_path,
        ),
        ticket_path=str(
            config.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
        ),
        metrics_path=str(
            config.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
        ),
    )


def _runtime_enterprise_connector_for_tenant(
    tenant: str,
) -> tuple[EnterpriseConnector, str]:
    config = _connector_config_for_tenant(tenant)
    if config is not None:
        return _connector_from_saved_config(config), "saved_config"
    return enterprise_connector, "global"


def _enterprise_runtime_context(user_id: str) -> dict[str, Any]:
    tenant = _runtime_tenant_for_user(user_id)
    connector, source = _runtime_enterprise_connector_for_tenant(tenant)
    connector_label = (
        f"{connector.name}:saved_config"
        if source == "saved_config"
        else connector.name
    )
    return {
        "tenant": tenant,
        "connector": connector,
        "connector_source": source,
        "connector_label": connector_label,
        "saved_config_enabled": source == "saved_config",
    }


def _normalize_connector_config_payload(
    payload: EnterpriseConnectorConfigSaveRequest,
    *,
    user_id: str,
    existing_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base_url = payload.base_url.strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=400, detail="Enterprise API URL is required.")

    tenant = payload.tenant.strip() or _configured_tenant_for_user(user_id)
    token = payload.token.strip() if payload.token and payload.token.strip() else None
    if token is None and existing_config is not None:
        saved_token = str(existing_config.get("token") or "").strip()
        token = saved_token or None

    return {
        "tenant": tenant,
        "base_url": base_url,
        "token": token,
        "policy_path": payload.policy_path.strip()
        or HttpEnterpriseConnector.policy_path,
        "ticket_path": payload.ticket_path.strip()
        or HttpEnterpriseConnector.ticket_path,
        "metrics_path": payload.metrics_path.strip()
        or HttpEnterpriseConnector.metrics_path,
        "timeout_seconds": payload.timeout_seconds,
        "enabled": payload.enabled,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user_id,
    }


def _platform_config_counts(config: dict[str, Any]) -> dict[str, int]:
    tool_policy = config.get("tool_policy") if isinstance(config, dict) else {}
    tenants = tool_policy.get("tenants", {}) if isinstance(tool_policy, dict) else {}
    tenant_count = len(tenants) if isinstance(tenants, dict) else 0
    user_policy_count = 0
    if isinstance(tenants, dict):
        for tenant_policy in tenants.values():
            if isinstance(tenant_policy, dict) and isinstance(
                tenant_policy.get("users"),
                dict,
            ):
                user_policy_count += len(tenant_policy["users"])

    return {
        "members": len(config.get("members") or []),
        "connector_configs": len(config.get("connector_configs") or []),
        "agents": len(config.get("agents") or []),
        "workflow_templates": len(config.get("workflow_templates") or []),
        "tool_policy_tenants": tenant_count,
        "tool_policy_users": user_policy_count,
    }


def _export_platform_config() -> dict[str, Any]:
    config = {
        "members": _platform_member_registry(include_inactive=True),
        "connector_configs": _redacted_connector_configs(),
        "agents": _load_platform_agents(),
        "workflow_templates": _load_platform_workflow_templates(),
        "tool_policy": _load_platform_tool_policy_config(),
    }
    counts = _platform_config_counts(config)
    return {
        "schema_version": 1,
        "platform_version": PLATFORM_VERSION,
        "exported_at": _now_iso(),
        "redacted": True,
        "files": {
            "members": {
                "path": str(PLATFORM_MEMBERS_PATH),
                "count": counts["members"],
            },
            "connector_configs": {
                "path": str(PLATFORM_CONNECTOR_CONFIGS_PATH),
                "count": counts["connector_configs"],
            },
            "agents": {
                "path": str(PLATFORM_AGENTS_PATH),
                "count": counts["agents"],
            },
            "workflow_templates": {
                "path": str(PLATFORM_WORKFLOW_TEMPLATES_PATH),
                "count": counts["workflow_templates"],
            },
            "tool_policy": {
                "path": str(_platform_tool_policy_path()),
                "tenant_count": counts["tool_policy_tenants"],
                "user_policy_count": counts["tool_policy_users"],
            },
        },
        "counts": counts,
        "config": config,
    }


def _normalize_import_members(value: Any, actor: str) -> list[dict[str, Any]]:
    raw_members = value.get("members", value) if isinstance(value, dict) else value
    if raw_members is None:
        return []
    if not isinstance(raw_members, list):
        raise HTTPException(status_code=400, detail="members must be a JSON array.")
    return [
        _normalize_platform_member(raw, updated_by=actor)
        for raw in raw_members
        if isinstance(raw, dict)
    ]


def _normalize_import_connector_configs(
    value: Any,
    existing_configs: dict[str, dict[str, Any]],
    actor: str,
) -> list[dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, dict):
        raw_configs = [
            {**raw, "tenant": raw.get("tenant") or tenant}
            for tenant, raw in value.items()
            if isinstance(raw, dict)
        ]
    elif isinstance(value, list):
        raw_configs = [raw for raw in value if isinstance(raw, dict)]
    else:
        raise HTTPException(
            status_code=400,
            detail="connector_configs must be a JSON array or object.",
        )

    configs: list[dict[str, Any]] = []
    for raw in raw_configs:
        tenant = str(raw.get("tenant") or "").strip()
        base_url = str(raw.get("base_url") or "").strip().rstrip("/")
        if not tenant or not base_url:
            continue
        existing = existing_configs.get(tenant) or {}
        token = str(raw.get("token") or "").strip() or str(existing.get("token") or "").strip()
        configs.append(
            {
                "tenant": tenant,
                "base_url": base_url,
                "token": token or None,
                "policy_path": str(
                    raw.get("policy_path") or HttpEnterpriseConnector.policy_path,
                ).strip(),
                "ticket_path": str(
                    raw.get("ticket_path") or HttpEnterpriseConnector.ticket_path,
                ).strip(),
                "metrics_path": str(
                    raw.get("metrics_path") or HttpEnterpriseConnector.metrics_path,
                ).strip(),
                "timeout_seconds": float(raw.get("timeout_seconds") or 5.0),
                "enabled": bool(raw.get("enabled", True)),
                "updated_at": _now_iso(),
                "updated_by": actor,
            },
        )
    return configs


def _normalize_import_agents(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail="agents must be a JSON array.")
    return [dict(item) for item in value if isinstance(item, dict) and item.get("id")]


def _normalize_import_workflow_templates(value: Any) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HTTPException(
            status_code=400,
            detail="workflow_templates must be a JSON array.",
        )
    return [
        dict(item)
        for item in value
        if isinstance(item, dict) and item.get("workflow_type")
    ]


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


def _deep_merge_dict(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(base))
    for key, value in incoming.items():
        if (
            isinstance(value, dict)
            and isinstance(merged.get(key), dict)
        ):
            merged[key] = _deep_merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def _normalize_policy_tools(value: list[str] | None) -> list[str]:
    if not value:
        return []

    seen: set[str] = set()
    result: list[str] = []
    allowed_names = set(ENTERPRISE_TOOL_NAMES)
    for item in value:
        name = str(item or "").strip()
        if name in allowed_names and name not in seen:
            seen.add(name)
            result.append(name)
    return result


def _platform_agent_template_metadata() -> list[dict[str, Any]]:
    return [
        {
            "id": template["id"],
            "name": template["name"],
            "description": template["description"],
            "tools": list(template["tools"]),
            "capabilities": list(template["capabilities"]),
        }
        for template in ENTERPRISE_AGENT_TEMPLATES
    ]


def _platform_identity_metadata(
    current_user_id: str,
    current_tenant: str,
) -> list[dict[str, Any]]:
    identities = enterprise_connector.list_demo_identities()
    normalized_by_user: dict[str, dict[str, Any]] = {}

    for identity in identities:
        user_id = str(identity.get("user_id") or "").strip()
        if not user_id:
            continue
        tenant = str(identity.get("tenant") or "").strip()
        if not tenant:
            tenant = enterprise_connector.tenant_for_user(user_id)

        normalized_by_user[user_id] = {
            "user_id": user_id,
            "tenant": tenant,
            "display_name": str(identity.get("display_name") or user_id),
            "role": str(identity.get("role") or "Enterprise user"),
            "status": "active",
            "source": "demo_connector",
            "sample_questions": list(identity.get("sample_questions") or []),
        }

    for member in _platform_member_registry(include_inactive=True):
        normalized_by_user[member["user_id"]] = {
            **normalized_by_user.get(member["user_id"], {}),
            **member,
        }

    if current_user_id not in normalized_by_user:
        runtime_connector, _source = _runtime_enterprise_connector_for_tenant(
            current_tenant,
        )
        normalized_by_user[current_user_id] = {
            "user_id": current_user_id,
            "tenant": current_tenant,
            "display_name": current_user_id,
            "role": "Current request user",
            "status": "active",
            "source": "current_request",
            "sample_questions": runtime_connector.describe_tenant_workspace(
                current_tenant,
            ).get("sample_questions", []),
        }

    normalized: list[dict[str, Any]] = []
    for identity in normalized_by_user.values():
        user_id = str(identity.get("user_id") or "").strip()
        tenant = str(identity.get("tenant") or current_tenant).strip()
        normalized.append(
            {
                **identity,
                "tenant": tenant,
                "tool_policy": {
                    "mode": tool_authorization_policy.mode,
                    "decisions": tool_authorization_policy.describe_for_user(
                        tenant,
                        user_id,
                        ENTERPRISE_TOOL_NAMES,
                    ),
                },
            },
        )

    normalized.sort(
        key=lambda item: (
            0 if item.get("user_id") == current_user_id else 1,
            str(item.get("tenant") or ""),
            str(item.get("user_id") or ""),
        ),
    )
    return normalized


def _platform_tool_policy_payload(
    *,
    user_id: str | None = None,
    tenant: str | None = None,
) -> dict[str, Any]:
    resolved_user_id = user_id or "acme:alice"
    runtime = _enterprise_runtime_context(resolved_user_id)
    resolved_tenant = tenant or str(runtime["tenant"])
    identities = _platform_identity_metadata(resolved_user_id, resolved_tenant)
    return {
        "mode": tool_authorization_policy.mode,
        "path": str(_platform_tool_policy_path()),
        "policy": _load_platform_tool_policy_config(),
        "identities": identities,
        "selected": {
            "tenant": resolved_tenant,
            "user_id": resolved_user_id,
        },
    }


def _tenant_workspace_metadata(
    identities: list[dict[str, Any]],
    current_tenant: str,
) -> dict[str, Any]:
    tenants = {current_tenant}
    tenants.update(
        str(identity.get("tenant"))
        for identity in identities
        if identity.get("tenant")
    )
    workspaces: dict[str, Any] = {}
    for tenant in sorted(tenants):
        connector, source = _runtime_enterprise_connector_for_tenant(tenant)
        workspace = connector.describe_tenant_workspace(tenant)
        workspace["runtime_connector_source"] = source
        workspaces[tenant] = workspace
    return workspaces


def _enterprise_governance_snapshot(
    *,
    identities: list[dict[str, Any]],
    tenant_workspaces: dict[str, Any],
) -> dict[str, Any]:
    """Build the platform governance model used by the enterprise console."""
    pending_approvals = _load_platform_approval_requests(
        status="pending",
        limit=100,
    )
    recent_audit_events = tool_audit_logger.recent(limit=100)

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
                1 for event in recent_audit_events if event.get("success") is False
            ),
        },
    }


def _env_configured(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _enterprise_connector_env_metadata() -> list[dict[str, Any]]:
    connector_mode = os.getenv("ENTERPRISE_CONNECTOR", "mock").lower().strip()
    return [
        {
            "name": "ENTERPRISE_CONNECTOR",
            "configured": _env_configured("ENTERPRISE_CONNECTOR"),
            "required": False,
            "description": "Connector mode: mock, fixture, or http.",
        },
        {
            "name": "ENTERPRISE_API_BASE_URL",
            "configured": _env_configured("ENTERPRISE_API_BASE_URL"),
            "required": connector_mode == "http",
            "description": "Base URL for the enterprise HTTP data API.",
        },
        {
            "name": "ENTERPRISE_API_TOKEN",
            "configured": _env_configured("ENTERPRISE_API_TOKEN"),
            "required": False,
            "secret": True,
            "description": "Bearer token for the enterprise HTTP API.",
        },
        {
            "name": "ENTERPRISE_FIXTURE_PATH",
            "configured": _env_configured("ENTERPRISE_FIXTURE_PATH")
            or _env_configured("ENTERPRISE_MOCK_DATA_PATH"),
            "required": False,
            "description": "Local JSON fixture path for mock/fixture connector data.",
        },
        {
            "name": "ENTERPRISE_POLICY_PATH",
            "configured": _env_configured("ENTERPRISE_POLICY_PATH"),
            "required": False,
            "description": "HTTP path template for tenant policy search.",
        },
        {
            "name": "ENTERPRISE_TICKET_PATH",
            "configured": _env_configured("ENTERPRISE_TICKET_PATH"),
            "required": False,
            "description": "HTTP path template for tenant ticket lookup.",
        },
        {
            "name": "ENTERPRISE_METRICS_PATH",
            "configured": _env_configured("ENTERPRISE_METRICS_PATH"),
            "required": False,
            "description": "HTTP path template for tenant department metrics.",
        },
    ]


def _enterprise_supported_connectors() -> list[dict[str, Any]]:
    return [
        {
            "name": "mock",
            "mode": "local",
            "description": "Built-in tenant fixture data for local demos.",
            "env_vars": ["ENTERPRISE_CONNECTOR"],
        },
        {
            "name": "fixture",
            "mode": "local",
            "description": "Load tenant fixture data from a JSON file.",
            "env_vars": [
                "ENTERPRISE_CONNECTOR",
                "ENTERPRISE_FIXTURE_PATH",
                "ENTERPRISE_MOCK_DATA_PATH",
            ],
        },
        {
            "name": "http",
            "mode": "remote",
            "description": "Read tenant-scoped business data from an enterprise HTTP API.",
            "env_vars": [
                "ENTERPRISE_CONNECTOR",
                "ENTERPRISE_API_BASE_URL",
                "ENTERPRISE_API_TOKEN",
                "ENTERPRISE_POLICY_PATH",
                "ENTERPRISE_TICKET_PATH",
                "ENTERPRISE_METRICS_PATH",
            ],
            "paths": {
                "policy": "/tenants/{tenant}/policies/search",
                "ticket": "/tenants/{tenant}/tickets/{ticket_id}",
                "metrics": "/tenants/{tenant}/departments/{department}/metrics",
            },
        },
    ]


def _enterprise_connector_health() -> dict[str, Any]:
    connector_name = enterprise_connector.name
    connector_mode = os.getenv("ENTERPRISE_CONNECTOR", connector_name).lower().strip()

    if connector_name == "http":
        missing = [
            item["name"]
            for item in _enterprise_connector_env_metadata()
            if item.get("required") and not item.get("configured")
        ]
        return {
            "name": connector_name,
            "mode": connector_mode,
            "status": "error" if missing else "ready",
            "message": (
                f"Missing required configuration: {', '.join(missing)}"
                if missing
                else "HTTP enterprise connector is configured."
            ),
        }

    if connector_name == "mock":
        return {
            "name": connector_name,
            "mode": connector_mode,
            "status": "ready",
            "message": "Using local tenant fixture data.",
        }

    return {
        "name": connector_name,
        "mode": connector_mode,
        "status": "partial",
        "message": (
            "Connector metadata is available; verify runtime data access with a "
            "tool call."
        ),
    }


def _preview_connector_result(result: Any) -> str:
    return json.dumps(result, ensure_ascii=False, default=str)[:500]


def _create_platform_agent(
    payload: EnterpriseAgentPublishRequest,
    user_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    template = _get_platform_agent_template(payload.template_id)
    template_tools = list(template["tools"])
    selected_tools = payload.tools if payload.tools is not None else template_tools
    _validate_platform_agent_tools(template, selected_tools)

    now = datetime.now(timezone.utc).isoformat()
    tenant = _normalize_platform_agent_tenant(payload.tenant, user_id)
    name = (payload.name or "").strip() or str(template["name"])
    description = (payload.description or "").strip() or str(template["description"])
    model_config_id = (payload.model_config_id or "").strip() or None
    knowledge_base_ids = _normalize_platform_resource_ids(payload.knowledge_base_ids)
    allowed_user_ids = _normalize_agent_access_values(payload.allowed_user_ids)
    allowed_roles = _normalize_agent_access_values(payload.allowed_roles)
    _validate_platform_agent_access_scope(
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

    agents = _load_platform_agents()
    agents.append(agent)
    _save_platform_agents(agents)
    return agent, agents


def _update_platform_agent(
    agent_id: str,
    payload: EnterpriseAgentUpdateRequest,
    user_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    agents = _load_platform_agents()
    agent_index = next(
        (
            index
            for index, item in enumerate(agents)
            if str(item.get("id", "")) == agent_id
        ),
        None,
    )
    if agent_index is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown platform agent: {agent_id}",
        )

    agent = dict(agents[agent_index])
    template = _get_platform_agent_template(str(agent.get("template_id", "")))
    changes = payload.model_dump(exclude_unset=True)

    if "name" in changes:
        agent["name"] = (payload.name or "").strip() or str(template["name"])
    if "description" in changes:
        agent["description"] = (payload.description or "").strip() or str(
            template["description"],
        )
    if "tenant" in changes:
        agent["tenant"] = _normalize_platform_agent_tenant(payload.tenant, user_id)
    if "tools" in changes:
        selected_tools = payload.tools if payload.tools is not None else []
        _validate_platform_agent_tools(template, selected_tools)
        agent["tools"] = list(selected_tools)
    if "knowledge_base_ids" in changes:
        agent["knowledge_base_ids"] = _normalize_platform_resource_ids(
            payload.knowledge_base_ids,
        )
    if "model_config_id" in changes:
        agent["model_config_id"] = (payload.model_config_id or "").strip() or None
    if "memory_enabled" in changes:
        agent["memory_enabled"] = bool(payload.memory_enabled)
    if "workflow_enabled" in changes:
        agent["workflow_enabled"] = bool(payload.workflow_enabled)
    if "allowed_user_ids" in changes:
        agent["allowed_user_ids"] = _normalize_agent_access_values(
            payload.allowed_user_ids,
        )
    if "allowed_roles" in changes:
        agent["allowed_roles"] = _normalize_agent_access_values(payload.allowed_roles)
    if "status" in changes:
        status = (payload.status or "").strip()
        if status not in {"published", "archived"}:
            raise HTTPException(
                status_code=400,
                detail="Platform agent status must be published or archived.",
            )
        agent["status"] = status

    _validate_platform_agent_access_scope(
        tenant=str(agent.get("tenant") or "").strip(),
        allowed_user_ids=_normalize_agent_access_values(agent.get("allowed_user_ids")),
        allowed_roles=_normalize_agent_access_values(agent.get("allowed_roles")),
    )
    agent["capabilities"] = list(template["capabilities"])
    agent["updated_at"] = datetime.now(timezone.utc).isoformat()
    agents[agent_index] = agent
    _save_platform_agents(agents)
    return agent, agents


def _archive_platform_agent(
    agent_id: str,
    user_id: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    return _update_platform_agent(
        agent_id,
        EnterpriseAgentUpdateRequest(status="archived"),
        user_id,
    )


def _run_authorized_enterprise_tool(
    *,
    user_id: str,
    tool_name: str,
    inputs: dict[str, Any],
    agent_id: str,
    session_id: str,
    fail_on_denied: bool = True,
) -> dict[str, Any]:
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    runtime_connector = runtime["connector"]
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])

    if tool_name not in ENTERPRISE_TOOL_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown enterprise tool: {tool_name}",
        )

    decision = tool_authorization_policy.authorize(tenant, user_id, tool_name)
    decision_payload = _tool_decision_payload(tool_name, decision)
    if not decision.allowed:
        if fail_on_denied:
            raise HTTPException(
                status_code=403,
                detail={"decision": decision_payload},
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

    if tool_name == "enterprise_lookup_policy":
        keyword = str(inputs.get("keyword", "")).strip()
        clean_inputs = {"keyword": keyword}
        call = lambda: runtime_connector.lookup_policy(tenant, keyword)
    elif tool_name == "enterprise_get_ticket_status":
        ticket_id = str(inputs.get("ticket_id", "")).strip()
        clean_inputs = {"ticket_id": ticket_id}
        call = lambda: runtime_connector.get_ticket_status(tenant, ticket_id)
    else:
        department = str(inputs.get("department", "")).strip()
        clean_inputs = {"department": department}
        call = lambda: runtime_connector.summarize_department_metrics(
            tenant,
            department,
        )

    result = tool_audit_logger.capture(
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


def _enterprise_router_config() -> dict[str, Any] | None:
    base_url = os.getenv("ENTERPRISE_AGENT_ROUTER_BASE_URL", "").strip()
    api_key = os.getenv("ENTERPRISE_AGENT_ROUTER_API_KEY", "").strip()
    model = os.getenv("ENTERPRISE_AGENT_ROUTER_MODEL", "").strip()

    if not base_url and not api_key and not model:
        return None

    missing = [
        name
        for name, value in (
            ("ENTERPRISE_AGENT_ROUTER_BASE_URL", base_url),
            ("ENTERPRISE_AGENT_ROUTER_API_KEY", api_key),
            ("ENTERPRISE_AGENT_ROUTER_MODEL", model),
        )
        if not value
    ]
    if missing:
        raise EnterpriseRouterError(
            "Router env is incomplete: missing " + ", ".join(missing),
        )

    provider = (
        os.getenv("ENTERPRISE_AGENT_ROUTER_PROVIDER", "openai")
        .strip()
        .lower()
        or "openai"
    )
    timeout_value = os.getenv("ENTERPRISE_AGENT_ROUTER_TIMEOUT_SECONDS", "8")
    try:
        timeout_seconds = max(1.0, float(timeout_value))
    except ValueError:
        timeout_seconds = 8.0

    return {
        "base_url": base_url,
        "api_key": api_key,
        "model": model,
        "provider": provider,
        "timeout_seconds": timeout_seconds,
    }


def _enterprise_router_endpoint(base_url: str, provider: str) -> str:
    normalized = base_url.rstrip("/")
    if provider == "anthropic":
        if normalized.endswith("/v1/messages") or normalized.endswith("/messages"):
            return normalized
        if normalized.endswith("/v1"):
            return f"{normalized}/messages"
        return f"{normalized}/v1/messages"

    if normalized.endswith("/v1/chat/completions") or normalized.endswith(
        "/chat/completions",
    ):
        return normalized
    if normalized.endswith("/v1"):
        return f"{normalized}/chat/completions"
    return f"{normalized}/v1/chat/completions"


def _enterprise_router_prompt(question: str) -> tuple[str, str]:
    tool_schema = {
        "enterprise_lookup_policy": {
            "description": "Query tenant policy snippets.",
            "inputs": {"keyword": "remote | expense | security"},
        },
        "enterprise_get_ticket_status": {
            "description": "Query a tenant ticket by id.",
            "inputs": {"ticket_id": "INC-1001"},
        },
        "enterprise_summarize_department_metrics": {
            "description": "Summarize tenant department metrics.",
            "inputs": {"department": "engineering | support | sales"},
        },
    }
    system_prompt = (
        "You route one enterprise business question to one allowed read-only "
        "tool. Return strict JSON only. Do not explain outside JSON. "
        "Allowed tools and inputs: "
        f"{json.dumps(tool_schema, ensure_ascii=False)}. "
        "If no tool fits, return "
        '{"routed": false, "reason": "why no tool fits", "source": "model"}. '
        "If a tool fits, return "
        '{"routed": true, "tool_name": "enterprise_get_ticket_status", '
        '"inputs": {"ticket_id": "INC-1001"}, '
        '"reason": "why this tool fits", "source": "model"}.'
    )
    user_prompt = f"Business question:\n{question}\n\nReturn JSON only."
    return system_prompt, user_prompt


def _parse_router_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise EnterpriseRouterError("Router response is not valid JSON.")
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise EnterpriseRouterError(
                "Router response is not valid JSON.",
            ) from exc

    if not isinstance(data, dict):
        raise EnterpriseRouterError("Router JSON must be an object.")
    return data


def _normalize_model_route(data: dict[str, Any]) -> dict[str, Any]:
    routed = bool(data.get("routed"))
    reason = str(data.get("reason") or "Model router decision.").strip()

    if not routed:
        return {
            "routed": False,
            "reason": reason,
            "source": ROUTING_SOURCE_MODEL,
        }

    tool_name = str(data.get("tool_name", "")).strip()
    if tool_name not in ENTERPRISE_TOOL_NAMES:
        raise EnterpriseRouterError(
            f"Router selected unsupported tool: {tool_name or '<empty>'}",
        )

    raw_inputs = data.get("inputs")
    if not isinstance(raw_inputs, dict):
        raise EnterpriseRouterError("Router inputs must be a JSON object.")

    input_field = ENTERPRISE_TOOL_INPUT_FIELDS[tool_name]
    input_value = str(raw_inputs.get(input_field, "")).strip()
    if not input_value:
        raise EnterpriseRouterError(
            f"Router omitted required input: {input_field}",
        )

    return {
        "routed": True,
        "tool_name": tool_name,
        "inputs": {input_field: input_value},
        "reason": reason,
        "source": ROUTING_SOURCE_MODEL,
    }


async def _route_enterprise_agent_question_with_model(
    question: str,
) -> dict[str, Any]:
    config = _enterprise_router_config()
    if config is None:
        raise EnterpriseRouterError("Router model is not configured.")

    system_prompt, user_prompt = _enterprise_router_prompt(question)
    endpoint = _enterprise_router_endpoint(
        config["base_url"],
        config["provider"],
    )

    if config["provider"] == "anthropic":
        headers = {
            "content-type": "application/json",
            "x-api-key": config["api_key"],
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": config["model"],
            "max_tokens": 500,
            "temperature": 0,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
    else:
        headers = {
            "authorization": f"Bearer {config['api_key']}",
            "content-type": "application/json",
        }
        payload = {
            "model": config["model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0,
            "max_tokens": 500,
        }

    try:
        async with httpx.AsyncClient(
            timeout=config["timeout_seconds"],
        ) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            response_payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise EnterpriseRouterError(
            f"Router HTTP error: {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise EnterpriseRouterError(
            f"Router request failed: {exc.__class__.__name__}",
        ) from exc
    except json.JSONDecodeError as exc:
        raise EnterpriseRouterError("Router HTTP response is not JSON.") from exc

    if config["provider"] == "anthropic":
        content_blocks = response_payload.get("content")
        if not isinstance(content_blocks, list):
            raise EnterpriseRouterError("Router response is missing content.")
        content = "\n".join(
            str(block.get("text", ""))
            for block in content_blocks
            if isinstance(block, dict)
        ).strip()
    else:
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise EnterpriseRouterError("Router response is missing choices.")
        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise EnterpriseRouterError("Router response is missing message.")
        content = str(message.get("content", "")).strip()

    if not content:
        raise EnterpriseRouterError("Router response content is empty.")

    return _normalize_model_route(_parse_router_json(content))


def _dedupe_enterprise_agent_routes(
    routes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for route in routes:
        if not route.get("routed"):
            continue

        tool_name = str(route.get("tool_name", "")).strip()
        if tool_name not in ENTERPRISE_TOOL_NAMES:
            continue

        raw_inputs = route.get("inputs")
        if not isinstance(raw_inputs, dict):
            continue

        input_field = ENTERPRISE_TOOL_INPUT_FIELDS[tool_name]
        input_value = str(raw_inputs.get(input_field, "")).strip()
        if not input_value:
            continue

        dedupe_key = (tool_name, input_value.lower())
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        deduped.append(
            {
                "routed": True,
                "tool_name": tool_name,
                "inputs": {input_field: input_value},
                "reason": str(
                    route.get("reason") or "Matched enterprise tool route.",
                ),
                "source": str(route.get("source", ROUTING_SOURCE_RULES)),
            },
        )

    return deduped


def _route_enterprise_agent_question_with_rules(
    question: str,
) -> list[dict[str, Any]]:
    normalized = question.lower()
    routes: list[dict[str, Any]] = []

    for ticket_id in re.findall(r"\b[A-Z]{2,5}-\d+\b", question.upper()):
        routes.append(
            {
                "routed": True,
                "tool_name": "enterprise_get_ticket_status",
                "inputs": {"ticket_id": ticket_id},
                "reason": "Detected a ticket id in the question.",
                "source": ROUTING_SOURCE_RULES,
            },
        )

    policy_keywords = {
        "remote": ("remote", "Remote-work policy request."),
        "远程": ("remote", "Detected a remote-work policy request."),
        "办公": ("remote", "Detected an office or remote-work policy request."),
        "expense": ("expense", "Detected an expense policy request."),
        "报销": ("expense", "Detected an expense policy request."),
        "费用": ("expense", "Detected an expense policy request."),
        "security": ("security", "Detected a security policy request."),
        "安全": ("security", "Detected a security policy request."),
        "policy": ("remote", "Detected a policy request."),
        "制度": ("remote", "Detected a policy request."),
    }
    for marker, (keyword, reason) in policy_keywords.items():
        if marker in normalized or marker in question:
            routes.append(
                {
                    "routed": True,
                    "tool_name": "enterprise_lookup_policy",
                    "inputs": {"keyword": keyword},
                    "reason": reason,
                    "source": ROUTING_SOURCE_RULES,
                },
            )

    department_keywords = {
        "engineering": ("engineering", "Detected engineering metrics request."),
        "工程": ("engineering", "Detected engineering metrics request."),
        "研发": ("engineering", "Detected engineering metrics request."),
        "support": ("support", "Detected support metrics request."),
        "客服": ("support", "Detected support metrics request."),
        "支持": ("support", "Detected support metrics request."),
        "sales": ("sales", "Detected sales metrics request."),
        "销售": ("sales", "Detected sales metrics request."),
    }
    for marker, (department, reason) in department_keywords.items():
        if marker in normalized or marker in question:
            routes.append(
                {
                    "routed": True,
                    "tool_name": "enterprise_summarize_department_metrics",
                    "inputs": {"department": department},
                    "reason": reason,
                    "source": ROUTING_SOURCE_RULES,
                },
            )

    has_metrics_route = any(
        route.get("tool_name") == "enterprise_summarize_department_metrics"
        for route in routes
    )
    if (
        not has_metrics_route
        and ("部门" in question or "指标" in question or "metrics" in normalized)
    ):
        routes.append(
            {
                "routed": True,
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": {"department": "engineering"},
                "reason": "Detected a generic department metrics request.",
                "source": ROUTING_SOURCE_RULES,
            },
        )

    return _dedupe_enterprise_agent_routes(routes)


def _route_enterprise_agent_question(question: str) -> dict[str, Any]:
    routes = _route_enterprise_agent_question_with_rules(question)
    if routes:
        return routes[0]

    return {
        "routed": False,
        "reason": (
            "No demo route matched. Try a ticket id, a policy keyword, "
            "or a department metrics request."
        ),
        "source": ROUTING_SOURCE_RULES,
    }


async def _select_enterprise_agent_routes(
    question: str,
) -> tuple[list[dict[str, Any]], str | None]:
    rule_routes = _route_enterprise_agent_question_with_rules(question)
    router_env_present = any(
        os.getenv(name, "").strip()
        for name in (
            "ENTERPRISE_AGENT_ROUTER_BASE_URL",
            "ENTERPRISE_AGENT_ROUTER_API_KEY",
            "ENTERPRISE_AGENT_ROUTER_MODEL",
        )
    )
    if router_env_present:
        try:
            model_route = await _route_enterprise_agent_question_with_model(question)
        except EnterpriseRouterError as exc:
            return rule_routes, str(exc)

        model_routes = [model_route] if model_route.get("routed") else []
        return _dedupe_enterprise_agent_routes(model_routes + rule_routes), None

    return rule_routes, None


async def _select_enterprise_agent_route(
    question: str,
) -> tuple[dict[str, Any], str | None]:
    routes, routing_error = await _select_enterprise_agent_routes(question)
    if routes:
        return routes[0], routing_error
    return _route_enterprise_agent_question(question), routing_error


def _enterprise_routing_mode(routes: list[dict[str, Any]]) -> str:
    sources: list[str] = []
    for route in routes:
        source = str(route.get("source", ROUTING_SOURCE_RULES))
        if source not in sources:
            sources.append(source)

    return "+".join(sources) if sources else ROUTING_SOURCE_RULES


def _format_enterprise_agent_answer(
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


app = create_app(
    storage=storage,
    message_bus=_build_message_bus(),
    workspace_manager=LocalWorkspaceManager(
        basedir=str(DATA_DIR / "workspaces"),
    ),
    knowledge_base_manager=CollectionPerKbManager(
        storage=storage,
        vector_store=_build_vector_store(),
    ),
    blob_store=LocalBlobStore(root_dir=DATA_DIR / "blobs"),
    enable_index_worker=os.getenv("AGENTSCOPE_ENABLE_INDEX_WORKER", "1") != "0",
    extra_agent_tools=build_enterprise_tools,
    extra_agent_middlewares=build_enterprise_middlewares,
    custom_subagent_templates=ENTERPRISE_SUBAGENT_TEMPLATES,
    extra_middlewares=[
        Middleware(
            CORSMiddleware,
            allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
    title="AgentScope Enterprise Knowledge Assistant",
)


@app.get("/enterprise/platform/status")
async def enterprise_platform_status(request: Request) -> dict[str, Any]:
    """Return enterprise platform state for the frontend console."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    tenant_workspaces = _tenant_workspace_metadata(identities, tenant)

    return {
        "platform": {
            "name": "AgentScope Enterprise Agent Platform",
            "version": PLATFORM_VERSION,
        },
        "current_user": {
            "user_id": user_id,
            "tenant": tenant,
        },
        "connector": {
            "name": runtime["connector_label"],
            "source": runtime["connector_source"],
            "saved_config_enabled": runtime["saved_config_enabled"],
        },
        "identities": identities,
        "tenant_workspaces": tenant_workspaces,
        "current_workspace": tenant_workspaces.get(tenant),
        "storage": {
            "data_dir": str(DATA_DIR),
            "audit_log_path": str(tool_audit_logger.path),
        },
        "audit": {
            "enabled": tool_audit_logger.enabled,
            "recent_events": tool_audit_logger.recent(limit=12),
        },
        "dashboard": _enterprise_platform_dashboard(
            tenant=tenant,
            user_id=user_id,
        ),
        "launch_readiness": _enterprise_platform_launch_readiness(
            tenant=tenant,
            user_id=user_id,
            identities=identities,
        ),
        "tool_policy": {
            "mode": tool_authorization_policy.mode,
            "decisions": tool_authorization_policy.describe_for_user(
                tenant,
                user_id,
                ENTERPRISE_TOOL_NAMES,
            ),
        },
        "subagent_templates": _enterprise_subagent_template_metadata(),
    }


@app.get("/enterprise/platform/connectors")
async def enterprise_platform_connectors(request: Request) -> dict[str, Any]:
    """Return enterprise data source connector readiness and tenant scope."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)

    return {
        "current": _enterprise_connector_health(),
        "runtime": {
            "tenant": tenant,
            "connector": runtime["connector_label"],
            "source": runtime["connector_source"],
            "saved_config_enabled": runtime["saved_config_enabled"],
        },
        "supported": _enterprise_supported_connectors(),
        "env": _enterprise_connector_env_metadata(),
        "http_paths": {
            "policy": os.getenv(
                "ENTERPRISE_POLICY_PATH",
                "/tenants/{tenant}/policies/search",
            ),
            "ticket": os.getenv(
                "ENTERPRISE_TICKET_PATH",
                "/tenants/{tenant}/tickets/{ticket_id}",
            ),
            "metrics": os.getenv(
                "ENTERPRISE_METRICS_PATH",
                "/tenants/{tenant}/departments/{department}/metrics",
            ),
        },
        "identities": identities,
        "tenant_workspaces": _tenant_workspace_metadata(identities, tenant),
        "saved_configs": _redacted_connector_configs(),
    }


@app.get("/enterprise/platform/governance")
async def enterprise_platform_governance(request: Request) -> dict[str, Any]:
    """Return tenant, identity, approval, and audit governance state."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    tenant_workspaces = _tenant_workspace_metadata(identities, tenant)
    return _enterprise_governance_snapshot(
        identities=identities,
        tenant_workspaces=tenant_workspaces,
    )


@app.get("/enterprise/platform/members")
async def enterprise_platform_members(request: Request) -> dict[str, Any]:
    """Return the editable enterprise member registry."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    identities = _platform_identity_metadata(user_id, str(runtime["tenant"]))
    members = _platform_member_registry(include_inactive=True)
    return {
        "members": members,
        "identities": identities,
        "roles": _platform_member_roles(identities),
        "path": str(PLATFORM_MEMBERS_PATH),
    }


@app.post("/enterprise/platform/members")
async def create_enterprise_platform_member(
    payload: EnterprisePlatformMemberUpsertRequest,
    request: Request,
) -> dict[str, Any]:
    """Create or replace one enterprise platform member."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    config = _load_platform_members_config()
    members = [
        _normalize_platform_member(raw)
        for raw in config.get("members", [])
        if isinstance(raw, dict)
    ]
    member = _normalize_platform_member(
        payload.model_dump(),
        updated_by=actor,
    )
    replaced = False
    for index, existing in enumerate(members):
        if existing["user_id"] == member["user_id"]:
            member["created_at"] = existing.get("created_at") or member["created_at"]
            members[index] = member
            replaced = True
            break
    if not replaced:
        members.append(member)
    _save_platform_members_config({"members": members})
    return {
        "member": member,
        "members": _platform_member_registry(include_inactive=True),
        "roles": _platform_member_roles(_platform_identity_metadata(actor, member["tenant"])),
        "path": str(PLATFORM_MEMBERS_PATH),
    }


@app.patch("/enterprise/platform/members/{user_id:path}")
async def update_enterprise_platform_member(
    user_id: str,
    payload: EnterprisePlatformMemberPatchRequest,
    request: Request,
) -> dict[str, Any]:
    """Update one enterprise platform member."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    config = _load_platform_members_config()
    members = [
        _normalize_platform_member(raw)
        for raw in config.get("members", [])
        if isinstance(raw, dict)
    ]
    for index, existing in enumerate(members):
        if existing["user_id"] == user_id:
            member = _normalize_platform_member(
                {
                    **existing,
                    **payload.model_dump(exclude_unset=True),
                    "user_id": user_id,
                },
                fallback_user_id=user_id,
                updated_by=actor,
            )
            member["created_at"] = existing.get("created_at") or member["created_at"]
            members[index] = member
            break
    else:
        member = _normalize_platform_member(
            {**payload.model_dump(exclude_unset=True), "user_id": user_id},
            fallback_user_id=user_id,
            updated_by=actor,
        )
        members.append(member)
    _save_platform_members_config({"members": members})
    return {
        "member": member,
        "members": _platform_member_registry(include_inactive=True),
        "roles": _platform_member_roles(_platform_identity_metadata(actor, member["tenant"])),
        "path": str(PLATFORM_MEMBERS_PATH),
    }


@app.delete("/enterprise/platform/members/{user_id:path}")
async def deactivate_enterprise_platform_member(
    user_id: str,
    request: Request,
) -> dict[str, Any]:
    """Soft-delete one enterprise platform member by marking it inactive."""
    actor = request.headers.get("X-User-ID") or "acme:alice"
    config = _load_platform_members_config()
    members = [
        _normalize_platform_member(raw)
        for raw in config.get("members", [])
        if isinstance(raw, dict)
    ]
    existing = next((member for member in members if member["user_id"] == user_id), None)
    if existing is None:
        existing = _normalize_platform_member(
            {
                "user_id": user_id,
                "tenant": _tenant_hint_from_user_id(user_id) or "acme",
                "display_name": user_id,
                "role": "Enterprise user",
            },
            updated_by=actor,
        )
        members.append(existing)
    existing["status"] = "inactive"
    existing["updated_at"] = _now_iso()
    existing["updated_by"] = actor
    _save_platform_members_config({"members": members})
    return {
        "member": existing,
        "members": _platform_member_registry(include_inactive=True),
        "roles": _platform_member_roles(_platform_identity_metadata(actor, existing["tenant"])),
        "path": str(PLATFORM_MEMBERS_PATH),
    }


@app.get("/enterprise/platform/policies/tools")
async def enterprise_platform_tool_policy(
    request: Request,
    user_id: str | None = None,
    tenant: str | None = None,
) -> dict[str, Any]:
    """Return editable enterprise tool authorization policy state."""
    resolved_user_id = user_id or request.headers.get("X-User-ID") or "acme:alice"
    return _platform_tool_policy_payload(user_id=resolved_user_id, tenant=tenant)


@app.patch("/enterprise/platform/policies/tools")
async def update_enterprise_platform_tool_policy(
    payload: EnterpriseToolPolicyUpdateRequest,
) -> dict[str, Any]:
    """Persist one tenant user's enterprise tool authorization policy."""
    global tool_authorization_policy

    tenant = payload.tenant.strip()
    user_id = payload.user_id.strip()
    if not tenant or not user_id:
        raise HTTPException(status_code=400, detail="tenant and user_id are required.")

    allow = _normalize_policy_tools(payload.allow)
    deny = _normalize_policy_tools(payload.deny)
    deny_set = set(deny)
    allow = [name for name in allow if name not in deny_set]

    policy = _load_platform_tool_policy_config()
    tenants = policy.setdefault("tenants", {})
    tenant_policy = tenants.setdefault(tenant, {})
    users = tenant_policy.setdefault("users", {})
    users[user_id] = {"allow": allow, "deny": deny}

    _save_platform_tool_policy_config(policy)
    tool_authorization_policy = _build_tool_authorization_policy()

    return _platform_tool_policy_payload(user_id=user_id, tenant=tenant)


@app.get("/enterprise/platform/connectors/configs")
async def enterprise_platform_connector_configs() -> dict[str, Any]:
    """Return tenant connector configurations without exposing secrets."""
    return {"saved_configs": _redacted_connector_configs()}


@app.post("/enterprise/platform/connectors/configs")
async def save_enterprise_platform_connector_config(
    payload: EnterpriseConnectorConfigSaveRequest,
    request: Request,
) -> dict[str, Any]:
    """Persist a tenant-scoped connector configuration."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    configs = _load_platform_connector_configs()
    tenant = payload.tenant.strip() or _configured_tenant_for_user(user_id)
    config = _normalize_connector_config_payload(
        payload,
        user_id=user_id,
        existing_config=configs.get(tenant),
    )
    configs[config["tenant"]] = config
    _save_platform_connector_configs(configs)
    return {
        "config": _redact_connector_config(config),
        "saved_configs": _redacted_connector_configs(),
    }


@app.post("/enterprise/platform/connectors/test")
async def test_enterprise_platform_connector(
    payload: EnterpriseConnectorTestRequest,
) -> dict[str, Any]:
    """Validate an enterprise HTTP connector against core business endpoints."""
    base_url = payload.base_url.strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=400, detail="Enterprise API URL is required.")

    saved_config = _load_platform_connector_configs().get(payload.tenant.strip())
    token = payload.token.strip() if payload.token and payload.token.strip() else None
    if token is None and saved_config is not None:
        saved_token = str(saved_config.get("token") or "").strip()
        token = saved_token or None

    connector = HttpEnterpriseConnector(
        base_url=base_url,
        token=token,
        timeout_seconds=payload.timeout_seconds,
        policy_path=payload.policy_path,
        ticket_path=payload.ticket_path,
        metrics_path=payload.metrics_path,
    )
    checks = []
    test_cases = [
        (
            "policy",
            "Policy lookup",
            lambda: connector.lookup_policy(payload.tenant, payload.policy_keyword),
        ),
        (
            "ticket",
            "Ticket lookup",
            lambda: connector.get_ticket_status(payload.tenant, payload.ticket_id),
        ),
        (
            "metrics",
            "Department metrics",
            lambda: connector.summarize_department_metrics(
                payload.tenant,
                payload.department,
            ),
        ),
    ]

    for name, label, run_test in test_cases:
        started_at = perf_counter()
        try:
            result = run_test()
        except Exception as exc:  # pragma: no cover - depends on remote gateways
            checks.append(
                {
                    "name": name,
                    "label": label,
                    "status": "error",
                    "latency_ms": round((perf_counter() - started_at) * 1000, 2),
                    "message": str(exc),
                    "preview": "",
                },
            )
            continue

        checks.append(
            {
                "name": name,
                "label": label,
                "status": "success",
                "latency_ms": round((perf_counter() - started_at) * 1000, 2),
                "message": "Connector request completed.",
                "preview": _preview_connector_result(result),
            },
        )

    success_count = sum(1 for check in checks if check["status"] == "success")
    if success_count == len(checks):
        status = "success"
    elif success_count:
        status = "partial"
    else:
        status = "error"

    return {
        "status": status,
        "checks": checks,
    }


@app.get("/enterprise/platform/config/export")
async def export_enterprise_platform_config() -> dict[str, Any]:
    """Export portable platform configuration without runtime data or secrets."""
    return _export_platform_config()


@app.post("/enterprise/platform/config/import")
async def import_enterprise_platform_config(
    payload: EnterprisePlatformConfigImportRequest,
    request: Request,
) -> dict[str, Any]:
    """Import portable platform configuration by merging or replacing sections."""
    global tool_authorization_policy

    mode = payload.mode.strip().lower()
    if mode not in {"merge", "replace"}:
        raise HTTPException(status_code=400, detail="mode must be merge or replace.")

    actor = request.headers.get("X-User-ID") or "acme:alice"
    incoming = payload.config.get("config", payload.config)
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=400, detail="config must be a JSON object.")

    if "members" in incoming:
        imported_members = _normalize_import_members(incoming.get("members"), actor)
        members = (
            imported_members
            if mode == "replace"
            else _merge_by_key(
                _platform_member_registry(include_inactive=True),
                imported_members,
                "user_id",
            )
        )
        _save_platform_members_config({"members": members})

    if "connector_configs" in incoming:
        existing_configs = _load_platform_connector_configs()
        imported_configs = _normalize_import_connector_configs(
            incoming.get("connector_configs"),
            existing_configs,
            actor,
        )
        if mode == "replace":
            configs = {config["tenant"]: config for config in imported_configs}
        else:
            configs = {
                **existing_configs,
                **{config["tenant"]: config for config in imported_configs},
            }
        _save_platform_connector_configs(configs)

    if "agents" in incoming:
        imported_agents = _normalize_import_agents(incoming.get("agents"))
        agents = (
            imported_agents
            if mode == "replace"
            else _merge_by_key(_load_platform_agents(), imported_agents, "id")
        )
        _save_platform_agents(agents)

    if "workflow_templates" in incoming:
        imported_workflows = _normalize_import_workflow_templates(
            incoming.get("workflow_templates"),
        )
        workflows = (
            imported_workflows
            if mode == "replace"
            else _merge_by_key(
                _load_platform_workflow_templates(),
                imported_workflows,
                "workflow_type",
            )
        )
        _save_platform_workflow_templates(workflows)

    if "tool_policy" in incoming:
        raw_policy = incoming.get("tool_policy")
        if not isinstance(raw_policy, dict):
            raise HTTPException(
                status_code=400,
                detail="tool_policy must be a JSON object.",
            )
        policy = (
            raw_policy
            if mode == "replace"
            else _deep_merge_dict(_load_platform_tool_policy_config(), raw_policy)
        )
        _save_platform_tool_policy_config(policy)
        tool_authorization_policy = _build_tool_authorization_policy()

    exported = _export_platform_config()
    return {
        "imported": True,
        "mode": mode,
        "counts": exported["counts"],
        "config": exported,
    }


@app.get("/enterprise/platform/agents")
async def enterprise_platform_agents() -> dict[str, Any]:
    """Return platform agent templates and published tenant instances."""
    return {
        "templates": _platform_agent_template_metadata(),
        "agents": [
            _platform_agent_response(agent) for agent in _load_platform_agents()
        ],
    }


@app.post("/enterprise/platform/agents/publish")
async def publish_enterprise_platform_agent(
    payload: EnterpriseAgentPublishRequest,
    request: Request,
) -> dict[str, Any]:
    """Publish one business template as a tenant-scoped platform agent."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    model_config_id = (payload.model_config_id or "").strip() or None
    knowledge_base_ids = _normalize_platform_resource_ids(payload.knowledge_base_ids)
    await _validate_platform_agent_resources(
        request,
        user_id,
        model_config_id=model_config_id,
        knowledge_base_ids=knowledge_base_ids,
    )
    agent, agents = _create_platform_agent(payload, user_id)
    return {
        "agent": _platform_agent_response(agent),
        "agents": [_platform_agent_response(item) for item in agents],
    }


@app.patch("/enterprise/platform/agents/{agent_id}")
async def update_enterprise_platform_agent(
    agent_id: str,
    payload: EnterpriseAgentUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update a tenant-scoped platform agent instance."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    existing_agent = _get_platform_agent(agent_id)
    changes = payload.model_dump(exclude_unset=True)
    if "model_config_id" in changes:
        model_config_id = (payload.model_config_id or "").strip() or None
    else:
        model_config_id = (
            str(existing_agent.get("model_config_id") or "").strip() or None
        )
    if "knowledge_base_ids" in changes:
        knowledge_base_ids = _normalize_platform_resource_ids(
            payload.knowledge_base_ids,
        )
    else:
        knowledge_base_ids = _normalize_platform_resource_ids(
            existing_agent.get("knowledge_base_ids"),
        )
    await _validate_platform_agent_resources(
        request,
        user_id,
        model_config_id=model_config_id,
        knowledge_base_ids=knowledge_base_ids,
    )
    agent, agents = _update_platform_agent(agent_id, payload, user_id)
    return {
        "agent": _platform_agent_response(agent),
        "agents": [_platform_agent_response(item) for item in agents],
    }


@app.delete("/enterprise/platform/agents/{agent_id}")
async def archive_enterprise_platform_agent(
    agent_id: str,
    request: Request,
) -> dict[str, Any]:
    """Archive a platform agent while keeping its registry record."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    agent, agents = _archive_platform_agent(agent_id, user_id)
    return {
        "agent": _platform_agent_response(agent),
        "agents": [_platform_agent_response(item) for item in agents],
    }


@app.get("/enterprise/platform/tools")
async def enterprise_platform_tools(
    request: Request,
    agent_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Return tool catalog metadata, authorization, bindings, and stats."""
    resolved_user_id = user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(resolved_user_id)
    tenant = str(runtime["tenant"])
    published_agents = [
        agent
        for agent in _load_platform_agents()
        if agent.get("status") == "published"
    ]
    configured_agent = None
    if agent_id:
        configured_agent = next(
            (
                agent
                for agent in published_agents
                if str(agent.get("id")) == agent_id
            ),
            None,
        )
        if configured_agent is None:
            raise HTTPException(
                status_code=404,
                detail=f"Unknown published platform agent: {agent_id}",
            )

    configured_agent_tools = (
        set(configured_agent.get("tools") or []) if configured_agent else set()
    )
    decisions = {
        decision["name"]: decision
        for decision in tool_authorization_policy.describe_for_user(
            tenant,
            resolved_user_id,
            ENTERPRISE_TOOL_NAMES,
        )
    }
    tools = []
    for tool_name in ENTERPRISE_TOOL_NAMES:
        catalog = ENTERPRISE_TOOL_CATALOG[tool_name]
        events = tool_audit_logger.query(
            user_id=resolved_user_id,
            tool_name=tool_name,
            limit=200,
        )
        decision = decisions.get(tool_name)
        tools.append(
            {
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
                "stats": _tool_audit_stats(events),
            },
        )
    return {
        "tools": tools,
        "user_id": resolved_user_id,
        "tenant": tenant,
        "connector": runtime["connector_label"],
        "connector_source": runtime["connector_source"],
        "agent_id": agent_id,
    }


@app.get("/enterprise/platform/audit")
async def enterprise_platform_audit(
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    tool_name: str | None = None,
    success: bool | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Return filtered enterprise tool audit events."""
    normalized_limit = max(1, min(limit, 200))
    events = tool_audit_logger.query(
        tenant=tenant,
        user_id=user_id,
        agent_id=agent_id,
        tool_name=tool_name,
        success=success,
        limit=normalized_limit,
    )
    return {
        "events": events,
        "summary": _audit_query_summary(events),
        "filters": {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "success": success,
        },
        "limit": normalized_limit,
    }


@app.post("/enterprise/platform/tools/run")
async def run_enterprise_tool(
    payload: EnterpriseToolRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run one tenant-aware enterprise tool from the platform console."""
    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    runner_agent_id = "platform-console"
    configured_agent_id = (payload.agent_id or "").strip()
    if configured_agent_id:
        agent = _get_platform_agent(configured_agent_id)
        if agent.get("status") != "published":
            raise HTTPException(
                status_code=409,
                detail="该 Agent 实例已停用，不能运行。",
            )
        _assert_platform_agent_access(agent, user_id)
        runner_agent_id = configured_agent_id
        if payload.tool_name not in set(agent.get("tools") or []):
            runtime = _enterprise_runtime_context(user_id)
            decision = _agent_tool_denial(payload.tool_name)
            return {
                "tool_name": payload.tool_name,
                "allowed": False,
                "tenant": runtime["tenant"],
                "user_id": user_id,
                "connector": runtime["connector_label"],
                "connector_source": runtime["connector_source"],
                "decision": decision,
            }

    approval_id = None
    if payload.tool_name in APPROVAL_REQUIRED_TOOLS:
        approval_id = _require_platform_approval(
            approval_id=payload.approval_id,
            request_type="tool_run",
            target_key="tool_name",
            target_value=payload.tool_name,
            tenant=str(runtime["tenant"]),
            user_id=user_id,
            agent_id=runner_agent_id,
            inputs=payload.inputs,
        )

    response = _run_authorized_enterprise_tool(
        user_id=user_id,
        tool_name=payload.tool_name,
        inputs=payload.inputs,
        agent_id=runner_agent_id,
        session_id="platform-console",
    )
    if approval_id:
        response["approval_id"] = approval_id
    return response


@app.post("/enterprise/platform/agent/run")
async def run_enterprise_agent(
    payload: EnterpriseAgentRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Route a business question through a published enterprise agent."""
    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])
    question = payload.question.strip()
    agent = _get_platform_agent(payload.agent_id) if payload.agent_id else None
    if agent is not None and agent.get("status") != "published":
        raise HTTPException(
            status_code=409,
            detail="该 Agent 实例已停用，不能运行。",
        )
    if agent is not None:
        _assert_platform_agent_access(agent, user_id)

    agent_metadata = _platform_agent_run_metadata(agent)
    configured_tools = (
        set(agent_metadata["configured_tools"])
        if agent is not None
        else set(ENTERPRISE_TOOL_NAMES)
    )
    runner_agent_id = (
        str(agent_metadata["agent_id"])
        if agent_metadata.get("agent_id")
        else "platform-agent-runner"
    )
    runner_session_id = (payload.session_id or "").strip() or (
        f"platform-agent:{runner_agent_id}:{_safe_path_part(user_id)}"
    )
    memory_enabled = bool(agent_metadata.get("memory_enabled", False))
    memory_hits = (
        _search_platform_memories(
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            question=question,
        )
        if memory_enabled
        else []
    )
    memory_payload = {
        "memory_enabled": memory_enabled,
        "memory_hits": memory_hits,
        "memory_scope": {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": runner_agent_id,
        },
    }
    knowledge_hits, knowledge_error = await _search_agent_knowledge_bases(
        request,
        user_id=user_id,
        question=question,
        knowledge_base_ids=list(agent_metadata.get("knowledge_base_ids") or []),
    )
    knowledge_payload = {
        "knowledge_hits": knowledge_hits,
        **({"knowledge_error": knowledge_error} if knowledge_error else {}),
    }
    routes, routing_error = await _select_enterprise_agent_routes(question)
    routing_mode = _enterprise_routing_mode(routes)
    routing_source = routing_mode

    if not routes:
        route = _route_enterprise_agent_question(question)
        decision = {
            "reason": route["reason"],
            "routing_reason": route["reason"],
            "routing_source": routing_source,
            "routing_mode": routing_mode,
        }
        if routing_error:
            decision["routing_error"] = routing_error
        answer = (
            _format_knowledge_answer(knowledge_hits)
            if knowledge_hits
            else (
                _format_memory_answer(memory_hits)
                if memory_hits
                else (
                    "这个演示 Agent 暂时只会处理三类问题：工单状态、制度查询、"
                    "部门指标。你可以试试：帮我查一下 INC-1001 的工单状态。"
                )
            )
        )
        memory_saved = False
        if memory_enabled and not _question_is_memory_lookup(question):
            _append_platform_memory(
                tenant=tenant,
                user_id=user_id,
                agent_id=runner_agent_id,
                session_id=runner_session_id,
                question=question,
                answer=answer,
                tool_calls=[],
                knowledge_base_ids=list(
                    agent_metadata.get("knowledge_base_ids") or [],
                ),
            )
            memory_saved = True

        turn_id = uuid4().hex
        created_at = _now_iso()
        evidence = _build_agent_run_evidence(
            turn_id=turn_id,
            created_at=created_at,
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            tool_calls=[],
            knowledge_hits=knowledge_hits,
            memory_hits=memory_hits,
            memory_saved=memory_saved,
        )
        response = {
            "answer": answer,
            "routed": False,
            "turn_id": turn_id,
            "session_id": runner_session_id,
            "tenant": tenant,
            "user_id": user_id,
            "connector": connector_label,
            "connector_source": connector_source,
            "routing_mode": routing_mode,
            "routing_source": routing_source,
            "routing_reason": route["reason"],
            **({"routing_error": routing_error} if routing_error else {}),
            **agent_metadata,
            **knowledge_payload,
            **memory_payload,
            "memory_saved": memory_saved,
            "decision": decision,
            "tool_calls": [],
            "evidence": evidence,
        }
        _append_platform_agent_run(
            {
                "turn_id": turn_id,
                "session_id": runner_session_id,
                "agent_id": runner_agent_id,
                "agent_name": agent_metadata.get("agent_name"),
                "tenant": tenant,
                "user_id": user_id,
                "question": question,
                "answer": answer,
                "created_at": created_at,
                "evidence": evidence,
                "response": response,
            },
        )
        return response

    tool_calls: list[dict[str, Any]] = []
    for route in routes:
        tool_name = str(route["tool_name"])
        route_inputs = dict(route["inputs"])
        route_reason = str(route.get("reason", "Matched enterprise tool route."))
        route_source = str(route.get("source", ROUTING_SOURCE_RULES))

        if tool_name not in configured_tools:
            denial = _agent_tool_denial(tool_name)
            reason = str(denial["reason"])
            decision = {
                **denial,
                "routing_reason": route_reason,
                "routing_source": route_source,
                "routing_mode": routing_mode,
            }
            if routing_error:
                decision["routing_error"] = routing_error

            tool_calls.append(
                {
                    "tool_name": tool_name,
                    "inputs": route_inputs,
                    "allowed": False,
                    "tenant": tenant,
                    "user_id": user_id,
                    "connector": connector_label,
                    "connector_source": connector_source,
                    "routing_source": route_source,
                    "routing_reason": route_reason,
                    "decision": decision,
                    "answer": reason,
                },
            )
            continue

        approved_by: str | None = None
        if tool_name in APPROVAL_REQUIRED_TOOLS:
            try:
                approved_by = _require_platform_approval(
                    approval_id=payload.approval_id,
                    request_type="tool_run",
                    target_key="tool_name",
                    target_value=tool_name,
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=runner_agent_id,
                    inputs=route_inputs,
                )
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, dict) else {}
                if exc.status_code != 403 or not detail.get("approval_required"):
                    raise

                approval = _create_platform_approval_request(
                    request_type="tool_run",
                    tenant=tenant,
                    user_id=user_id,
                    agent_id=runner_agent_id,
                    tool_name=tool_name,
                    inputs=route_inputs,
                    reason=str(
                        detail.get(
                            "message",
                            "该工具需要审批后才能运行。",
                        ),
                    ),
                    requested_by=request.headers.get("X-User-ID") or user_id,
                )
                approval_id = str(approval["approval_id"])
                approval_message = (
                    f"该工具需要审批，已自动创建审批请求 {approval_id}。"
                    "请到审批中心批准后再运行。"
                )
                decision = {
                    "allowed": False,
                    "reason": detail.get(
                        "message",
                        "该工具需要审批后才能运行。",
                    ),
                    "approval_required": True,
                    "approval_id": approval_id,
                    "approval_status": "pending",
                    "routing_reason": route_reason,
                    "routing_source": route_source,
                    "routing_mode": routing_mode,
                    **({"routing_error": routing_error} if routing_error else {}),
                }
                tool_calls.append(
                    {
                        "tool_name": tool_name,
                        "inputs": route_inputs,
                        "allowed": False,
                        "approval_required": True,
                        "approval_id": approval_id,
                        "approval_status": "pending",
                        "tenant": tenant,
                        "user_id": user_id,
                        "connector": connector_label,
                        "connector_source": connector_source,
                        "routing_source": route_source,
                        "routing_reason": route_reason,
                        "decision": decision,
                        "answer": approval_message,
                    },
                )
                continue

        tool_response = _run_authorized_enterprise_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=route_inputs,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            fail_on_denied=False,
        )
        decision = {
            **tool_response["decision"],
            "routing_reason": route_reason,
            "routing_source": route_source,
            "routing_mode": routing_mode,
            **({"routing_error": routing_error} if routing_error else {}),
        }
        call_answer = _format_enterprise_agent_answer(
            tool_name=tool_name,
            result=tool_response.get("result"),
            tenant=tool_response["tenant"],
        )
        tool_calls.append(
            {
                "tool_name": tool_name,
                "inputs": route_inputs,
                "allowed": bool(tool_response.get("allowed")),
                "tenant": tool_response["tenant"],
                "user_id": tool_response["user_id"],
                "connector": tool_response.get("connector", connector_label),
                "connector_source": tool_response.get(
                    "connector_source",
                    connector_source,
                ),
                "routing_source": route_source,
                "routing_reason": route_reason,
                "approval_id": approved_by,
                "decision": decision,
                "result": tool_response.get("result"),
                "answer": call_answer,
            },
        )

    executed_tool_calls = [call for call in tool_calls if call.get("allowed")]
    primary_call = executed_tool_calls[0] if executed_tool_calls else tool_calls[0]
    routing_reason = "; ".join(
        f"{call['tool_name']}: {call.get('routing_reason', '')}"
        for call in tool_calls
    )
    answer_parts = [
        f"工具 {call['tool_name']}: {call['answer']}"
        for call in tool_calls
        if call.get("answer")
    ]
    if knowledge_hits:
        answer_parts.append(f"知识库: {_format_knowledge_answer(knowledge_hits)}")
    if memory_hits:
        answer_parts.insert(0, f"长期记忆: {_format_memory_answer(memory_hits)}")
    answer = "\n\n".join(answer_parts)
    memory_saved = False
    if memory_enabled and not _question_is_memory_lookup(question):
        _append_platform_memory(
            tenant=tenant,
            user_id=user_id,
            agent_id=runner_agent_id,
            session_id=runner_session_id,
            question=question,
            answer=answer,
            tool_calls=tool_calls,
            knowledge_base_ids=list(agent_metadata.get("knowledge_base_ids") or []),
        )
        memory_saved = True

    turn_id = uuid4().hex
    created_at = _now_iso()
    evidence = _build_agent_run_evidence(
        turn_id=turn_id,
        created_at=created_at,
        tenant=primary_call.get("tenant", tenant),
        user_id=primary_call.get("user_id", user_id),
        agent_id=runner_agent_id,
        session_id=runner_session_id,
        tool_calls=tool_calls,
        knowledge_hits=knowledge_hits,
        memory_hits=memory_hits,
        memory_saved=memory_saved,
    )
    response = {
        "answer": answer,
        "routed": bool(executed_tool_calls),
        "turn_id": turn_id,
        "session_id": runner_session_id,
        "tool_name": primary_call.get("tool_name"),
        "inputs": primary_call.get("inputs"),
        "tenant": primary_call.get("tenant", tenant),
        "user_id": primary_call.get("user_id", user_id),
        "connector": primary_call.get("connector", connector_label),
        "connector_source": primary_call.get("connector_source", connector_source),
        "routing_mode": routing_mode,
        "routing_source": routing_source,
        "routing_reason": routing_reason,
        **({"routing_error": routing_error} if routing_error else {}),
        **agent_metadata,
        "decision": primary_call.get("decision"),
        "result": primary_call.get("result"),
        "tool_calls": tool_calls,
        **knowledge_payload,
        **memory_payload,
        "memory_saved": memory_saved,
        "evidence": evidence,
    }
    _append_platform_agent_run(
        {
            "turn_id": turn_id,
            "session_id": runner_session_id,
            "agent_id": runner_agent_id,
            "agent_name": agent_metadata.get("agent_name"),
            "tenant": tenant,
            "user_id": user_id,
            "question": question,
            "answer": answer,
            "created_at": created_at,
            "evidence": evidence,
            "response": response,
        },
    )
    return response


@app.get("/enterprise/platform/agent/runs")
async def list_enterprise_agent_runs(
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent enterprise agent question-answer turns."""
    return {
        "runs": _load_platform_agent_runs(
            limit=limit,
            agent_id=(agent_id or "").strip() or None,
            tenant=(tenant or "").strip() or None,
            user_id=(user_id or "").strip() or None,
            session_id=(session_id or "").strip() or None,
        ),
    }


@app.get("/enterprise/platform/agent/runs/{turn_id}")
async def get_enterprise_agent_run(turn_id: str) -> dict[str, Any]:
    """Get a single enterprise agent question-answer turn by run ID."""
    run = _get_platform_agent_run(turn_id.strip())
    if run is None:
        raise HTTPException(status_code=404, detail="Agent run not found.")
    return run


@app.delete("/enterprise/platform/agent/runs")
async def clear_enterprise_agent_runs(
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Clear matching enterprise agent question-answer turns."""
    deleted_count = _delete_platform_agent_runs(
        agent_id=(agent_id or "").strip() or None,
        tenant=(tenant or "").strip() or None,
        user_id=(user_id or "").strip() or None,
        session_id=(session_id or "").strip() or None,
    )
    return {"deleted_count": deleted_count}


def _workflow_input(
    inputs: dict[str, Any],
    key: str,
    default: str = "",
) -> str:
    value = inputs.get(key)
    if value is None:
        return default

    normalized = str(value).strip()
    return normalized or default


def _default_workflow_templates() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
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


def _save_platform_workflow_templates(workflows: list[dict[str, Any]]) -> None:
    PLATFORM_WORKFLOW_TEMPLATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLATFORM_WORKFLOW_TEMPLATES_PATH.write_text(
        json.dumps(workflows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_platform_workflow_templates() -> list[dict[str, Any]]:
    if not PLATFORM_WORKFLOW_TEMPLATES_PATH.exists():
        workflows = _default_workflow_templates()
        _save_platform_workflow_templates(workflows)
        return workflows

    try:
        workflows = json.loads(
            PLATFORM_WORKFLOW_TEMPLATES_PATH.read_text(encoding="utf-8"),
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail="Platform workflow registry is not valid JSON.",
        ) from exc

    if not isinstance(workflows, list):
        raise HTTPException(
            status_code=500,
            detail="Platform workflow registry must be a JSON array.",
        )

    return [workflow for workflow in workflows if isinstance(workflow, dict)]


def _get_platform_workflow_template(workflow_type: str) -> dict[str, Any]:
    for workflow in _load_platform_workflow_templates():
        if str(workflow.get("workflow_type", "")).strip() == workflow_type:
            return workflow

    raise HTTPException(
        status_code=400,
        detail=f"Unknown enterprise workflow: {workflow_type}",
    )


def _workflow_input_value(
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


def _normalize_workflow_inputs(
    inputs: dict[str, Any],
    default_inputs: dict[str, Any],
) -> dict[str, str]:
    keys = set(default_inputs) | set(inputs)
    return {
        key: _workflow_input_value(inputs, default_inputs, key)
        for key in sorted(keys)
    }


def _build_workflow_step_specs(
    template: dict[str, Any],
    inputs: dict[str, str],
) -> list[tuple[str, str, str, dict[str, Any]]]:
    raw_steps = template.get("steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        raise HTTPException(
            status_code=400,
            detail=f"Workflow {template.get('workflow_type')} has no runnable steps.",
        )

    step_specs: list[tuple[str, str, str, dict[str, Any]]] = []
    for index, raw_step in enumerate(raw_steps, start=1):
        if not isinstance(raw_step, dict):
            continue

        tool_name = str(raw_step.get("tool_name", "")).strip()
        if tool_name not in ENTERPRISE_TOOL_NAMES:
            raise HTTPException(
                status_code=400,
                detail=f"Workflow step uses an unknown tool: {tool_name}",
            )

        input_map = raw_step.get("input_map")
        if not isinstance(input_map, dict):
            catalog = ENTERPRISE_TOOL_CATALOG[tool_name]
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
        raise HTTPException(
            status_code=400,
            detail=f"Workflow {template.get('workflow_type')} has no valid steps.",
        )

    return step_specs


def _workflow_status_counts(steps: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"success": 0, "denied": 0, "failed": 0}
    for step in steps:
        status = str(step.get("status") or "failed")
        counts[status] = counts.get(status, 0) + 1
    return counts


def _workflow_run_status(counts: dict[str, int]) -> str:
    if counts.get("failed", 0) == 0 and counts.get("denied", 0) == 0:
        return "completed"
    if counts.get("success", 0) > 0:
        return "partial"
    return "failed"


def _append_workflow_run(record: dict[str, Any]) -> None:
    PLATFORM_WORKFLOW_RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PLATFORM_WORKFLOW_RUNS_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False, default=str))
        file.write("\n")


def _load_workflow_runs(
    *,
    limit: int = 20,
    workflow_type: str | None = None,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    if not PLATFORM_WORKFLOW_RUNS_PATH.exists():
        return []

    bounded_limit = min(max(limit, 1), 100)
    records: list[dict[str, Any]] = []
    for line in reversed(PLATFORM_WORKFLOW_RUNS_PATH.read_text(encoding="utf-8").splitlines()):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(record, dict):
            continue
        if workflow_type and record.get("workflow_type") != workflow_type:
            continue
        if agent_id and record.get("agent_id") != agent_id:
            continue
        if tenant and record.get("tenant") != tenant:
            continue
        if user_id and record.get("user_id") != user_id:
            continue
        records.append(record)
        if len(records) >= bounded_limit:
            break

    return records


def _enterprise_platform_scenarios() -> dict[str, Any]:
    workflows = _load_platform_workflow_templates()
    workflow_runs = _load_workflow_runs(limit=100)
    pending_approvals = _load_platform_approval_requests(limit=100, status="pending")
    scenarios: list[dict[str, Any]] = []

    for workflow in workflows:
        workflow_type = str(workflow.get("workflow_type", "")).strip()
        steps = workflow.get("steps") if isinstance(workflow.get("steps"), list) else []
        tools = [
            str(step.get("tool_name", "")).strip()
            for step in steps
            if isinstance(step, dict) and str(step.get("tool_name", "")).strip()
        ]
        missing_tools = [tool_name for tool_name in tools if tool_name not in ENTERPRISE_TOOL_CATALOG]
        approval_tools = [
            tool_name for tool_name in tools if tool_name in APPROVAL_REQUIRED_TOOLS
        ]
        approval_required = workflow_type in APPROVAL_REQUIRED_WORKFLOWS or bool(
            approval_tools,
        )
        pending_approval_count = sum(
            1
            for approval in pending_approvals
            if approval.get("workflow_type") == workflow_type
            or approval.get("tool_name") in approval_tools
        )
        matching_runs = [
            run for run in workflow_runs if run.get("workflow_type") == workflow_type
        ]

        if workflow.get("enabled") is False:
            status = "blocked"
            next_action = {"code": "enable_workflow", "target": "workflows"}
        elif missing_tools or approval_required:
            status = "partial"
            next_action = {
                "code": "request_approval" if approval_required else "configure_tools",
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
        "ready": sum(1 for scenario in scenarios if scenario["status"] == "ready"),
        "partial": sum(1 for scenario in scenarios if scenario["status"] == "partial"),
        "blocked": sum(1 for scenario in scenarios if scenario["status"] == "blocked"),
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


def _read_platform_agent_runs() -> list[dict[str, Any]]:
    if not PLATFORM_AGENT_RUNS_PATH.exists():
        return []

    records: list[dict[str, Any]] = []
    for line in PLATFORM_AGENT_RUNS_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            records.append(record)
    return records


def _load_platform_agent_runs(
    *,
    limit: int = 20,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
) -> list[dict[str, Any]]:
    bounded_limit = min(max(limit, 1), 100)
    records: list[dict[str, Any]] = []
    for record in reversed(_read_platform_agent_runs()):
        if agent_id and record.get("agent_id") != agent_id:
            continue
        if tenant and record.get("tenant") != tenant:
            continue
        if user_id and record.get("user_id") != user_id:
            continue
        if session_id and record.get("session_id") != session_id:
            continue
        records.append(record)
        if len(records) >= bounded_limit:
            break
    return records


def _get_platform_agent_run(turn_id: str) -> dict[str, Any] | None:
    if not turn_id:
        return None

    for record in reversed(_read_platform_agent_runs()):
        if record.get("turn_id") == turn_id:
            return record
    return None


def _append_platform_agent_run(record: dict[str, Any]) -> None:
    PLATFORM_AGENT_RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PLATFORM_AGENT_RUNS_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False, default=str))
        file.write("\n")


def _build_agent_run_evidence(
    *,
    turn_id: str,
    created_at: str,
    tenant: str,
    user_id: str,
    agent_id: str,
    session_id: str,
    tool_calls: list[dict[str, Any]],
    knowledge_hits: list[dict[str, Any]],
    memory_hits: list[dict[str, Any]],
    memory_saved: bool,
) -> dict[str, Any]:
    """Build a compact evidence summary for enterprise traceability."""
    allowed_tool_calls = [call for call in tool_calls if call.get("allowed")]
    denied_tool_calls = [call for call in tool_calls if call.get("allowed") is False]
    approval_required_calls = [
        call for call in tool_calls if call.get("approval_required")
    ]
    approval_ids = sorted(
        {
            str(call.get("approval_id"))
            for call in tool_calls
            if call.get("approval_id")
        },
    )
    tool_names = [
        str(call.get("tool_name"))
        for call in tool_calls
        if call.get("tool_name")
    ]
    audit_filter: dict[str, Any] = {
        "tenant": tenant,
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id,
    }
    if tool_names:
        audit_filter["tool_names"] = sorted(set(tool_names))
    if approval_ids:
        audit_filter["approval_ids"] = approval_ids

    return {
        "run_id": turn_id,
        "turn_id": turn_id,
        "created_at": created_at,
        "tenant": tenant,
        "user_id": user_id,
        "agent_id": agent_id,
        "session_id": session_id,
        "tool_call_count": len(tool_calls),
        "allowed_tool_call_count": len(allowed_tool_calls),
        "denied_tool_call_count": len(denied_tool_calls),
        "approval_required_count": len(approval_required_calls),
        "approval_ids": approval_ids,
        "knowledge_hit_count": len(knowledge_hits),
        "memory_hit_count": len(memory_hits),
        "memory_saved": memory_saved,
        "audit_filter": audit_filter,
    }


def _replace_platform_agent_runs(records: list[dict[str, Any]]) -> None:
    PLATFORM_AGENT_RUNS_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(record, ensure_ascii=False, default=str) for record in records]
    PLATFORM_AGENT_RUNS_PATH.write_text(
        "\n".join(lines) + ("\n" if lines else ""),
        encoding="utf-8",
    )


def _delete_platform_agent_runs(
    *,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
) -> int:
    if not any([agent_id, tenant, user_id, session_id]):
        raise HTTPException(
            status_code=400,
            detail="At least one agent run filter is required.",
        )

    kept_records: list[dict[str, Any]] = []
    deleted_count = 0
    for record in _read_platform_agent_runs():
        matched = True
        if agent_id and record.get("agent_id") != agent_id:
            matched = False
        if tenant and record.get("tenant") != tenant:
            matched = False
        if user_id and record.get("user_id") != user_id:
            matched = False
        if session_id and record.get("session_id") != session_id:
            matched = False

        if matched:
            deleted_count += 1
        else:
            kept_records.append(record)

    if deleted_count:
        _replace_platform_agent_runs(kept_records)
    return deleted_count


def _read_platform_approval_requests() -> list[dict[str, Any]]:
    if not PLATFORM_APPROVAL_REQUESTS_PATH.exists():
        return []

    records: list[dict[str, Any]] = []
    for line in PLATFORM_APPROVAL_REQUESTS_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            records.append(record)
    return records


def _load_platform_approval_requests(
    *,
    limit: int = 20,
    status: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
) -> list[dict[str, Any]]:
    bounded_limit = min(max(limit, 1), 100)
    records: list[dict[str, Any]] = []
    for record in reversed(_read_platform_approval_requests()):
        if status and record.get("status") != status:
            continue
        if tenant and record.get("tenant") != tenant:
            continue
        if user_id and record.get("user_id") != user_id:
            continue
        if agent_id and record.get("agent_id") != agent_id:
            continue
        records.append(record)
        if len(records) >= bounded_limit:
            break
    return records


def _append_platform_approval_request(record: dict[str, Any]) -> None:
    PLATFORM_APPROVAL_REQUESTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PLATFORM_APPROVAL_REQUESTS_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False, default=str))
        file.write("\n")


def _create_platform_approval_request(
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
    """Persist a pending approval request for a governed platform action."""
    record = {
        "approval_id": uuid4().hex,
        "status": "pending",
        "tenant": tenant,
        "user_id": user_id,
        "agent_id": agent_id,
        "request_type": request_type,
        "tool_name": tool_name,
        "workflow_type": workflow_type,
        "inputs": dict(inputs),
        "reason": (reason or "").strip() or None,
        "requested_at": _now_iso(),
        "requested_by": requested_by,
        "decided_at": None,
        "decided_by": None,
        "decision_note": None,
    }
    _append_platform_approval_request(record)
    return record


def _replace_platform_approval_requests(records: list[dict[str, Any]]) -> None:
    PLATFORM_APPROVAL_REQUESTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(record, ensure_ascii=False, default=str) for record in records]
    PLATFORM_APPROVAL_REQUESTS_PATH.write_text(
        "\n".join(lines) + ("\n" if lines else ""),
        encoding="utf-8",
    )


def _get_platform_approval_request(approval_id: str) -> dict[str, Any]:
    normalized_id = approval_id.strip()
    for record in _read_platform_approval_requests():
        if record.get("approval_id") == normalized_id:
            return record
    raise HTTPException(status_code=404, detail=f"Unknown approval request: {normalized_id}")


def _require_platform_approval(
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
        raise HTTPException(
            status_code=403,
            detail={
                "approval_required": True,
                "message": "该操作需要先在审批中心批准后才能运行。",
                "request_type": request_type,
                "target_key": target_key,
                "target": target_value,
                "tenant": tenant,
                "user_id": user_id,
                "agent_id": agent_id,
                "inputs": inputs,
            },
        )

    approval = _get_platform_approval_request(normalized_approval_id)
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
        raise HTTPException(
            status_code=403,
            detail={
                "approval_required": True,
                "message": "审批记录与本次操作不匹配，或尚未批准。",
                "request_type": request_type,
                "target_key": target_key,
                "target": target_value,
                "tenant": tenant,
                "user_id": user_id,
                "agent_id": agent_id,
                "inputs": inputs,
            },
        )

    return normalized_approval_id


def _update_platform_approval_request_status(
    *,
    approval_id: str,
    status: str,
    decided_by: str,
    decision_note: str | None,
) -> dict[str, Any]:
    records = _read_platform_approval_requests()
    for index, record in enumerate(records):
        if record.get("approval_id") != approval_id:
            continue
        if record.get("status") != "pending":
            raise HTTPException(
                status_code=409,
                detail=f"Approval request is already {record.get('status')}.",
            )
        updated = {
            **record,
            "status": status,
            "decided_at": _now_iso(),
            "decided_by": decided_by,
            "decision_note": (decision_note or "").strip() or None,
        }
        records[index] = updated
        _replace_platform_approval_requests(records)
        return updated

    raise HTTPException(status_code=404, detail=f"Unknown approval request: {approval_id}")


def _workflow_error_message(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        decision = detail.get("decision")
        if isinstance(decision, dict) and decision.get("reason"):
            return str(decision["reason"])
        if detail.get("detail"):
            return str(detail["detail"])
    return str(detail)


def _workflow_step(
    *,
    user_id: str,
    agent_id: str,
    session_id: str,
    step_id: str,
    title: str,
    tool_name: str,
    inputs: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    try:
        tool_response = _run_authorized_enterprise_tool(
            user_id=user_id,
            tool_name=tool_name,
            inputs=inputs,
            agent_id=agent_id,
            session_id=session_id,
            fail_on_denied=False,
        )
        allowed = bool(tool_response.get("allowed"))
        result = tool_response.get("result")
        decision = tool_response.get("decision")
        message = (
            _format_enterprise_agent_answer(
                tool_name=tool_name,
                result=result,
                tenant=str(tool_response["tenant"]),
            )
            if allowed
            else str((decision or {}).get("reason") or "当前用户无权调用该工具。")
        )
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
            "tenant": tool_response.get("tenant"),
            "user_id": tool_response.get("user_id"),
            "connector": tool_response.get("connector"),
            "connector_source": tool_response.get("connector_source"),
            "decision": decision,
            "result": result,
            "answer": message,
        }
        return step, tool_call
    except HTTPException as exc:
        decision = None
        if isinstance(exc.detail, dict) and isinstance(exc.detail.get("decision"), dict):
            decision = exc.detail["decision"]
        message = _workflow_error_message(exc)
    except Exception as exc:  # pragma: no cover - defensive platform boundary.
        decision = None
        message = f"{exc.__class__.__name__}: {exc}"

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


def _workflow_summary(workflow_name: str, steps: list[dict[str, Any]]) -> str:
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


@app.get("/enterprise/platform/workflows")
async def list_enterprise_workflows() -> dict[str, Any]:
    """List platform-managed workflow templates."""
    return {"workflows": _load_platform_workflow_templates()}


@app.get("/enterprise/platform/scenarios")
async def list_enterprise_platform_scenarios() -> dict[str, Any]:
    """List business scenarios backed by platform-managed workflows."""
    return _enterprise_platform_scenarios()


@app.get("/enterprise/platform/ops/tasks")
async def enterprise_platform_ops_tasks(request: Request) -> dict[str, Any]:
    """List open operator tasks for the current enterprise platform tenant."""
    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    return _enterprise_platform_ops_tasks(
        tenant=tenant,
        user_id=user_id,
        identities=identities,
    )


@app.post("/enterprise/platform/ops/tasks/{task_code}/resolve")
async def resolve_enterprise_platform_ops_task(
    task_code: str,
    request: Request,
) -> dict[str, Any]:
    """Resolve deterministic platform operations tasks from the console."""
    normalized_code = task_code.strip()
    if normalized_code != "disabled_workflows":
        raise HTTPException(
            status_code=400,
            detail=f"Operations task cannot be auto-resolved: {normalized_code}",
        )

    actor = request.headers.get("X-User-ID") or "platform-admin"
    workflows = _load_platform_workflow_templates()
    enabled_workflows: list[dict[str, Any]] = []
    changed = False
    now = _now_iso()
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
        _save_platform_workflow_templates(workflows)

    user_id = request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    identities = _platform_identity_metadata(user_id, tenant)
    return {
        "task_code": normalized_code,
        "resolved": bool(enabled_workflows),
        "message": "Disabled workflows have been enabled."
        if enabled_workflows
        else "No disabled workflows were found.",
        "enabled_workflows": enabled_workflows,
        "workflows": workflows,
        "ops_tasks": _enterprise_platform_ops_tasks(
            tenant=tenant,
            user_id=user_id,
            identities=identities,
        ),
    }


@app.patch("/enterprise/platform/workflows/{workflow_type}")
async def update_enterprise_workflow(
    workflow_type: str,
    payload: EnterpriseWorkflowTemplateUpdateRequest,
    request: Request,
) -> dict[str, Any]:
    """Update mutable workflow template metadata from the platform console."""
    normalized_type = workflow_type.strip()
    workflows = _load_platform_workflow_templates()
    workflow_index = next(
        (
            index
            for index, workflow in enumerate(workflows)
            if str(workflow.get("workflow_type", "")).strip() == normalized_type
        ),
        None,
    )
    if workflow_index is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown enterprise workflow: {normalized_type}",
        )

    workflow = dict(workflows[workflow_index])
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Workflow name cannot be empty.")
        workflow["name"] = name
    if payload.description is not None:
        workflow["description"] = payload.description.strip()
    if payload.enabled is not None:
        workflow["enabled"] = payload.enabled
    if payload.default_inputs is not None:
        workflow["default_inputs"] = dict(payload.default_inputs)

    workflow["updated_at"] = _now_iso()
    workflow["updated_by"] = request.headers.get("X-User-ID") or "platform-admin"
    workflows[workflow_index] = workflow
    _save_platform_workflow_templates(workflows)
    return {"workflow": workflow, "workflows": workflows}


@app.get("/enterprise/platform/workflows/runs")
async def list_enterprise_workflow_runs(
    workflow_type: str | None = None,
    agent_id: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform workflow runs for review and audit."""
    return {
        "runs": _load_workflow_runs(
            limit=limit,
            workflow_type=(workflow_type or "").strip() or None,
            agent_id=(agent_id or "").strip() or None,
            tenant=(tenant or "").strip() or None,
            user_id=(user_id or "").strip() or None,
        ),
    }


@app.get("/enterprise/platform/approvals")
async def list_enterprise_approval_requests(
    status: str | None = None,
    tenant: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """List recent platform governance approval requests."""
    normalized_status = (status or "").strip() or None
    if normalized_status and normalized_status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail=f"Unknown approval status: {normalized_status}")
    return {
        "approvals": _load_platform_approval_requests(
            limit=limit,
            status=normalized_status,
            tenant=(tenant or "").strip() or None,
            user_id=(user_id or "").strip() or None,
            agent_id=(agent_id or "").strip() or None,
        ),
    }


@app.post("/enterprise/platform/approvals")
async def create_enterprise_approval_request(
    payload: EnterpriseApprovalCreateRequest,
    request: Request,
) -> dict[str, Any]:
    """Create a pending approval request for a high-risk platform action."""
    request_type = payload.request_type.strip()
    if request_type not in {"tool_run", "workflow_run", "agent_action"}:
        raise HTTPException(status_code=400, detail=f"Unknown approval type: {request_type}")

    tool_name = (payload.tool_name or "").strip() or None
    workflow_type = (payload.workflow_type or "").strip() or None
    if request_type == "tool_run" and not tool_name:
        raise HTTPException(status_code=400, detail="tool_name is required for tool approvals.")
    if request_type == "workflow_run" and not workflow_type:
        raise HTTPException(
            status_code=400,
            detail="workflow_type is required for workflow approvals.",
        )
    if tool_name and tool_name not in ENTERPRISE_TOOL_CATALOG:
        raise HTTPException(status_code=400, detail=f"Unknown enterprise tool: {tool_name}")
    if workflow_type:
        _get_platform_workflow_template(workflow_type)

    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    runtime = _enterprise_runtime_context(user_id)
    default_agent_id = "platform-workflow" if request_type == "workflow_run" else "platform-console"
    record = _create_platform_approval_request(
        request_type=request_type,
        tenant=str(runtime["tenant"]),
        user_id=user_id,
        agent_id=(payload.agent_id or "").strip() or default_agent_id,
        tool_name=tool_name,
        workflow_type=workflow_type,
        inputs=payload.inputs,
        reason=payload.reason,
        requested_by=request.headers.get("X-User-ID") or user_id,
    )
    return {"approval": record}


@app.post("/enterprise/platform/approvals/{approval_id}/approve")
async def approve_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Approve a pending platform governance request."""
    decided_by = (
        (payload.decided_by or "").strip()
        or request.headers.get("X-User-ID")
        or "platform-admin"
    )
    approval = _update_platform_approval_request_status(
        approval_id=approval_id,
        status="approved",
        decided_by=decided_by,
        decision_note=payload.decision_note,
    )
    return {"approval": approval}


@app.post("/enterprise/platform/approvals/{approval_id}/reject")
async def reject_enterprise_approval_request(
    approval_id: str,
    payload: EnterpriseApprovalDecisionRequest,
    request: Request,
) -> dict[str, Any]:
    """Reject a pending platform governance request."""
    decided_by = (
        (payload.decided_by or "").strip()
        or request.headers.get("X-User-ID")
        or "platform-admin"
    )
    approval = _update_platform_approval_request_status(
        approval_id=approval_id,
        status="rejected",
        decided_by=decided_by,
        decision_note=payload.decision_note,
    )
    return {"approval": approval}


@app.post("/enterprise/platform/workflows/run")
async def run_enterprise_workflow(
    payload: EnterpriseWorkflowRunRequest,
    request: Request,
) -> dict[str, Any]:
    """Run a predefined enterprise automation workflow from the platform."""
    user_id = payload.user_id or request.headers.get("X-User-ID") or "acme:alice"
    requested_agent_id = (payload.agent_id or "").strip()
    agent_id = requested_agent_id or "platform-workflow"
    configured_tools: set[str] | None = None
    if requested_agent_id:
        agent = _get_platform_agent(requested_agent_id)
        if agent.get("status") != "published":
            raise HTTPException(
                status_code=409,
                detail="该 Agent 实例已停用，不能运行。",
            )
        _assert_platform_agent_access(agent, user_id)
        configured_tools = set(agent.get("tools") or [])

    workflow_type = payload.workflow_type.strip()
    workflow_template = _get_platform_workflow_template(workflow_type)
    if workflow_template.get("enabled") is False:
        raise HTTPException(
            status_code=400,
            detail=f"Workflow is disabled: {workflow_type}",
        )

    runtime = _enterprise_runtime_context(user_id)
    tenant = str(runtime["tenant"])
    connector_label = str(runtime["connector_label"])
    connector_source = str(runtime["connector_source"])
    run_id = uuid4().hex
    session_id = f"platform-workflow:{workflow_type}:{run_id[:8]}"
    started_at = _now_iso()
    workflow_name = str(workflow_template.get("name") or workflow_type)
    default_inputs = workflow_template.get("default_inputs")
    if not isinstance(default_inputs, dict):
        default_inputs = {}
    normalized_inputs = _normalize_workflow_inputs(payload.inputs, default_inputs)
    step_specs = _build_workflow_step_specs(workflow_template, normalized_inputs)
    approval_required_tools = sorted(
        {
            tool_name
            for _step_id, _title, tool_name, _step_inputs in step_specs
            if tool_name in APPROVAL_REQUIRED_TOOLS
        },
    )

    approval_id = None
    if workflow_type in APPROVAL_REQUIRED_WORKFLOWS or approval_required_tools:
        approval_id = _require_platform_approval(
            approval_id=payload.approval_id,
            request_type="workflow_run",
            target_key="workflow_type",
            target_value=workflow_type,
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            inputs=normalized_inputs,
        )

    steps: list[dict[str, Any]] = []
    tool_calls: list[dict[str, Any]] = []
    for step_id, title, tool_name, step_inputs in step_specs:
        if configured_tools is not None and tool_name not in configured_tools:
            decision = _agent_tool_denial(tool_name)
            message = str(decision["reason"])
            step = {
                "id": step_id,
                "title": title,
                "tool_name": tool_name,
                "inputs": step_inputs,
                "status": "denied",
                "decision": decision,
                "message": message,
            }
            tool_call = {
                "tool_name": tool_name,
                "inputs": step_inputs,
                "allowed": False,
                "tenant": tenant,
                "user_id": user_id,
                "connector": connector_label,
                "connector_source": connector_source,
                "decision": decision,
                "answer": message,
            }
        else:
            step, tool_call = _workflow_step(
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
                step_id=step_id,
                title=title,
                tool_name=tool_name,
                inputs=step_inputs,
            )
        steps.append(step)
        tool_calls.append(tool_call)

    finished_at = _now_iso()
    status_counts = _workflow_status_counts(steps)
    status = _workflow_run_status(status_counts)
    response = {
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
        "connector": connector_label,
        "connector_source": connector_source,
        "approval_id": approval_id,
        "inputs": normalized_inputs,
        "summary": _workflow_summary(workflow_name, steps),
        "steps": steps,
        "tool_calls": tool_calls,
        "audit_filter": {
            "tenant": tenant,
            "user_id": user_id,
            "agent_id": agent_id,
            "session_id": session_id,
        },
    }
    _append_workflow_run(response)
    return response


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "1") != "0",
    )
