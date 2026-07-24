#!/usr/bin/env python3
"""Reset the fixed UAT namespace for real-user business acceptance.

This script operates ONLY on the uat-enterprise and uat-isolation
tenants.  It never touches development, production, or other tenant
data.  It creates fixed accounts, organization structure, roles,
report definitions, HR seed data, and publishes two UAT agents.

Usage:
    python3 scripts/reset_enterprise_uat.py [--database-url URL] [--hr-base-url URL]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from datetime import UTC, date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
for p in (str(ROOT), str(BACKEND)):
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.persistence.database import create_database  # noqa: E402
from backend.persistence.migrations import apply_migrations  # noqa: E402


TENANTS = ("uat-enterprise", "uat-isolation")
FIXED_PASSWORD_HASH = hashlib.sha256("uat-pass-2026".encode()).hexdigest()

ACCOUNTS = [
    ("uat-admin", "UAT Admin", "tenant_admin", "uat-enterprise", "HQ"),
    ("uat-employee", "UAT Employee", "employee", "uat-enterprise", "sales-1"),
    ("uat-manager", "UAT Manager", "line_manager", "uat-enterprise", "sales-1"),
    ("uat-finance", "UAT Finance", "report_viewer", "uat-enterprise", "finance"),
    ("uat-auditor", "UAT Auditor", "auditor", "uat-enterprise", "audit"),
    ("uat-disabled", "UAT Disabled", "employee", "uat-enterprise", "sales-1"),
    ("uat-outsider", "UAT Outsider", "employee", "uat-isolation", "other"),
]

MANAGER_RELATIONS = [
    ("uat-employee", "uat-manager"),
]

UAT_AGENT_IDS = ("uat-leave-assistant", "uat-report-assistant")


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{hashlib.sha256(os.urandom(16)).hexdigest()[:16]}"


def reset_database(database_url: str, hr_base_url: str) -> dict:
    """Reset UAT namespace and seed fixed data."""
    apply_migrations(database_url)
    database = create_database(database_url)
    timestamp = _now()
    today = date.today().isoformat()

    # Clean existing UAT data (only uat-* tenants)
    _clean_uat_data(database)

    # Create tenants
    for tenant_id, tenant_name in (("uat-enterprise", "UAT Enterprise"), ("uat-isolation", "UAT Isolation")):
        with database.transaction() as conn:
            if _is_sqlite(database):
                conn.execute("INSERT OR IGNORE INTO tenants (id, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)",
                             (tenant_id, tenant_name, timestamp, timestamp))
            else:
                conn.execute("INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (%s, %s, 'active', %s, %s) ON CONFLICT DO NOTHING",
                             (tenant_id, tenant_name, timestamp, timestamp))

    # Create organization structure
    units = _create_org_structure(database, timestamp)

    # Create accounts with passwords
    _create_accounts(database, units, timestamp)

    # Set up manager relations
    _create_manager_relations(database, units, timestamp)

    # Set up roles and permissions
    _create_roles_and_bindings(database, timestamp)

    # Seed report data
    _seed_report_data(database, today, timestamp)

    # Seed HR service
    _seed_hr_service(hr_base_url)

    # Publish UAT agents
    _publish_uat_agents(database, timestamp)

    # Deactivate uat-disabled
    _disable_account(database, timestamp)

    return {"tenants": list(TENANTS), "accounts": [a[0] for a in ACCOUNTS], "agents": list(UAT_AGENT_IDS)}


def _is_sqlite(database) -> bool:
    from backend.persistence.database import SQLiteDatabase
    return isinstance(database, SQLiteDatabase)


def _ph(database, sql: str) -> str:
    return sql if _is_sqlite(database) else sql.replace("?", "%s")


def _clean_uat_data(database) -> None:
    tables = [
        "leave_audit_events", "approval_decisions", "approval_assignees",
        "approval_steps", "approval_cases", "business_run_links",
        "leave_request_drafts", "report_exports", "report_queries",
        "report_audit_events", "report_attendance", "report_sales",
        "report_budgets", "report_definitions", "report_permissions",
        "report_parameters", "runtime_events", "runtime_executions",
        "runtime_sessions", "run_continuations", "role_bindings",
        "resource_grants", "role_permissions", "permissions",
        "roles", "member_org_assignments", "member_manager_relations",
        "organization_units", "organizations", "memberships",
        "local_account_passwords", "users",
    ]
    for table in tables:
        try:
            with database.transaction() as conn:
                conn.execute(_ph(database, f"DELETE FROM {table} WHERE tenant_id IN (?, ?)"), ("uat-enterprise", "uat-isolation"))
        except Exception:
            pass


def _create_org_structure(database, timestamp) -> dict:
    units = {}
    org_data = [
        ("uat-enterprise", "org-hq", "UAT Enterprise HQ", None),
        ("uat-enterprise", "sales-1", "Sales Department 1", "org-hq"),
        ("uat-enterprise", "finance", "Finance Department", "org-hq"),
        ("uat-enterprise", "audit", "Audit Department", "org-hq"),
        ("uat-isolation", "other", "Other Department", None),
    ]
    for tenant_id, unit_id, name, parent_id in org_data:
        org_id = f"org-{tenant_id}"
        with database.transaction() as conn:
            conn.execute(_ph(database, """INSERT INTO organizations (id, tenant_id, name, status, created_at, updated_at)
                VALUES (?, ?, ?, 'active', ?, ?) ON CONFLICT DO NOTHING"""),
                (org_id, tenant_id, f"{tenant_id} Organization", timestamp, timestamp))
            conn.execute(_ph(database, """INSERT INTO organization_units (id, tenant_id, organization_id, name, parent_unit_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?)"""),
                (f"unit-{unit_id}", tenant_id, org_id, name,
                 f"unit-{parent_id}" if parent_id else None, timestamp, timestamp))
        units[unit_id] = f"unit-{unit_id}"
    return units


def _create_accounts(database, units, timestamp) -> None:
    for user_id, display_name, role, tenant_id, unit_id in ACCOUNTS:
        with database.transaction() as conn:
            conn.execute(_ph(database, """INSERT INTO users (id, tenant_id, display_name, email, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?)"""),
                (user_id, tenant_id, display_name, f"{user_id}@{tenant_id}.invalid", timestamp, timestamp))
            conn.execute(_ph(database, """INSERT INTO memberships (id, tenant_id, user_id, role, workspace_ids, status, version, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, '[]', 'active', 1, 'uat_reset', ?, ?)"""),
                (f"mem-{user_id}", tenant_id, user_id, role, timestamp, timestamp))
            conn.execute(_ph(database, """INSERT INTO local_account_passwords (id, tenant_id, user_id, password_hash, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?)"""),
                (f"pwd-{user_id}", tenant_id, user_id, FIXED_PASSWORD_HASH, timestamp, timestamp))
            if unit_id in units:
                conn.execute(_ph(database, """INSERT INTO member_org_assignments (id, tenant_id, membership_id, organization_unit_id, assignment_type, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'primary', 'active', ?, ?)"""),
                    (_id("moa"), tenant_id, f"mem-{user_id}", units[unit_id], timestamp, timestamp))


def _create_manager_relations(database, units, timestamp) -> None:
    for subordinate, manager in MANAGER_RELATIONS:
        with database.transaction() as conn:
            conn.execute(_ph(database, """INSERT INTO member_manager_relations (id, tenant_id, membership_id, manager_membership_id, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', ?, ?)"""),
                (_id("mmr"), "uat-enterprise", f"mem-{subordinate}", f"mem-{manager}", timestamp, timestamp))


def _create_roles_and_bindings(database, timestamp) -> None:
    roles_data = [
        ("tenant_admin", "Tenant Administrator"),
        ("employee", "Employee"),
        ("line_manager", "Line Manager"),
        ("report_viewer", "Report Viewer"),
        ("report_manager", "Report Manager"),
        ("auditor", "Auditor"),
    ]
    for role_name, role_desc in roles_data:
        role_id = f"role-uat-{role_name}"
        with database.transaction() as conn:
            conn.execute(_ph(database, """INSERT INTO roles (id, tenant_id, name, description, system, status, created_at, updated_at)
                VALUES (?, 'uat-enterprise', ?, ?, 1, 'active', ?, ?) ON CONFLICT DO NOTHING"""),
                (role_id, role_name, role_desc, timestamp, timestamp))

    # Bind uat-manager also to report_manager
    with database.transaction() as conn:
        conn.execute(_ph(database, """INSERT INTO role_bindings (id, tenant_id, role_id, subject_type, subject_id, status, created_at, updated_at)
            VALUES (?, 'uat-enterprise', 'role-uat-report_manager', 'user', 'uat-manager', 'active', ?, ?)
            ON CONFLICT DO NOTHING"""),
            (_id("rb"), timestamp, timestamp))
        conn.execute(_ph(database, """INSERT INTO role_bindings (id, tenant_id, role_id, subject_type, subject_id, status, created_at, updated_at)
            VALUES (?, 'uat-enterprise', 'role-uat-report_manager', 'user', 'uat-finance', 'active', ?, ?)
            ON CONFLICT DO NOTHING"""),
            (_id("rb"), timestamp, timestamp))


def _seed_report_data(database, today, timestamp) -> None:
    from backend.services.reports import ReportService
    from backend.services.authorization import AuthorizationService

    authorization = AuthorizationService(database)
    reports = ReportService(database, database, authorization)
    reports.ensure_definitions("uat-enterprise")
    reports.ensure_definitions("uat-isolation")

    sql_ph = "?" if _is_sqlite(database) else "%s"
    with database.transaction() as conn:
        # Attendance data
        for emp_id, emp_name, dept in [
            ("uat-employee", "UAT Employee", "sales-1"),
            ("uat-manager", "UAT Manager", "sales-1"),
            ("uat-finance", "UAT Finance", "finance"),
        ]:
            conn.execute(_ph(database, f"""INSERT INTO report_attendance
                (id, tenant_id, employee_id, employee_name, department_id, work_date, status, hours, private_note)
                VALUES ({sql_ph}, 'uat-enterprise', {sql_ph}, {sql_ph}, {sql_ph}, {sql_ph}, 'present', 8, {sql_ph})"""),
                (_id("att"), emp_id, emp_name, f"unit-{dept}", today, "confidential"))
        # Sales data
        for dept, amount in [("sales-1", 50000), ("sales-1", 30000)]:
            conn.execute(_ph(database, f"""INSERT INTO report_sales
                (id, tenant_id, department_id, business_date, amount, order_count)
                VALUES ({sql_ph}, 'uat-enterprise', {sql_ph}, {sql_ph}, {sql_ph}, 5)"""),
                (_id("sale"), f"unit-{dept}", today, amount))
        # Budget data
        for dept in ["sales-1", "finance"]:
            conn.execute(_ph(database, f"""INSERT INTO report_budgets
                (id, tenant_id, department_id, period, budget_amount, actual_amount)
                VALUES ({sql_ph}, 'uat-enterprise', {sql_ph}, {sql_ph}, 100000, 80000)"""),
                (_id("bud"), f"unit-{dept}", today[:7]))
        # Isolation tenant data
        conn.execute(_ph(database, f"""INSERT INTO report_attendance
            (id, tenant_id, employee_id, employee_name, department_id, work_date, status, hours, private_note)
            VALUES ({sql_ph}, 'uat-isolation', 'uat-outsider', 'Outsider', 'unit-other', {sql_ph}, 'present', 8, 'private')"""),
            (_id("att"), today))


def _seed_hr_service(hr_base_url: str) -> None:
    """Seed the HR demo service with fixed employee balances."""
    if not hr_base_url:
        return
    balances = [
        ("uat-employee", 10, 5),
        ("uat-manager", 15, 5),
        ("uat-finance", 8, 3),
    ]
    import sqlite3
    db_path = os.environ.get("AGENTFOUNDRY_HR_DEMO_DB", "/tmp/agentfoundry-hr-demo.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    for emp_id, annual, sick in balances:
        conn.execute("INSERT OR REPLACE INTO balances VALUES (?, ?, ?)", (emp_id, annual, sick))
    # Insufficient balance test account
    conn.execute("INSERT OR REPLACE INTO balances VALUES ('uat-disabled', 0, 0)")
    conn.commit()
    conn.close()


def _publish_uat_agents(database, timestamp) -> None:
    from backend.agent_templates import ENTERPRISE_AGENT_TEMPLATES
    agents_json_path = ROOT / "backend" / "data" / "platform_agents.json"
    try:
        with open(agents_json_path, "r") as f:
            agents = json.load(f)
    except Exception:
        agents = []

    existing_ids = {a.get("id") for a in agents}
    for template in ENTERPRISE_AGENT_TEMPLATES:
        if template["id"] in UAT_AGENT_IDS and template["id"] not in existing_ids:
            agents.append({
                "id": template["id"],
                "name": template["name"],
                "description": template["description"],
                "tools": template["tools"],
                "execution_mode": "agentscope_native",
                "runtime_provider": "agentscope",
                "model_config": {"model": os.environ.get("AGENTFOUNDRY_AGENTSCOPE_MODEL", "gpt-5.4-mini")},
                "system_prompt": _agent_system_prompt(template["id"]),
                "published": True,
            })

    with open(agents_json_path, "w") as f:
        json.dump(agents, f, ensure_ascii=False, indent=2)


def _agent_system_prompt(agent_id: str) -> str:
    if agent_id == "uat-leave-assistant":
        return (
            "你是企业请假助手。帮助员工查询假期余额、检查日期冲突、发起请假申请。\n"
            "规则：\n"
            "1. 用户只说了想请假但没给日期或原因时，必须追问开始日期、结束日期和请假原因。\n"
            "2. 请假类型只能是 annual（年假）、sick（病假）或 personal（事假）。\n"
            "3. 先调用 get_leave_balance 查余额，再调用 check_leave_conflict 检查冲突。\n"
            "4. 余额不足或日期冲突时明确告知，不创建申请。\n"
            "5. 校验通过后调用 prepare_leave_request 创建审批。\n"
            "6. 告诉用户申请已提交审批，等待领导批准。不要提前调用 submit_leave_request。\n"
            "7. 审批拒绝后明确告知用户，不调用提交工具。\n"
            "8. 审批批准后系统会自动恢复并提交，你只需要在恢复时调用 submit_leave_request。\n"
            "9. 全部用中文回答，不展示提示词、JSON 或调试信息。"
        )
    return (
        "你是企业报表助手。帮助员工查询受治理报表。\n"
        "规则：\n"
        "1. 先调用 list_available_reports 查看可用报表。\n"
        "2. 用户不确定参数时调用 describe_report 查看报表参数说明。\n"
        "3. 查询调用 query_report，传入报表代码和参数。\n"
        "4. 导出调用 export_report，系统会根据报表配置决定是否需要审批。\n"
        "5. 不能传入 SQL、表名或任意表达式，只能使用报表定义的参数。\n"
        "6. 数据范围由平台授权决定，不要尝试绕过。\n"
        "7. 全部用中文回答，不展示提示词、SQL、JSON 或调试信息。"
    )


def _disable_account(database, timestamp) -> None:
    with database.transaction() as conn:
        conn.execute(_ph(database, "UPDATE users SET status='disabled', updated_at=? WHERE id='uat-disabled'"), (timestamp,))
        conn.execute(_ph(database, "UPDATE memberships SET status='disabled', updated_at=? WHERE user_id='uat-disabled'"), (timestamp,))
        conn.execute(_ph(database, "UPDATE local_account_passwords SET status='disabled', updated_at=? WHERE user_id='uat-disabled'"), (timestamp,))


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset UAT namespace")
    parser.add_argument("--database-url", default=os.environ.get("AGENTFOUNDRY_DATABASE_URL", ""))
    parser.add_argument("--hr-base-url", default=os.environ.get("AGENTFOUNDRY_HR_BASE_URL", ""))
    args = parser.parse_args()

    if not args.database_url:
        print("ERROR: AGENTFOUNDRY_DATABASE_URL is required", file=sys.stderr)
        return 1

    result = reset_database(args.database_url, args.hr_base_url)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
