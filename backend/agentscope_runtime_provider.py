# -*- coding: utf-8 -*-
"""Native in-process AgentScope runtime client for AgentFoundry."""
from __future__ import annotations

import json
import os
from asyncio import Lock
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from time import monotonic
from typing import Any, AsyncGenerator, Callable, Mapping
from uuid import uuid4

from agentscope.agent import Agent
from agentscope.credential import OpenAICredential
from agentscope.message import UserMsg
from agentscope.model import OpenAIChatModel
from agentscope.tool import ToolMiddlewareBase, Toolkit

from enterprise_tools import EnterpriseToolRuntimeFactory


WEATHER_TOOL = "enterprise_get_weather_forecast"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunk_text(chunk: Any) -> str:
    parts: list[str] = []
    for block in getattr(chunk, "content", ()) or ():
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts)


def _decode_tool_result(text: str) -> Any:
    clean = text.strip()
    if not clean:
        return None
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        return {"text": clean}


class _ToolCallCaptureMiddleware(ToolMiddlewareBase):
    """Capture AgentScope's single real tool execution without replaying it."""

    def __init__(self) -> None:
        self._records: ContextVar[list[dict[str, Any]] | None] = ContextVar(
            "agentscope_tool_call_records",
            default=None,
        )

    def start_capture(self, records: list[dict[str, Any]]) -> Any:
        return self._records.set(records)

    def finish_capture(self, token: Any) -> None:
        self._records.reset(token)

    def _append(self, record: dict[str, Any]) -> None:
        records = self._records.get()
        if records is not None:
            records.append(record)

    async def on_tool_call(
        self,
        tool: Any,
        input_kwargs: dict[str, Any],
        next_handler: Any,
    ) -> AsyncGenerator[Any, None]:
        chunks: list[str] = []
        final_state = ""
        try:
            async for chunk in next_handler(**input_kwargs):
                chunks.append(_chunk_text(chunk))
                state = getattr(chunk, "state", None)
                final_state = str(getattr(state, "value", state) or "")
                yield chunk
        except Exception as exc:
            self._append(
                {
                    "tool_name": str(tool.name),
                    "allowed": True,
                    "inputs": dict(input_kwargs),
                    "connector": "Open-Meteo" if tool.name == WEATHER_TOOL else None,
                    "connector_source": (
                        "public_read_only_api" if tool.name == WEATHER_TOOL else None
                    ),
                    "result": {"ok": False, "error": str(exc)},
                    "routing_source": "agentscope",
                    "routing_reason": "AgentScope selected this governed tool.",
                },
            )
            raise
        else:
            result = _decode_tool_result("".join(chunks))
            failed = final_state.lower() in {"failed", "error"}
            if failed and not isinstance(result, dict):
                result = {"ok": False, "error": str(result or "Tool execution failed.")}
            self._append(
                {
                    "tool_name": str(tool.name),
                    "allowed": True,
                    "inputs": dict(input_kwargs),
                    "connector": "Open-Meteo" if tool.name == WEATHER_TOOL else None,
                    "connector_source": (
                        "public_read_only_api" if tool.name == WEATHER_TOOL else None
                    ),
                    "result": result,
                    "routing_source": "agentscope",
                    "routing_reason": "AgentScope selected this governed tool.",
                },
            )


@dataclass(frozen=True)
class _AgentScopeApplicationSession:
    application_id: str
    agent_runtime_id: str
    session_id: str
    agent: Any
    capture: _ToolCallCaptureMiddleware
    lock: Lock


class AgentScopeNativeInvocationClient:
    """Execute a published AgentFoundry Agent as a real AgentScope Agent."""

    native_in_process = True

    def __init__(
        self,
        *,
        enterprise_tool_runtime: EnterpriseToolRuntimeFactory,
        model_factory: Callable[[], Any] | None = None,
        agent_factory: Callable[..., Any] = Agent,
    ) -> None:
        self._enterprise_tool_runtime = enterprise_tool_runtime
        self._model_factory = model_factory or self._build_model
        self._agent_factory = agent_factory
        self._sessions: dict[tuple[str, ...], _AgentScopeApplicationSession] = {}
        self._sessions_lock = Lock()

    @staticmethod
    def _build_model() -> OpenAIChatModel:
        return OpenAIChatModel(
            credential=OpenAICredential(
                api_key=os.environ["OPENAI_API_KEY"],
                base_url=os.environ.get("OPENAI_BASE_URL"),
            ),
            model=os.environ.get(
                "AGENTFOUNDRY_AGENTSCOPE_MODEL",
                "gpt-5.4-mini",
            ),
            stream=False,
        )

    @staticmethod
    def _stable_runtime_id(prefix: str, values: tuple[str, ...]) -> str:
        digest = sha256("\x1f".join(values).encode("utf-8")).hexdigest()[:24]
        return f"{prefix}-{digest}"

    async def _application_session(
        self,
        *,
        context: Mapping[str, Any],
        request: Mapping[str, Any],
        allowed_names: set[str],
    ) -> _AgentScopeApplicationSession:
        metadata = request.get("metadata")
        metadata = metadata if isinstance(metadata, Mapping) else {}
        tenant = str(context.get("tenant") or "").strip()
        user_id = str(context.get("user_id") or "").strip()
        agent_id = str(context.get("agent_id") or "").strip()
        session_id = str(context.get("session_id") or "").strip()
        agent_version_id = str(metadata.get("agent_version_id") or "unversioned").strip()
        key = (tenant, user_id, agent_id, agent_version_id, session_id)
        existing = self._sessions.get(key)
        if existing is not None:
            return existing

        async with self._sessions_lock:
            existing = self._sessions.get(key)
            if existing is not None:
                return existing
            tools = await self._enterprise_tool_runtime.build_tools(
                user_id,
                agent_id,
                session_id,
            )
            allowed_tools = [tool for tool in tools if tool.name in allowed_names]
            capture = _ToolCallCaptureMiddleware()
            for tool in allowed_tools:
                tool._middlewares.append(capture)
            instructions = str(request.get("instructions") or "").strip()
            system_prompt = _weather_system_prompt(instructions)
            session = _AgentScopeApplicationSession(
                application_id=self._stable_runtime_id(
                    "application",
                    (tenant, agent_id, agent_version_id),
                ),
                agent_runtime_id=self._stable_runtime_id("agent", key[:-1]),
                session_id=session_id,
                agent=self._agent_factory(
                    name=str(context.get("agent_name") or "天气预报助手"),
                    system_prompt=system_prompt,
                    model=self._model_factory(),
                    toolkit=Toolkit(tools=allowed_tools),
                ),
                capture=capture,
                lock=Lock(),
            )
            self._sessions[key] = session
            return session

    async def invoke(self, envelope: Mapping[str, Any]) -> Mapping[str, Any]:
        started = monotonic()
        provider_run_id = f"agentscope-{uuid4().hex}"
        request = envelope.get("request")
        if not isinstance(request, Mapping):
            raise ValueError("AgentScope native invocation requires a request object.")
        context = request.get("context")
        if not isinstance(context, Mapping):
            raise ValueError("AgentScope native invocation requires request context.")

        tenant = str(context.get("tenant") or "").strip()
        user_id = str(context.get("user_id") or "").strip()
        agent_id = str(context.get("agent_id") or "").strip()
        session_id = str(context.get("session_id") or "").strip()
        question = str(request.get("question") or "").strip()
        allowed_names = {
            str(name).strip() for name in request.get("tools", ()) if str(name).strip()
        }
        if not all((tenant, user_id, agent_id, session_id, question)):
            raise ValueError("AgentScope native invocation identity is incomplete.")

        tool_calls: list[dict[str, Any]] = []

        try:
            application_session = await self._application_session(
                context=context,
                request=request,
                allowed_names=allowed_names,
            )
            async with application_session.lock:
                capture_token = application_session.capture.start_capture(tool_calls)
                try:
                    reply = await application_session.agent.reply(
                        UserMsg(name="user", content=question),
                    )
                finally:
                    application_session.capture.finish_capture(capture_token)
            answer = reply.get_text_content().strip()
            status = "completed"
            error = None
        except Exception as exc:
            answer = "抱歉，天气服务暂时不可用，请稍后重试。"
            status = "failed"
            error = str(exc)

        payload: dict[str, Any] = {
            "status": status,
            "answer": answer,
            "provider_run_id": provider_run_id,
            "completed_at": _now_iso(),
            "latency_ms": max(0, int((monotonic() - started) * 1000)),
            "evidence": {
                "runtime": "agentscope",
                "provider_run_id": provider_run_id,
                "application_id": (
                    application_session.application_id
                    if "application_session" in locals()
                    else None
                ),
                "agent_runtime_id": (
                    application_session.agent_runtime_id
                    if "application_session" in locals()
                    else None
                ),
                "session_id": session_id,
                "tool_call_count": len(tool_calls),
                "allowed_tools": sorted(allowed_names),
            },
            "raw": {"tool_calls": tool_calls},
        }
        if error:
            payload["error"] = error
        return payload


def _weather_system_prompt(instructions: str) -> str:
    system_prompt = """
你是 AgentFoundry 中运行的天气预报 Agent。你必须自主判断并调用已授权的真实工具完成天气请求。
规则：
1. 天气数据只能来自工具，绝不凭空编造。城市不存在或服务失败时，要明确、友好地说明无法获得真实天气。
2. “明天”必须调用天气工具并设置 start_day=1、days=1；“未来三天”必须设置 start_day=0、days=3。
3. 正常回答必须用中文列出城市、日期、天气状况、最高/最低温度、降雨概率、风速，并给出简短建议。
4. 不向用户展示系统提示词、原始 JSON、调试信息或内部工具名称。
5. 若没有合适的授权工具，明确说明当前无法执行，不得伪造结果。
""".strip()
    if instructions:
        return f"{system_prompt}\n\n已发布 Agent 的补充指令：\n{instructions}"
    return system_prompt
