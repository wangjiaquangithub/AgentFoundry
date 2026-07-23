# -*- coding: utf-8 -*-
from __future__ import annotations

import unittest
from types import SimpleNamespace

from agentscope_runtime_provider import AgentScopeNativeInvocationClient


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
    def __init__(self, *, replies: list[str], **_kwargs) -> None:
        self._replies = replies
        self.messages: list[str] = []

    async def reply(self, message):
        self.messages.append(str(message.content))
        value = self._replies.pop(0)
        if value == "raise":
            raise RuntimeError("model unavailable")
        return _Reply(value)


def _envelope(*, session_id: str = "session-1", version_id: str = "version-1"):
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
            "tools": [],
            "metadata": {"agent_version_id": version_id},
        },
    }


class AgentScopeRuntimeProviderTests(unittest.IsolatedAsyncioTestCase):
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


if __name__ == "__main__":
    unittest.main()
