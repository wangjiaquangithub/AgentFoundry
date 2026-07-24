#!/usr/bin/env python3
"""Live acceptance checks for PostgreSQL and AgentScope/Open-Meteo.

This script deliberately uses disposable state outside the repository.  It is
split into two commands because the AgentScope virtualenv and the PostgreSQL
driver runtime are independently managed in local and deployment environments.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import tempfile
from copy import deepcopy
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for module_path in (str(ROOT), str(BACKEND)):
    if module_path not in sys.path:
        sys.path.insert(0, module_path)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _postgres_admin_url() -> str:
    return os.environ.get(
        "AGENTFOUNDRY_UAT_POSTGRES_ADMIN_URL",
        "postgresql:///postgres?host=/tmp&port=5432",
    )


def _database_url(database_name: str) -> str:
    admin_url = _postgres_admin_url()
    marker = "/postgres?"
    if marker not in admin_url:
        raise ValueError(
            "AGENTFOUNDRY_UAT_POSTGRES_ADMIN_URL must select the postgres database "
            "and include query parameters."
        )
    return admin_url.replace(marker, f"/{database_name}?", 1)


def run_postgres_uat() -> dict[str, object]:
    import psycopg
    from psycopg import sql

    from backend.persistence.database import create_database
    from backend.persistence.migrations import apply_migrations
    from backend.services.authorization import AuthorizationService
    from backend.services.enterprise_identity import EnterpriseIdentityService
    from backend.services.reports import ReportError, ReportService

    database_name = (
        f"agentfoundry_live_uat_{os.getpid()}_"
        f"{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    )
    database_url = _database_url(database_name)
    admin_url = _postgres_admin_url()
    created = False
    try:
        with psycopg.connect(admin_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))
            )
        created = True
        migrations = apply_migrations(database_url)
        database = create_database(database_url)
        identity = EnterpriseIdentityService(database)
        authorization = AuthorizationService(database)
        reports = ReportService(database, database, authorization)
        timestamp = datetime.now(UTC).isoformat()

        with database.transaction() as connection:
            connection.execute(
                "INSERT INTO tenants (id, name, status, created_at, updated_at) "
                "VALUES (%s, %s, 'active', %s, %s)",
                ("live-uat", "Live UAT", timestamp, timestamp),
            )
            connection.execute(
                "INSERT INTO users (id, display_name, email, status, created_at, updated_at) "
                "VALUES (%s, %s, %s, 'active', %s, %s)",
                ("admin", "Admin", "admin@live-uat.invalid", timestamp, timestamp),
            )
            connection.execute(
                """INSERT INTO memberships
                (id, tenant_id, user_id, role, workspace_ids, status, version, source,
                 created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'active', 1, 'live_uat', %s, %s)""",
                (
                    "mem-admin", "live-uat", "admin", "tenant_admin", "[]",
                    timestamp, timestamp,
                ),
            )

        authorization.ensure_tenant_defaults("live-uat", "admin")
        organization = identity.create_organization(
            tenant_id="live-uat", actor_id="admin", name="Live UAT"
        )
        sales = identity.create_unit(
            tenant_id="live-uat",
            actor_id="admin",
            organization_id=str(organization["id"]),
            name="Sales",
        )
        finance = identity.create_unit(
            tenant_id="live-uat",
            actor_id="admin",
            organization_id=str(organization["id"]),
            name="Finance",
        )
        people: dict[str, dict[str, object]] = {}
        for user_id, role, department in (
            ("employee", "employee", sales),
            ("manager", "line_manager", sales),
            ("other-employee", "employee", finance),
        ):
            person = identity.create_user(
                tenant_id="live-uat",
                actor_id="admin",
                user_id=user_id,
                display_name=user_id,
                email=f"{user_id}@live-uat.invalid",
                role=role,
            )
            identity.assign_unit(
                tenant_id="live-uat",
                actor_id="admin",
                membership_id=str(person["membership_id"]),
                organization_unit_id=str(department["id"]),
                assignment_type="primary",
            )
            people[user_id] = person
        identity.set_manager(
            tenant_id="live-uat",
            actor_id="admin",
            membership_id=str(people["employee"]["membership_id"]),
            manager_membership_id=str(people["manager"]["membership_id"]),
        )
        authorization.ensure_tenant_defaults("live-uat", "admin")

        today = date.today().isoformat()
        with database.transaction() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    """INSERT INTO report_attendance
                    (id, tenant_id, employee_id, employee_name, department_id,
                     work_date, status, hours, private_note)
                    VALUES (%s, 'live-uat', %s, %s, %s, %s, 'present', 8, %s)""",
                    [
                        (
                            "att-employee",
                            "employee",
                            "Employee",
                            sales["id"],
                            today,
                            "medical",
                        ),
                        (
                            "att-manager",
                            "manager",
                            "Manager",
                            sales["id"],
                            today,
                            "private",
                        ),
                        (
                            "att-other",
                            "other-employee",
                            "Other Employee",
                            finance["id"],
                            today,
                            "private",
                        ),
                    ],
                )

        parameters = {"start_date": today, "end_date": today}
        employee_result = reports.query(
            tenant_id="live-uat",
            actor_id="employee",
            report_code="attendance",
            parameters=parameters,
            request_id="live-uat-employee",
        )
        manager_result = reports.query(
            tenant_id="live-uat",
            actor_id="manager",
            report_code="attendance",
            parameters=parameters,
            request_id="live-uat-manager",
        )
        employee_ids = {str(row["employee_id"]) for row in employee_result["rows"]}
        manager_ids = {str(row["employee_id"]) for row in manager_result["rows"]}
        require(employee_ids == {"employee"}, "employee data scope was not enforced")
        require(
            employee_result["rows"][0]["private_note"] == "***",
            "sensitive report field was not masked",
        )
        require(
            manager_ids == {"employee", "manager"},
            "direct-reports data scope was not enforced",
        )
        require("other-employee" not in manager_ids, "cross-department row leaked")

        try:
            reports.query(
                tenant_id="live-uat",
                actor_id="employee",
                report_code="sales_summary",
                parameters=parameters,
                request_id="live-uat-denied",
            )
        except ReportError as exc:
            require(exc.code == "REPORT_SCOPE_DENIED", "unexpected denial error code")
        else:
            raise AssertionError("unauthorized report query was allowed")

        decisions = authorization.list_decisions(
            "live-uat", subject_id="employee"
        )
        queries = reports.list_queries("live-uat", "employee")
        audits = reports.list_audit("live-uat")
        require(
            any(item["action"] == "report.query" for item in decisions),
            "authorization decision was not persisted",
        )
        require(bool(queries), "report query record was not persisted")
        require(bool(audits), "report audit record was not persisted")
        persisted_summary = json.dumps(
            {"queries": queries, "audits": audits}, ensure_ascii=False
        ).lower()
        for forbidden in (
            "select ",
            '"private_note": "medical"',
            '"private_note": "private"',
        ):
            require(forbidden not in persisted_summary, f"audit leaked {forbidden!r}")

        return {
            "backend": "postgresql",
            "migrations_applied": len(migrations),
            "employee_rows": len(employee_result["rows"]),
            "manager_rows": len(manager_result["rows"]),
            "authorization_decisions": len(decisions),
            "report_queries": len(queries),
            "audit_events": len(audits),
        }
    finally:
        if created:
            with psycopg.connect(admin_url, autocommit=True) as connection:
                connection.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (database_name,),
                )
                connection.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {}").format(
                        sql.Identifier(database_name)
                    )
                )


class _UnusedEnterpriseConnector:
    """Connector placeholder; weather is routed directly to Open-Meteo."""

    def __getattr__(self, name: str) -> object:
        raise RuntimeError(f"unexpected live UAT connector access: {name}")


async def run_weather_uat() -> dict[str, object]:
    from agentscope_runtime_provider import AgentScopeNativeInvocationClient
    from audit import ToolAuditLogger
    from enterprise_tools import EnterpriseToolRuntimeFactory
    from permissions import DEFAULT_TOOL_POLICY, ENTERPRISE_TOOL_NAMES, ToolAuthorizationPolicy
    from services.tools import PlatformToolPolicyService

    require(bool(os.environ.get("OPENAI_API_KEY")), "OPENAI_API_KEY is required")
    session_id = f"live-weather-{uuid4().hex}"
    with tempfile.TemporaryDirectory(prefix="agentfoundry-live-weather-") as temp_dir:
        temp_root = Path(temp_dir)
        policy_path = temp_root / "tool-policy.json"
        audit_path = temp_root / "tool-audit.jsonl"
        connector = _UnusedEnterpriseConnector()

        def runtime_context(user_id: str, *, tenant: str | None = None) -> dict[str, object]:
            require(user_id == "acme:alice", "unexpected live UAT user")
            require(tenant in (None, "acme"), "unexpected live UAT tenant")
            return {
                "tenant": "acme",
                "connector": connector,
                "connector_label": "Live UAT Stub",
                "connector_source": "live_uat",
            }

        policy_service = PlatformToolPolicyService(
            policy_path=lambda: policy_path,
            default_policy=deepcopy(DEFAULT_TOOL_POLICY),
            policy_mode=lambda: "strict",
            enterprise_tool_names=ENTERPRISE_TOOL_NAMES,
            runtime_context=runtime_context,
            identity_metadata=lambda _user_id, _tenant: [],
        )
        audit_logger = ToolAuditLogger(
            audit_path, enabled=True, production_mode=False
        )
        runtime = EnterpriseToolRuntimeFactory(
            runtime_context=runtime_context,
            tool_policy_service=lambda: policy_service,
            audit_logger=audit_logger,
            authorization_policy=lambda: ToolAuthorizationPolicy(
                deepcopy(DEFAULT_TOOL_POLICY), mode="strict"
            ),
            tool_names=ENTERPRISE_TOOL_NAMES,
            approval_required_tools=set(),
            approval_validator=lambda **_kwargs: "",
        )
        client = AgentScopeNativeInvocationClient(enterprise_tool_runtime=runtime)
        instructions = (
            "你是天气预报助手。每次请求必须恰好调用一次真实天气工具，不能凭记忆回答。"
            "北京明天使用 days=1、start_day=1；未来三天使用 days=3、start_day=0。"
            "根据工具结果用中文返回城市、日期、天气状况、最高/最低温度、降雨概率、"
            "最大风速和简短建议。城市不存在或服务失败时明确友好说明，不得编造。"
        )
        cases = (
            ("北京明天天气", "北京", 1, 1, True),
            ("上海未来三天天气", "上海", 3, 0, True),
            ("不存在的城市火星ZXQ天气", "火星ZXQ", None, None, False),
        )
        responses: list[dict[str, object]] = []
        for question, city, days, start_day, expected_ok in cases:
            result = await client.invoke(
                {
                    "request": {
                        "context": {
                            "tenant": "acme",
                            "user_id": "acme:alice",
                            "agent_id": "weather-agent",
                            "agent_name": "天气助手",
                            "session_id": session_id,
                        },
                        "question": question,
                        "instructions": instructions,
                        "tools": ["enterprise_get_weather_forecast"],
                        "metadata": {
                            "agent_version_id": "live-uat-v1",
                            "request_id": f"live-weather-{uuid4().hex}",
                            "session_id": session_id,
                        },
                    }
                }
            )
            require(result["status"] == "completed", f"AgentScope failed: {result.get('error')}")
            evidence = result["evidence"]
            require(evidence["runtime"] == "agentscope", "runtime was not AgentScope")
            calls = result["raw"]["tool_calls"]
            require(len(calls) == 1, "AgentScope did not execute exactly one weather tool call")
            call = calls[0]
            require(
                call["tool_name"] == "enterprise_get_weather_forecast",
                "AgentScope selected an unexpected tool",
            )
            require(call["inputs"]["city"] == city, "AgentScope changed the requested city")
            if days is not None:
                require(call["inputs"]["days"] == days, "unexpected forecast day count")
                require(call["inputs"]["start_day"] == start_day, "unexpected forecast start day")
            tool_result = call["result"]
            require(tool_result["ok"] is expected_ok, "unexpected Open-Meteo result")
            if expected_ok:
                require(tool_result["source"] == "Open-Meteo", "weather source was not Open-Meteo")
                require(len(tool_result["forecasts"]) == days, "forecast length mismatch")
                required_fields = {
                    "date", "condition", "temperature_max_c", "temperature_min_c",
                    "precipitation_probability_percent", "wind_speed_max_kmh", "advice",
                }
                require(
                    all(required_fields <= set(item) for item in tool_result["forecasts"]),
                    "forecast fields are incomplete",
                )
            else:
                require(not tool_result.get("forecasts"), "invalid city returned forecasts")
                require("没有找到城市" in tool_result["error"], "invalid city error was unclear")
            answer = str(result["answer"])
            lowered_answer = answer.lower()
            for forbidden in (
                "enterprise_get_weather_forecast", "```json", "system prompt", "debug"
            ):
                require(forbidden not in lowered_answer, "answer exposed internal details")
            responses.append(dict(result))

        runtime_keys = ("application_id", "agent_runtime_id", "session_id")
        for key in runtime_keys:
            require(
                len({str(item["evidence"][key]) for item in responses}) == 1,
                f"AgentScope did not reuse {key}",
            )
        audit_events = audit_logger.query(tenant="acme", limit=20)
        require(len(audit_events) == 3, "tool audit did not persist all weather calls")
        require(
            sum(1 for item in audit_events if item.get("success") is True) == 3,
            "tool audit marked a completed Open-Meteo call as failed",
        )
        return {
            "runtime": "agentscope",
            "model": os.environ.get("AGENTFOUNDRY_AGENTSCOPE_MODEL", "gpt-5.4-mini"),
            "session_reused": True,
            "weather_source": "Open-Meteo",
            "queries": len(responses),
            "tool_calls": sum(int(item["evidence"]["tool_call_count"]) for item in responses),
            "tool_audit_events": len(audit_events),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", choices=("postgres", "weather"))
    args = parser.parse_args()
    if args.target == "postgres":
        summary = run_postgres_uat()
    else:
        summary = asyncio.run(run_weather_uat())
    print(json.dumps({"status": "passed", **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
