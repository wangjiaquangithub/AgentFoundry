# -*- coding: utf-8 -*-
"""Smoke test for the enterprise agent platform example.

Run from the repository root with:
    uv run --extra service --extra storage --extra rag python examples/enterprise_knowledge_assistant/smoke_test_platform.py
"""
from __future__ import annotations

import json
import sys
import threading
import atexit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient


EXAMPLE_DIR = Path(__file__).resolve().parent
if str(EXAMPLE_DIR) not in sys.path:
    sys.path.insert(0, str(EXAMPLE_DIR))

import main as enterprise_app  # noqa: E402


app = enterprise_app.app


USER_ID = "acme:alice"
HEADERS = {"X-User-ID": USER_ID}
BOB_USER_ID = "acme:bob"
BOB_HEADERS = {"X-User-ID": BOB_USER_ID}
EVE_USER_ID = "globex:eve"
EVE_HEADERS = {"X-User-ID": EVE_USER_ID}
SAFE_AGENT_TOOLS = [
    "enterprise_lookup_policy",
    "enterprise_get_ticket_status",
]
RISK_AGENT_TOOLS = [
    "enterprise_lookup_policy",
    "enterprise_get_ticket_status",
    "enterprise_summarize_department_metrics",
]
EXPECTED_RUNTIME_CAPABILITIES = {
    "tenant_context",
    "tool_routing",
    "approval_gate",
    "knowledge_retrieval",
    "long_term_memory",
    "run_evidence",
}


def _assert_runtime_adapter_metadata(record: dict[str, Any], label: str) -> None:
    runtime_adapter = record.get("runtime_adapter")
    if not isinstance(runtime_adapter, dict):
        raise AssertionError(f"{label} failed: missing runtime_adapter: {record}")
    expected_fields = {
        "id": "agentscope-platform-adapter",
        "provider": "agentscope",
        "mode": "local-service",
    }
    for field, expected in expected_fields.items():
        if runtime_adapter.get(field) != expected:
            raise AssertionError(
                f"{label} failed: runtime_adapter {field} mismatch: {record}",
            )
    capabilities = runtime_adapter.get("capabilities")
    if not isinstance(capabilities, list) or not EXPECTED_RUNTIME_CAPABILITIES.issubset(
        set(capabilities),
    ):
        raise AssertionError(
            f"{label} failed: runtime_adapter capabilities mismatch: {record}",
        )


class _SmokeEnterpriseGateway(BaseHTTPRequestHandler):
    server_version = "SmokeEnterpriseGateway/1.0"

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        parsed = urlparse(self.path)
        parts = [part for part in parsed.path.split("/") if part]
        payload: dict[str, Any] | None = None

        if len(parts) == 4 and parts[0] == "tenants" and parts[2] == "policies":
            keyword = parse_qs(parsed.query).get("keyword", [""])[0]
            payload = {
                "matches": {
                    keyword or "remote": (
                        "Remote policy served by the smoke enterprise gateway."
                    ),
                },
                "available_policy_keys": ["remote"],
            }
        elif len(parts) == 4 and parts[0] == "tenants" and parts[2] == "tickets":
            payload = {
                "found": True,
                "ticket": {
                    "status": "investigating",
                    "owner": "smoke-gateway",
                    "summary": f"Ticket {parts[3]} served by HTTP connector.",
                },
            }
        elif (
            len(parts) == 5
            and parts[0] == "tenants"
            and parts[2] == "departments"
            and parts[4] == "metrics"
        ):
            payload = {
                "found": True,
                "metrics": {
                    "active_projects": 3,
                    "open_incidents": 0,
                    "source": "smoke-gateway",
                },
                "available_departments": [parts[3]],
            }

        if payload is None:
            self.send_error(404)
            return

        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: Any) -> None:
        return


class _GatewayHandle:
    def __init__(self) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), _SmokeEnterpriseGateway)
        self.thread = threading.Thread(
            target=self.server.serve_forever,
            name="smoke-enterprise-gateway",
            daemon=True,
        )

    @property
    def base_url(self) -> str:
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


def _expect_ok(resp: Any, label: str) -> dict[str, Any]:
    if resp.status_code >= 400:
        raise AssertionError(f"{label} failed: HTTP {resp.status_code} {resp.text[:500]}")
    data = resp.json()
    if not isinstance(data, dict):
        raise AssertionError(f"{label} failed: response is not a JSON object")
    print(f"PASS {label}")
    return data


def _expect_approval_required(resp: Any, label: str) -> dict[str, Any]:
    if resp.status_code != 403:
        raise AssertionError(
            f"{label} failed: expected HTTP 403, got {resp.status_code} {resp.text[:500]}",
        )
    data = resp.json()
    detail = data.get("detail") if isinstance(data, dict) else None
    if not isinstance(detail, dict) or detail.get("approval_required") is not True:
        raise AssertionError(f"{label} failed: missing approval_required detail: {data}")
    print(f"PASS {label}")
    return detail


def _expect_forbidden(resp: Any, label: str) -> None:
    if resp.status_code != 403:
        raise AssertionError(
            f"{label} failed: expected HTTP 403, got {resp.status_code} {resp.text[:500]}",
        )
    print(f"PASS {label}")


def _expect_bad_request(resp: Any, label: str) -> None:
    if resp.status_code != 400:
        raise AssertionError(
            f"{label} failed: expected HTTP 400, got {resp.status_code} {resp.text[:500]}",
        )
    print(f"PASS {label}")


def _approve_request(
    client: TestClient,
    *,
    request_type: str,
    inputs: dict[str, Any],
    agent_id: str,
    tool_name: str | None = None,
    workflow_type: str | None = None,
    reason: str = "Smoke-test approval.",
) -> str:
    created = _expect_ok(
        client.post(
            "/enterprise/platform/approvals",
            headers=HEADERS,
            json={
                "request_type": request_type,
                "tool_name": tool_name,
                "workflow_type": workflow_type,
                "inputs": inputs,
                "reason": reason,
                "agent_id": agent_id,
                "user_id": USER_ID,
            },
        ),
        f"create {request_type} approval request",
    )
    approval_id = created.get("approval", {}).get("approval_id")
    if not approval_id:
        raise AssertionError(f"create {request_type} approval request failed: {created}")

    approved = _expect_ok(
        client.post(
            f"/enterprise/platform/approvals/{approval_id}/approve",
            headers=HEADERS,
            json={
                "decision_note": "Approved by smoke test.",
                "decided_by": USER_ID,
            },
        ),
        f"approve {request_type} approval request",
    )
    if approved.get("approval", {}).get("status") != "approved":
        raise AssertionError(f"approve {request_type} approval request failed: {approved}")
    return str(approval_id)


def _ensure_smoke_agent(client: TestClient) -> str:
    agents_payload = _expect_ok(
        client.get("/enterprise/platform/agents", headers=HEADERS),
        "list agent templates and instances",
    )
    for agent in agents_payload.get("agents", []):
        if (
            agent.get("template_id") == "enterprise_knowledge_assistant"
            and agent.get("status") == "published"
            and set(SAFE_AGENT_TOOLS).issubset(set(agent.get("tools") or []))
        ):
            print(f"PASS reuse published enterprise agent: {agent['id']}")
            return str(agent["id"])

    created = _expect_ok(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "企业知识助手 - smoke",
                "description": "Smoke-test published instance for platform verification.",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "memory_enabled": True,
                "workflow_enabled": True,
                "allowed_user_ids": [USER_ID],
            },
        ),
        "publish enterprise knowledge assistant",
    )
    agent_id = created.get("agent", {}).get("id")
    if not agent_id:
        raise AssertionError("publish enterprise knowledge assistant failed: missing agent id")
    return str(agent_id)


def _ensure_risk_smoke_agent(client: TestClient) -> str:
    agents_payload = _expect_ok(
        client.get("/enterprise/platform/agents", headers=HEADERS),
        "list risk-capable agent templates and instances",
    )
    for agent in agents_payload.get("agents", []):
        if (
            agent.get("template_id") == "enterprise_knowledge_assistant"
            and agent.get("status") == "published"
            and set(RISK_AGENT_TOOLS).issubset(set(agent.get("tools") or []))
        ):
            print(f"PASS reuse risk-capable enterprise agent: {agent['id']}")
            return str(agent["id"])

    created = _expect_ok(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "企业知识助手 - governed smoke",
                "description": "Smoke-test instance for approval-gated platform actions.",
                "tenant": "acme",
                "tools": RISK_AGENT_TOOLS,
                "memory_enabled": True,
                "workflow_enabled": True,
                "allowed_user_ids": [USER_ID],
            },
        ),
        "publish risk-capable enterprise knowledge assistant",
    )
    agent_id = created.get("agent", {}).get("id")
    if not agent_id:
        raise AssertionError(
            "publish risk-capable enterprise knowledge assistant failed: missing agent id",
        )
    return str(agent_id)


def _ensure_role_smoke_agent(client: TestClient) -> str:
    agents_payload = _expect_ok(
        client.get("/enterprise/platform/agents", headers=HEADERS),
        "list role-gated agent templates and instances",
    )
    for agent in agents_payload.get("agents", []):
        if (
            agent.get("template_id") == "enterprise_knowledge_assistant"
            and agent.get("status") == "published"
            and set(SAFE_AGENT_TOOLS).issubset(set(agent.get("tools") or []))
            and "Finance reviewer" in set(agent.get("allowed_roles") or [])
        ):
            print(f"PASS reuse role-gated enterprise agent: {agent['id']}")
            return str(agent["id"])

    created = _expect_ok(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "企业知识助手 - role smoke",
                "description": "Smoke-test instance for role-based member access.",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "memory_enabled": True,
                "workflow_enabled": True,
                "allowed_roles": ["Finance reviewer"],
            },
        ),
        "publish role-gated enterprise knowledge assistant",
    )
    agent_id = created.get("agent", {}).get("id")
    if not agent_id:
        raise AssertionError(
            "publish role-gated enterprise knowledge assistant failed: missing agent id",
        )
    return str(agent_id)


def main() -> None:
    connector_configs_path = enterprise_app.PLATFORM_CONNECTOR_CONFIGS_PATH
    members_path = enterprise_app.PLATFORM_MEMBERS_PATH
    agents_path = enterprise_app.PLATFORM_AGENTS_PATH
    original_connector_configs = (
        connector_configs_path.read_bytes()
        if connector_configs_path.exists()
        else None
    )
    original_members = members_path.read_bytes() if members_path.exists() else None
    original_agents = agents_path.read_bytes() if agents_path.exists() else None
    gateway = _GatewayHandle()
    gateway.start()

    def restore_platform_files() -> None:
        gateway.stop()
        if original_connector_configs is None:
            connector_configs_path.unlink(missing_ok=True)
        else:
            connector_configs_path.parent.mkdir(parents=True, exist_ok=True)
            connector_configs_path.write_bytes(original_connector_configs)
        if original_members is None:
            members_path.unlink(missing_ok=True)
        else:
            members_path.parent.mkdir(parents=True, exist_ok=True)
            members_path.write_bytes(original_members)
        if original_agents is None:
            agents_path.unlink(missing_ok=True)
        else:
            agents_path.parent.mkdir(parents=True, exist_ok=True)
            agents_path.write_bytes(original_agents)

    atexit.register(restore_platform_files)

    client = TestClient(app)
    bob_member_payload = _expect_ok(
        client.post(
            "/enterprise/platform/members",
            headers=HEADERS,
            json={
                "user_id": BOB_USER_ID,
                "tenant": "acme",
                "display_name": "Bob",
                "role": "Finance reviewer",
                "status": "active",
            },
        ),
        "create platform member for role access",
    )
    if bob_member_payload.get("member", {}).get("user_id") != BOB_USER_ID:
        raise AssertionError(
            f"create platform member for role access failed: {bob_member_payload}",
        )
    eve_member_payload = _expect_ok(
        client.post(
            "/enterprise/platform/members",
            headers=HEADERS,
            json={
                "user_id": EVE_USER_ID,
                "tenant": "globex",
                "display_name": "Eve",
                "role": "Finance reviewer",
                "status": "active",
            },
        ),
        "create cross-tenant platform member for access isolation",
    )
    if eve_member_payload.get("member", {}).get("user_id") != EVE_USER_ID:
        raise AssertionError(
            "create cross-tenant platform member for access isolation failed: "
            f"{eve_member_payload}",
        )

    saved_config_payload = _expect_ok(
        client.post(
            "/enterprise/platform/connectors/configs",
            headers=HEADERS,
            json={
                "base_url": gateway.base_url,
                "token": "smoke-token",
                "tenant": "acme",
                "policy_path": "/tenants/{tenant}/policies/search",
                "ticket_path": "/tenants/{tenant}/tickets/{ticket_id}",
                "metrics_path": (
                    "/tenants/{tenant}/departments/{department}/metrics"
                ),
                "timeout_seconds": 3.0,
                "enabled": True,
            },
        ),
        "save tenant HTTP connector config",
    )
    saved_config = saved_config_payload.get("config") or {}
    if saved_config.get("tenant") != "acme" or saved_config.get("enabled") is not True:
        raise AssertionError(
            f"save tenant HTTP connector config failed: {saved_config_payload}",
        )

    status_payload: dict[str, Any] | None = None
    connectors_payload: dict[str, Any] | None = None
    scenarios_payload: dict[str, Any] | None = None
    ops_tasks_payload: dict[str, Any] | None = None
    for path, label in [
        ("/enterprise/platform/status", "platform status"),
        ("/enterprise/platform/connectors", "connector catalog"),
        ("/enterprise/platform/governance", "governance overview"),
        ("/enterprise/platform/members", "platform members"),
        ("/enterprise/platform/scenarios", "business scenarios"),
        ("/enterprise/platform/ops/tasks", "operations tasks"),
        ("/enterprise/platform/policies/tools", "tool policy"),
        ("/enterprise/platform/connectors/configs", "connector configs"),
        ("/enterprise/platform/tools", "tool catalog"),
        ("/enterprise/platform/workflows", "workflow templates"),
        ("/enterprise/platform/approvals", "approval center"),
        ("/enterprise/platform/audit", "audit log"),
    ]:
        payload = _expect_ok(client.get(path, headers=HEADERS), label)
        if path == "/enterprise/platform/status":
            status_payload = payload
        if path == "/enterprise/platform/connectors":
            connectors_payload = payload
        if path == "/enterprise/platform/governance":
            governance_payload = payload
        if path == "/enterprise/platform/scenarios":
            scenarios_payload = payload
        if path == "/enterprise/platform/ops/tasks":
            ops_tasks_payload = payload

    connector_runtime = (connectors_payload or {}).get("runtime")
    if not isinstance(connector_runtime, dict):
        raise AssertionError("connector catalog failed: missing runtime")
    if connector_runtime.get("source") != "saved_config":
        raise AssertionError(
            f"connector catalog failed: expected saved_config runtime: {connector_runtime}",
        )
    if connector_runtime.get("saved_config_enabled") is not True:
        raise AssertionError(
            f"connector catalog failed: saved config is not active: {connector_runtime}",
        )
    member_rows = (connectors_payload or {}).get("identities") or []
    if not any(member.get("user_id") == BOB_USER_ID for member in member_rows):
        raise AssertionError(
            f"connector catalog failed: missing created member identity: {member_rows}",
        )
    governance_identities = (governance_payload or {}).get("identities") or []
    if not any(member.get("user_id") == BOB_USER_ID for member in governance_identities):
        raise AssertionError(
            "governance overview failed: missing created member identity: "
            f"{governance_identities}",
        )

    config_export = _expect_ok(
        client.get("/enterprise/platform/config/export", headers=HEADERS),
        "platform config export",
    )
    if config_export.get("redacted") is not True:
        raise AssertionError(
            f"platform config export failed: not redacted: {config_export}",
        )
    exported_connector_configs = (
        (config_export.get("config") or {}).get("connector_configs") or []
    )
    for connector_config in exported_connector_configs:
        if connector_config.get("token"):
            raise AssertionError(
                f"platform config export leaked connector token: {connector_config}",
            )

    config_import = _expect_ok(
        client.post(
            "/enterprise/platform/config/import",
            headers=HEADERS,
            json={"mode": "merge", "config": config_export.get("config") or {}},
        ),
        "platform config import",
    )
    if config_import.get("imported") is not True or not isinstance(
        config_import.get("counts"),
        dict,
    ):
        raise AssertionError(f"platform config import failed: {config_import}")

    operations = ((status_payload or {}).get("dashboard") or {}).get("operations")
    if not isinstance(operations, dict):
        raise AssertionError("platform status failed: missing dashboard.operations")
    for key in [
        "workflow_template_count",
        "enabled_workflow_count",
        "workflow_status_counts",
        "recommended_actions",
    ]:
        if key not in operations:
            raise AssertionError(f"platform status failed: missing operations.{key}")

    launch_readiness = (status_payload or {}).get("launch_readiness")
    if not isinstance(launch_readiness, dict):
        raise AssertionError("platform status failed: missing launch_readiness")
    for key in [
        "status",
        "ready_count",
        "total_count",
        "blocking_count",
        "items",
    ]:
        if key not in launch_readiness:
            raise AssertionError(f"platform status failed: missing launch_readiness.{key}")
    if not isinstance(launch_readiness.get("items"), list) or not launch_readiness["items"]:
        raise AssertionError("platform status failed: launch_readiness.items is empty")

    scenarios = (scenarios_payload or {}).get("scenarios")
    if not isinstance(scenarios, list) or not scenarios:
        raise AssertionError("business scenarios failed: scenarios is empty")
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            raise AssertionError("business scenarios failed: scenario is not an object")
        for key in [
            "scenario_id",
            "name",
            "status",
            "workflow_type",
            "tools",
            "next_action",
        ]:
            if key not in scenario:
                raise AssertionError(f"business scenarios failed: missing scenario.{key}")
    if not isinstance((scenarios_payload or {}).get("summary"), dict):
        raise AssertionError("business scenarios failed: missing summary")

    ops_tasks = (ops_tasks_payload or {}).get("tasks")
    if not isinstance(ops_tasks, list):
        raise AssertionError("operations tasks failed: tasks is not a list")
    ops_summary = (ops_tasks_payload or {}).get("summary")
    if not isinstance(ops_summary, dict):
        raise AssertionError("operations tasks failed: missing summary")
    for key in ["total_count", "error_count", "warning_count", "info_count", "open_count"]:
        if key not in ops_summary:
            raise AssertionError(f"operations tasks failed: missing summary.{key}")
    resolve_payload = _expect_ok(
        client.post(
            "/enterprise/platform/ops/tasks/disabled_workflows/resolve",
            headers=HEADERS,
        ),
        "resolve disabled workflow operations task",
    )
    for key in ["task_code", "resolved", "message", "workflows", "ops_tasks"]:
        if key not in resolve_payload:
            raise AssertionError(f"resolve operations task failed: missing {key}")
    if resolve_payload.get("task_code") != "disabled_workflows":
        raise AssertionError(f"resolve operations task failed: {resolve_payload}")

    agent_id = _ensure_smoke_agent(client)

    tool_result = _expect_ok(
        client.post(
            "/enterprise/platform/tools/run",
            headers=HEADERS,
            json={
                "tool_name": "enterprise_lookup_policy",
                "inputs": {"keyword": "remote"},
                "user_id": USER_ID,
                "agent_id": agent_id,
            },
        ),
        "run policy lookup tool",
    )
    if tool_result.get("allowed") is not True:
        raise AssertionError(f"run policy lookup tool failed: {tool_result}")
    if tool_result.get("connector_source") != "saved_config":
        raise AssertionError(
            f"run policy lookup tool failed: did not use saved_config: {tool_result}",
        )

    agent_result = _expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=HEADERS,
            json={
                "question": "请查询 remote 政策，并说明信息来源。",
                "user_id": USER_ID,
                "agent_id": agent_id,
                "session_id": "smoke-enterprise-agent-platform",
            },
        ),
        "run enterprise knowledge agent",
    )
    if not agent_result.get("answer"):
        raise AssertionError("run enterprise knowledge agent failed: missing answer")
    if agent_result.get("connector_source") != "saved_config":
        raise AssertionError(
            f"run enterprise knowledge agent failed: did not use saved_config: {agent_result}",
        )
    agent_turn_id = agent_result.get("turn_id")
    if not agent_turn_id:
        raise AssertionError(
            f"run enterprise knowledge agent failed: missing turn_id: {agent_result}",
        )

    agent_run_detail = _expect_ok(
        client.get(
            f"/enterprise/platform/agent/runs/{agent_turn_id}",
            headers=HEADERS,
        ),
        "get enterprise agent run detail",
    )
    if agent_run_detail.get("turn_id") != agent_turn_id:
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"turn_id mismatch: {agent_run_detail}",
        )
    detail_response = agent_run_detail.get("response") or {}
    if detail_response.get("turn_id") != agent_turn_id:
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"response turn_id mismatch: {agent_run_detail}",
        )
    detail_evidence = agent_run_detail.get("evidence") or {}
    if detail_evidence.get("run_id") != agent_turn_id:
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"evidence run_id mismatch: {agent_run_detail}",
        )
    runtime_invocation_id = agent_run_detail.get("runtime_invocation_id")
    if not runtime_invocation_id:
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"missing runtime_invocation_id: {agent_run_detail}",
        )
    runtime_invocation_result = (
        agent_run_detail.get("runtime_invocation_result") or {}
    )
    if runtime_invocation_result.get("provider_run_id") != agent_turn_id:
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"runtime provider_run_id mismatch: {agent_run_detail}",
        )
    if runtime_invocation_result.get("status") != "completed":
        raise AssertionError(
            "get enterprise agent run detail failed: "
            f"runtime status mismatch: {agent_run_detail}",
        )
    _assert_runtime_adapter_metadata(
        agent_run_detail,
        "get enterprise agent run detail",
    )

    risk_agent_id = _ensure_risk_smoke_agent(client)
    role_agent_id = _ensure_role_smoke_agent(client)
    scoped_agents_payload = _expect_ok(
        client.get("/enterprise/platform/agents", headers=HEADERS),
        "list published agents with access summaries",
    )
    role_agent = next(
        (
            agent
            for agent in scoped_agents_payload.get("agents", [])
            if str(agent.get("id")) == role_agent_id
        ),
        None,
    )
    if not isinstance(role_agent, dict) or not isinstance(
        role_agent.get("access_summary"),
        dict,
    ):
        raise AssertionError(
            "list published agents with access summaries failed: "
            f"{scoped_agents_payload}",
        )
    if role_agent["access_summary"].get("tenant") != "acme":
        raise AssertionError(
            "list published agents with access summaries failed: "
            f"{role_agent['access_summary']}",
        )

    _expect_bad_request(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "Invalid cross-tenant user scope",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "allowed_user_ids": [EVE_USER_ID],
            },
        ),
        "reject cross-tenant user access scope on publish",
    )
    _expect_bad_request(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "Invalid unknown role scope",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "allowed_roles": ["Unknown tenant role"],
            },
        ),
        "reject unknown role access scope on publish",
    )
    _expect_bad_request(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "Invalid unknown model config",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "model_config_id": "missing-model-config",
            },
        ),
        "reject unknown model config on agent publish",
    )
    _expect_bad_request(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "enterprise_knowledge_assistant",
                "name": "Invalid unknown knowledge base",
                "tenant": "acme",
                "tools": SAFE_AGENT_TOOLS,
                "knowledge_base_ids": ["missing-kb"],
            },
        ),
        "reject unknown knowledge base on agent publish",
    )

    bob_agent_result = _expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=BOB_HEADERS,
            json={
                "question": "请查询 remote 政策，并说明信息来源。",
                "user_id": BOB_USER_ID,
                "agent_id": role_agent_id,
                "session_id": "smoke-enterprise-agent-platform-role",
            },
        ),
        "run role-gated agent as matching member",
    )
    if not bob_agent_result.get("answer"):
        raise AssertionError(
            f"run role-gated agent as matching member failed: {bob_agent_result}",
        )
    _expect_forbidden(
        client.post(
            "/enterprise/platform/agent/run",
            headers=EVE_HEADERS,
            json={
                "question": "请查询 remote 政策，并说明信息来源。",
                "user_id": EVE_USER_ID,
                "agent_id": role_agent_id,
                "session_id": "smoke-enterprise-agent-platform-role-cross-tenant",
            },
        ),
        "block cross-tenant member with matching role",
    )
    _expect_ok(
        client.patch(
            f"/enterprise/platform/members/{BOB_USER_ID}",
            headers=HEADERS,
            json={"status": "inactive"},
        ),
        "deactivate platform member",
    )
    _expect_forbidden(
        client.post(
            "/enterprise/platform/agent/run",
            headers=BOB_HEADERS,
            json={
                "question": "请查询 remote 政策，并说明信息来源。",
                "user_id": BOB_USER_ID,
                "agent_id": role_agent_id,
                "session_id": "smoke-enterprise-agent-platform-role-inactive",
            },
        ),
        "block inactive member from role-gated agent",
    )

    pending_agent_result = _expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=HEADERS,
            json={
                "question": "帮我看一下 engineering 部门指标",
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
                "session_id": "smoke-enterprise-agent-platform-governed",
            },
        ),
        "create approval from governed agent run",
    )
    pending_calls = pending_agent_result.get("tool_calls") or []
    pending_metrics_call = next(
        (
            call
            for call in pending_calls
            if call.get("tool_name") == "enterprise_summarize_department_metrics"
        ),
        None,
    )
    if (
        not pending_metrics_call
        or pending_metrics_call.get("approval_required") is not True
        or pending_metrics_call.get("approval_status") != "pending"
        or not pending_metrics_call.get("approval_id")
        or pending_metrics_call.get("allowed") is not False
    ):
        raise AssertionError(
            "create approval from governed agent run failed: "
            f"{pending_agent_result}",
        )
    if any(
        call.get("tool_name") == "enterprise_summarize_department_metrics"
        and call.get("result")
        for call in pending_calls
    ):
        raise AssertionError(
            "create approval from governed agent run failed: "
            f"metrics tool executed before approval: {pending_agent_result}",
        )

    pending_approval_id = str(pending_metrics_call["approval_id"])
    _expect_ok(
        client.post(
            f"/enterprise/platform/approvals/{pending_approval_id}/approve",
            headers=HEADERS,
            json={
                "decision_note": "Approved by smoke test.",
                "decided_by": USER_ID,
            },
        ),
        "approve auto-created agent tool approval",
    )

    approved_agent_result = _expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=HEADERS,
            json={
                "question": "帮我看一下 engineering 部门指标",
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
                "session_id": "smoke-enterprise-agent-platform-governed",
                "approval_id": pending_approval_id,
            },
        ),
        "run governed agent after approval",
    )
    approved_calls = approved_agent_result.get("tool_calls") or []
    approved_metrics_call = next(
        (
            call
            for call in approved_calls
            if call.get("tool_name") == "enterprise_summarize_department_metrics"
        ),
        None,
    )
    if (
        not approved_metrics_call
        or approved_metrics_call.get("allowed") is not True
        or approved_metrics_call.get("approval_id") != pending_approval_id
        or not approved_metrics_call.get("result")
    ):
        raise AssertionError(
            f"run governed agent after approval failed: {approved_agent_result}",
        )

    metrics_inputs = {"department": "engineering"}
    _expect_approval_required(
        client.post(
            "/enterprise/platform/tools/run",
            headers=HEADERS,
            json={
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": metrics_inputs,
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
            },
        ),
        "block governed tool run without approval",
    )
    tool_approval_id = _approve_request(
        client,
        request_type="tool_run",
        tool_name="enterprise_summarize_department_metrics",
        inputs=metrics_inputs,
        agent_id=risk_agent_id,
        reason="Smoke-test governed metrics tool run.",
    )
    approved_tool_result = _expect_ok(
        client.post(
            "/enterprise/platform/tools/run",
            headers=HEADERS,
            json={
                "tool_name": "enterprise_summarize_department_metrics",
                "inputs": metrics_inputs,
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
                "approval_id": tool_approval_id,
            },
        ),
        "run governed tool after approval",
    )
    if (
        approved_tool_result.get("allowed") is not True
        or approved_tool_result.get("approval_id") != tool_approval_id
        or not approved_tool_result.get("result")
    ):
        raise AssertionError(
            f"run governed tool after approval failed: {approved_tool_result}",
        )

    workflow_result = _expect_ok(
        client.post(
            "/enterprise/platform/workflows/run",
            headers=HEADERS,
            json={
                "workflow_type": "ticket_followup",
                "inputs": {
                    "policy_keyword": "remote",
                    "ticket_id": "INC-1001",
                },
                "user_id": USER_ID,
                "agent_id": agent_id,
            },
        ),
        "run ticket follow-up workflow",
    )
    if workflow_result.get("status") not in {"completed", "partial"}:
        raise AssertionError(f"run ticket follow-up workflow failed: {workflow_result}")
    if workflow_result.get("connector_source") != "saved_config":
        raise AssertionError(
            f"run ticket follow-up workflow failed: did not use saved_config: {workflow_result}",
        )
    for call in workflow_result.get("tool_calls") or []:
        if call.get("connector_source") != "saved_config":
            raise AssertionError(
                "run ticket follow-up workflow failed: "
                f"tool call did not use saved_config: {call}",
            )

    workflow_inputs = {
        "policy_keyword": "remote",
        "ticket_id": "INC-1001",
        "department": "engineering",
    }
    _expect_approval_required(
        client.post(
            "/enterprise/platform/workflows/run",
            headers=HEADERS,
            json={
                "workflow_type": "daily_ops_brief",
                "inputs": workflow_inputs,
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
            },
        ),
        "block governed workflow without approval",
    )
    workflow_approval_id = _approve_request(
        client,
        request_type="workflow_run",
        workflow_type="daily_ops_brief",
        inputs=workflow_inputs,
        agent_id=risk_agent_id,
        reason="Smoke-test governed daily ops workflow.",
    )
    governed_workflow_result = _expect_ok(
        client.post(
            "/enterprise/platform/workflows/run",
            headers=HEADERS,
            json={
                "workflow_type": "daily_ops_brief",
                "inputs": workflow_inputs,
                "user_id": USER_ID,
                "agent_id": risk_agent_id,
                "approval_id": workflow_approval_id,
            },
        ),
        "run governed workflow after approval",
    )
    if (
        governed_workflow_result.get("status") not in {"completed", "partial"}
        or governed_workflow_result.get("approval_id") != workflow_approval_id
    ):
        raise AssertionError(
            f"run governed workflow after approval failed: {governed_workflow_result}",
        )
    metrics_steps = [
        step
        for step in governed_workflow_result.get("steps") or []
        if step.get("tool_name") == "enterprise_summarize_department_metrics"
    ]
    if not metrics_steps or metrics_steps[0].get("status") != "success":
        raise AssertionError(
            "run governed workflow after approval failed: "
            f"metrics step did not complete: {governed_workflow_result}",
        )

    agent_runs_payload = _expect_ok(
        client.get("/enterprise/platform/agent/runs", headers=HEADERS),
        "list agent runs",
    )
    listed_agent_run = next(
        (
            run
            for run in agent_runs_payload.get("runs", [])
            if run.get("turn_id") == agent_turn_id
        ),
        None,
    )
    if not isinstance(listed_agent_run, dict):
        raise AssertionError(
            "list agent runs failed: "
            f"created run not found: {agent_runs_payload}",
        )
    if listed_agent_run.get("runtime_invocation_id") != runtime_invocation_id:
        raise AssertionError(
            "list agent runs failed: "
            f"runtime_invocation_id mismatch: {listed_agent_run}",
        )
    listed_runtime_result = (
        listed_agent_run.get("runtime_invocation_result") or {}
    )
    if listed_runtime_result.get("provider_run_id") != agent_turn_id:
        raise AssertionError(
            "list agent runs failed: "
            f"runtime provider_run_id mismatch: {listed_agent_run}",
        )
    _assert_runtime_adapter_metadata(listed_agent_run, "list agent runs")
    _expect_ok(
        client.get("/enterprise/platform/workflows/runs", headers=HEADERS),
        "list workflow runs",
    )

    print("\nEnterprise agent platform smoke test passed.")
    print(
        "Verified: dashboard APIs, tenant connector runtime, "
        "agent publishing/reuse, tool run, agent run, workflow run, "
        "member role access, inactive member blocking, "
        "approval-gated agent/tool/workflow execution.",
    )


if __name__ == "__main__":
    main()
