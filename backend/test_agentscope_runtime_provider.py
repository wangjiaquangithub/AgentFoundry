# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from types import SimpleNamespace

from agentscope.permission import PermissionBehavior, PermissionContext

from agentscope_runtime_provider import AgentScopeNativeInvocationClient
from enterprise_tools import (
    ReadOnlyEnterpriseTool,
    finish_enterprise_tool_invocation,
    start_enterprise_tool_invocation,
)
from permissions import ToolAuthorizationPolicy


class _ApprovalRequiredError(ValueError):
    def __init__(self) -> None:
        super().__init__("approval required")
        self.status_code = 403
        self.detail = {
            "approval_required": True,
            "message": "该工具需要审批后才能运行。",
        }


class _ToolRuntime:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str]] = []

    async def build_tools(self, user_id: str, agent_id: str, session_id: str):
        self.calls.append((user_id, agent_id, session_id))
        return []


class _Reply:
    def __init__(self, text: str) -> None:
        self._text = text

    def get_text_content(self) -> str:
        return self._text


class _Agent:
    def __init__(self, *, replies: list[str], **kwargs) -> None:
        self._replies = replies
        self.name = kwargs.get("name")
        self.system_prompt = kwargs.get("system_prompt")
        self.messages: list[str] = []

    async def reply(self, message):
        self.messages.append(str(message.content))
        value = self._replies.pop(0)
        if value == "raise":
            raise RuntimeError("model unavailable")
        return _Reply(value)


def _envelope(
    *,
    session_id: str = "session-1",
    version_id: str = "version-1",
    instructions: str | None = None,
    approval_id: str | None = None,
):
    return {
        "request": {
            "context": {
                "tenant": "acme",
                "user_id": "alice",
                "agent_id": "weather-agent",
                "agent_name": "天气助手",
                "session_id": session_id,
            },
            "question": "北京明天天气",
            "instructions": instructions,
            "tools": [],
            "metadata": {
                "agent_version_id": version_id,
                "approval_id": approval_id,
            },
        },
    }


class AgentScopeRuntimeProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_agentscope_permission_denies_tool_without_approval(self) -> None:
        validator_calls: list[dict[str, object]] = []
        records: list[dict[str, object]] = []

        def governed_tool(department: str) -> dict[str, str]:
            """Return a department summary."""
            return {"department": department}

        def validate(**kwargs):
            validator_calls.append(kwargs)
            raise _ApprovalRequiredError()

        tool = ReadOnlyEnterpriseTool(
            governed_tool,
            name="enterprise_summarize_department_metrics",
            tenant="acme",
            user_id="acme:alice",
            authorization_policy=ToolAuthorizationPolicy(
                {
                    "defaults": {
                        "allow": ["enterprise_summarize_department_metrics"],
                    },
                },
            ),
            approval_required_tools={"enterprise_summarize_department_metrics"},
            approval_validator=validate,
            is_read_only=True,
        )
        token = start_enterprise_tool_invocation(
            approval_id=None,
            agent_id="report-agent",
            tool_call_records=records,
        )
        try:
            decision = await tool.check_permissions(
                {"department": "engineering"},
                PermissionContext(),
            )
        finally:
            finish_enterprise_tool_invocation(token)

        self.assertEqual(decision.behavior, PermissionBehavior.DENY)
        self.assertEqual(len(validator_calls), 1)
        self.assertIsNone(validator_calls[0]["approval_id"])
        self.assertEqual(validator_calls[0]["agent_id"], "report-agent")
        self.assertEqual(len(records), 1)
        self.assertTrue(records[0]["approval_required"])
        self.assertFalse(records[0]["allowed"])

    async def test_agentscope_permission_accepts_matching_approval(self) -> None:
        validator_calls: list[dict[str, object]] = []

        def governed_tool(department: str) -> dict[str, str]:
            """Return a department summary."""
            return {"department": department}

        def validate(**kwargs):
            validator_calls.append(kwargs)
            return "approval-1"

        tool = ReadOnlyEnterpriseTool(
            governed_tool,
            name="enterprise_summarize_department_metrics",
            tenant="acme",
            user_id="acme:alice",
            authorization_policy=ToolAuthorizationPolicy(
                {
                    "defaults": {
                        "allow": ["enterprise_summarize_department_metrics"],
                    },
                },
            ),
            approval_required_tools={"enterprise_summarize_department_metrics"},
            approval_validator=validate,
            is_read_only=True,
        )
        records: list[dict[str, object]] = []
        token = start_enterprise_tool_invocation(
            approval_id="approval-1",
            agent_id="report-agent",
            tool_call_records=records,
        )
        try:
            decision = await tool.check_permissions(
                {"department": "engineering"},
                PermissionContext(),
            )
        finally:
            finish_enterprise_tool_invocation(token)

        self.assertEqual(decision.behavior, PermissionBehavior.ALLOW)
        self.assertEqual(validator_calls[0]["approval_id"], "approval-1")
        self.assertEqual(records, [])

    async def test_reuses_stable_application_session_for_conversation(self) -> None:
        runtime = _ToolRuntime()
        created: list[_Agent] = []

        def agent_factory(**kwargs):
            agent = _Agent(replies=["第一轮", "第二轮"], **kwargs)
            created.append(agent)
            return agent

        client = AgentScopeNativeInvocationClient(
            enterprise_tool_runtime=runtime,
            model_factory=lambda: SimpleNamespace(),
            agent_factory=agent_factory,
        )

        first = await client.invoke(_envelope())
        second = await client.invoke(_envelope())

        self.assertEqual([first["answer"], second["answer"]], ["第一轮", "第二轮"])
        self.assertEqual(len(created), 1)
        self.assertEqual(len(runtime.calls), 1)
        self.assertEqual(
            first["evidence"]["application_id"],
            second["evidence"]["application_id"],
        )
        self.assertEqual(first["evidence"]["session_id"], "session-1")
        self.assertEqual(len(created[0].messages), 2)

    async def test_session_or_published_version_creates_distinct_lifecycle(self) -> None:
        runtime = _ToolRuntime()
        created: list[_Agent] = []

        def agent_factory(**kwargs):
            agent = _Agent(replies=["完成"], **kwargs)
            created.append(agent)
            return agent

        client = AgentScopeNativeInvocationClient(
            enterprise_tool_runtime=runtime,
            model_factory=lambda: SimpleNamespace(),
            agent_factory=agent_factory,
        )
        first = await client.invoke(_envelope())
        other_session = await client.invoke(_envelope(session_id="session-2"))
        other_version = await client.invoke(_envelope(version_id="version-2"))

        self.assertEqual(len(created), 3)
        self.assertEqual(
            first["evidence"]["application_id"],
            other_session["evidence"]["application_id"],
        )
        self.assertNotEqual(
            first["evidence"]["application_id"],
            other_version["evidence"]["application_id"],
        )

    async def test_runtime_failure_is_not_reported_as_success(self) -> None:
        client = AgentScopeNativeInvocationClient(
            enterprise_tool_runtime=_ToolRuntime(),
            model_factory=lambda: SimpleNamespace(),
            agent_factory=lambda **kwargs: _Agent(replies=["raise"], **kwargs),
        )

        result = await client.invoke(_envelope())

        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"], "model unavailable")
        self.assertNotEqual(result["answer"], "完成")

    async def test_uses_published_instructions_without_weather_override(self) -> None:
        created: list[_Agent] = []

        def agent_factory(**kwargs):
            agent = _Agent(replies=["制度来自远程政策库。"], **kwargs)
            created.append(agent)
            return agent

        client = AgentScopeNativeInvocationClient(
            enterprise_tool_runtime=_ToolRuntime(),
            model_factory=lambda: SimpleNamespace(),
            agent_factory=agent_factory,
        )

        result = await client.invoke(
            _envelope(instructions="你是企业知识助手，必须查询制度工具并说明来源。"),
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(created[0].name, "天气助手")
        self.assertIn("企业知识助手", created[0].system_prompt)
        self.assertNotIn("天气预报 Agent", created[0].system_prompt)
        self.assertNotIn("start_day", created[0].system_prompt)

    async def test_approved_retry_instructs_agent_to_retry_the_tool(self) -> None:
        created: list[_Agent] = []

        def agent_factory(**kwargs):
            agent = _Agent(replies=["已查询。"], **kwargs)
            created.append(agent)
            return agent

        client = AgentScopeNativeInvocationClient(
            enterprise_tool_runtime=_ToolRuntime(),
            model_factory=lambda: SimpleNamespace(),
            agent_factory=agent_factory,
        )

        result = await client.invoke(_envelope(approval_id="approval-1"))

        self.assertEqual(result["status"], "completed")
        self.assertIn("已经批准", created[0].messages[0])
        self.assertIn("重新调用", created[0].messages[0])
        self.assertNotIn("approval-1", created[0].messages[0])


if __name__ == "__main__":
    unittest.main()
