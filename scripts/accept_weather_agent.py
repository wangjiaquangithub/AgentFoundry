# -*- coding: utf-8 -*-
"""End-to-end acceptance test for the real Open-Meteo weather agent."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep acceptance-only audit output outside the repository. Agent and run records
# still use the platform's normal persistence APIs and paths.
AUDIT_DIR = Path(tempfile.mkdtemp(prefix="agentfoundry-weather-acceptance-"))
os.environ["ENTERPRISE_AUDIT_LOG_PATH"] = str(AUDIT_DIR / "tool_audit.jsonl")

import main as platform_app  # noqa: E402


USER_ID = "acme:alice"
HEADERS = {"X-User-ID": USER_ID}
WEATHER_TOOL = "enterprise_get_weather_forecast"


def expect_ok(response: Any, label: str) -> dict[str, Any]:
    if response.status_code != 200:
        raise AssertionError(
            f"{label} failed: HTTP {response.status_code}: {response.text}",
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise AssertionError(f"{label} failed: expected object: {payload!r}")
    return payload


def ensure_weather_agent(client: TestClient) -> str:
    payload = expect_ok(
        client.get("/enterprise/platform/agents", headers=HEADERS),
        "list agents",
    )
    for agent in payload.get("agents", []):
        if (
            agent.get("template_id") == "weather_forecast_assistant"
            and agent.get("status") == "published"
            and agent.get("tools") == [WEATHER_TOOL]
            and agent.get("execution_mode") == "agentscope_native"
            and agent.get("runtime_provider") == "agentscope"
            and USER_ID in (agent.get("allowed_user_ids") or [])
        ):
            agent_id = str(agent["id"])
            print(f"PASS reuse weather agent: {agent_id}")
            return agent_id

    payload = expect_ok(
        client.post(
            "/enterprise/platform/agents/publish",
            headers=HEADERS,
            json={
                "template_id": "weather_forecast_assistant",
                "name": "天气预报助手",
                "description": "真实 Open-Meteo 天气业务验收 Agent。",
                "tenant": "acme",
                "tools": [WEATHER_TOOL],
                "execution_mode": "agentscope_native",
                "runtime_provider": "agentscope",
                "memory_enabled": False,
                "workflow_enabled": False,
                "allowed_user_ids": [USER_ID],
            },
        ),
        "publish weather agent",
    )
    agent_id = payload.get("agent", {}).get("id")
    if not agent_id:
        raise AssertionError(f"publish weather agent failed: {payload}")
    print(f"PASS publish weather agent: {agent_id}")
    return str(agent_id)


def assert_persisted_run(
    client: TestClient,
    *,
    agent_id: str,
    run: dict[str, Any],
    expected_city: str,
    expected_days: int,
    expected_start_day: int,
    expected_ok: bool,
) -> None:
    if run.get("routing_mode") != "provider-native":
        raise AssertionError(f"run did not use provider-native routing: {run}")
    if run.get("routing_source") != "agentscope":
        raise AssertionError(f"run did not originate from AgentScope: {run}")
    turn_id = run.get("turn_id")
    if not turn_id:
        raise AssertionError(f"agent run missing turn_id: {run}")
    tool_calls = run.get("tool_calls") or []
    if len(tool_calls) != 1:
        raise AssertionError(f"agent run tool call mismatch: {run}")
    call = tool_calls[0]
    if call.get("tool_name") != WEATHER_TOOL or call.get("allowed") is not True:
        raise AssertionError(f"weather tool was not executed: {call}")
    if call.get("inputs", {}).get("city") != expected_city:
        raise AssertionError(f"weather city input mismatch: {call}")
    if call.get("inputs", {}).get("days") != expected_days:
        raise AssertionError(f"weather days input mismatch: {call}")
    if call.get("inputs", {}).get("start_day") != expected_start_day:
        raise AssertionError(f"weather start_day input mismatch: {call}")
    if call.get("connector") != "Open-Meteo":
        raise AssertionError(f"weather connector mismatch: {call}")
    result = call.get("result") or {}
    if result.get("ok") is not expected_ok:
        raise AssertionError(f"weather tool result status mismatch: {call}")
    if result.get("source") != "Open-Meteo":
        raise AssertionError(f"weather tool result source mismatch: {call}")

    detail = expect_ok(
        client.get(
            f"/enterprise/platform/agent/runs/{turn_id}",
            headers=HEADERS,
        ),
        f"get run {turn_id}",
    )
    if detail.get("turn_id") != turn_id:
        raise AssertionError(f"persisted run ID mismatch: {detail}")
    detail_response = detail.get("response") or {}
    if detail_response.get("routing_mode") != "provider-native":
        raise AssertionError(f"persisted run routing mode mismatch: {detail}")
    if detail_response.get("routing_source") != "agentscope":
        raise AssertionError(f"persisted run routing source mismatch: {detail}")
    persisted_calls = detail_response.get("tool_calls") or []
    if not any(call.get("tool_name") == WEATHER_TOOL for call in persisted_calls):
        raise AssertionError(f"persisted run missing weather tool call: {detail}")
    evidence = detail.get("evidence") or {}
    if evidence.get("tool_call_count") != 1:
        raise AssertionError(f"persisted run missing tool evidence: {detail}")
    if not detail.get("runtime_invocation_id"):
        raise AssertionError(f"persisted run missing runtime invocation: {detail}")
    invocation_result = detail.get("runtime_invocation_result") or {}
    boundary_result = (
        invocation_result.get("raw", {}).get("runtime_boundary_result", {})
    )
    runtime_bridge = boundary_result.get("raw", {}).get("runtime_bridge", {})
    if runtime_bridge.get("type") != "agentscope_native_in_process":
        raise AssertionError(f"persisted invocation did not use AgentScope: {detail}")
    if boundary_result.get("evidence", {}).get("runtime") != "agentscope":
        raise AssertionError(f"AgentScope runtime evidence missing: {detail}")
    if not boundary_result.get("provider_run_id"):
        raise AssertionError(f"AgentScope provider run ID missing: {detail}")
    if detail.get("agent_id") != agent_id:
        raise AssertionError(f"persisted run agent mismatch: {detail}")


def run_success_case(
    client: TestClient,
    *,
    agent_id: str,
    session_id: str,
    question: str,
    expected_city: str,
    expected_days: int,
    expected_start_day: int,
) -> dict[str, Any]:
    run = expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=HEADERS,
            json={
                "question": question,
                "user_id": USER_ID,
                "agent_id": agent_id,
                "session_id": session_id,
            },
        ),
        f"run {question}",
    )
    answer = str(run.get("answer") or "")
    if WEATHER_TOOL in answer:
        raise AssertionError(f"{question} answer exposed internal tool name: {answer}")
    for marker in ("最高", "最低", "降雨概率", "风速", "建议"):
        if marker not in answer:
            raise AssertionError(f"{question} answer missing {marker}: {answer}")
    if expected_city not in answer:
        raise AssertionError(f"{question} answer missing city: {answer}")

    result = run.get("result") or {}
    if result.get("ok") is not True or result.get("source") != "Open-Meteo":
        raise AssertionError(f"{question} did not return real weather result: {run}")
    forecasts = result.get("forecasts") or []
    if len(forecasts) != expected_days:
        raise AssertionError(f"{question} forecast count mismatch: {run}")
    for forecast in forecasts:
        required = {
            "date",
            "condition",
            "temperature_max_c",
            "temperature_min_c",
            "precipitation_probability_percent",
            "wind_speed_max_kmh",
            "advice",
        }
        if not required.issubset(forecast):
            raise AssertionError(f"{question} forecast fields missing: {forecast}")

    inputs = run.get("inputs") or {}
    if inputs.get("days") != expected_days or inputs.get("start_day") != expected_start_day:
        raise AssertionError(f"{question} route options mismatch: {run}")
    assert_persisted_run(
        client,
        agent_id=agent_id,
        run=run,
        expected_city=expected_city,
        expected_days=expected_days,
        expected_start_day=expected_start_day,
        expected_ok=True,
    )
    print(f"PASS {question}: {len(forecasts)} day(s), turn_id={run['turn_id']}")
    return run


def run_missing_city_case(
    client: TestClient,
    *,
    agent_id: str,
    session_id: str,
) -> dict[str, Any]:
    city = "火星ZXQ"
    question = f"{city}天气"
    run = expect_ok(
        client.post(
            "/enterprise/platform/agent/run",
            headers=HEADERS,
            json={
                "question": question,
                "user_id": USER_ID,
                "agent_id": agent_id,
                "session_id": session_id,
            },
        ),
        "run nonexistent city",
    )
    answer = str(run.get("answer") or "")
    result = run.get("result") or {}
    error = str(result.get("error") or "")
    if result.get("ok") is not False or "没有找到城市" not in error:
        raise AssertionError(f"nonexistent city error mismatch: {run}")
    if not all(marker in answer for marker in ("抱歉", "无法", "城市")):
        raise AssertionError(f"nonexistent city answer was not friendly: {run}")
    if result.get("forecasts"):
        raise AssertionError(f"nonexistent city returned forecasts: {run}")
    if result.get("forecasts") or any(
        marker in answer
        for marker in ("最高温度：", "最低温度：", "降雨概率：", "风速：", "℃", "°C")
    ):
        raise AssertionError(f"nonexistent city fabricated weather: {run}")
    assert_persisted_run(
        client,
        agent_id=agent_id,
        run=run,
        expected_city=city,
        expected_days=1,
        expected_start_day=0,
        expected_ok=False,
    )
    print(f"PASS nonexistent city: friendly error, turn_id={run['turn_id']}")
    return run


def assert_audit_records(
    client: TestClient,
    *,
    agent_id: str,
    session_id: str,
    expected_calls: int,
) -> None:
    payload = expect_ok(
        client.get(
            "/enterprise/platform/audit",
            headers=HEADERS,
            params={"agent_id": agent_id, "tool_name": WEATHER_TOOL, "limit": 20},
        ),
        "query weather audit",
    )
    events = [
        event
        for event in payload.get("events", [])
        if event.get("session_id") == session_id
    ]
    if len(events) != expected_calls:
        raise AssertionError(f"weather audit count mismatch: {payload}")
    for event in events:
        if event.get("connector") != "Open-Meteo":
            raise AssertionError(f"weather audit connector mismatch: {event}")
        if event.get("tool_name") != WEATHER_TOOL:
            raise AssertionError(f"weather audit tool mismatch: {event}")
        if not event.get("event_id") or not event.get("timestamp"):
            raise AssertionError(f"weather audit identity missing: {event}")
    print(f"PASS audit query: {len(events)} weather tool-call event(s)")


def main() -> None:
    session_id = f"weather-agent-acceptance-{uuid4().hex[:12]}"
    with TestClient(platform_app.app) as client:
        agent_id = ensure_weather_agent(client)
        runs = [
            run_success_case(
                client,
                agent_id=agent_id,
                session_id=session_id,
                question="北京明天天气",
                expected_city="北京",
                expected_days=1,
                expected_start_day=1,
            ),
            run_success_case(
                client,
                agent_id=agent_id,
                session_id=session_id,
                question="上海未来三天天气",
                expected_city="上海",
                expected_days=3,
                expected_start_day=0,
            ),
            run_missing_city_case(
                client,
                agent_id=agent_id,
                session_id=session_id,
            ),
        ]
        assert_audit_records(
            client,
            agent_id=agent_id,
            session_id=session_id,
            expected_calls=len(runs),
        )
    print("PASS weather agent end-to-end acceptance")


if __name__ == "__main__":
    main()
