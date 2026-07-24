"""Governed fixed-report query gateway with tenant and organization scoping."""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from backend.persistence.database import PostgresDatabase, SQLiteDatabase, create_database
from backend.services.authorization import AuthorizationService, build_authorization_service


REPORTS: dict[str, dict[str, Any]] = {
    "attendance": {
        "name": "员工考勤",
        "description": "按日期查询员工考勤；敏感备注按权限脱敏。",
        "parameters": {"start_date": "date", "end_date": "date"},
        "fields": ["employee_id", "employee_name", "department_id", "work_date", "status", "hours", "private_note"],
        "sensitive": ["private_note"],
        "scopes": ["self", "direct_reports", "department", "department_tree", "explicit_departments", "tenant"],
        "max_days": 31,
        "max_rows": 200,
        "export_approval": "line_manager",
    },
    "sales_summary": {
        "name": "销售汇总",
        "description": "按部门和日期汇总销售金额与订单数。",
        "parameters": {"start_date": "date", "end_date": "date"},
        "fields": ["department_id", "amount", "order_count"],
        "sensitive": [],
        "scopes": ["department", "department_tree", "explicit_departments", "tenant"],
        "max_days": 92,
        "max_rows": 100,
        "export_approval": "none",
    },
    "department_budget": {
        "name": "部门预算",
        "description": "按月份查询部门预算与实际支出。",
        "parameters": {"period": "month"},
        "fields": ["department_id", "period", "budget_amount", "actual_amount"],
        "sensitive": ["budget_amount", "actual_amount"],
        "scopes": ["department", "department_tree", "explicit_departments", "tenant"],
        "max_days": 366,
        "max_rows": 100,
        "export_approval": "report_role",
    },
}


class ReportError(ValueError):
    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(detail)
        self.status_code, self.code, self.detail = status_code, code, detail


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _now_dt() -> datetime:
    return datetime.now(UTC)


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest(value: Any) -> str:
    return hashlib.sha256(_json(value).encode()).hexdigest()


@dataclass
class ReportService:
    database: SQLiteDatabase | PostgresDatabase
    report_database: SQLiteDatabase | PostgresDatabase
    authorization: AuthorizationService

    @property
    def _sqlite(self) -> bool:
        return isinstance(self.database, SQLiteDatabase)

    @property
    def _report_sqlite(self) -> bool:
        return isinstance(self.report_database, SQLiteDatabase)

    def _sql(self, sql: str, *, report: bool = False) -> str:
        sqlite = self._report_sqlite if report else self._sqlite
        return sql if sqlite else sql.replace("?", "%s")

    @staticmethod
    def _row(row: Any) -> dict[str, Any]:
        return dict(row)

    def _one(self, connection: Any, sql: str, params: tuple[Any, ...] = (), *, report: bool = False) -> dict[str, Any] | None:
        row = connection.execute(self._sql(sql, report=report), params).fetchone()
        return None if row is None else self._row(row)

    def _all(self, connection: Any, sql: str, params: tuple[Any, ...] = (), *, report: bool = False) -> list[dict[str, Any]]:
        return [self._row(row) for row in connection.execute(self._sql(sql, report=report), params).fetchall()]

    def ensure_definitions(self, tenant_id: str) -> None:
        timestamp = _now()
        with self.database.transaction() as connection:
            for code, definition in REPORTS.items():
                report_id = f"report_{tenant_id}_{code}"
                if self._one(connection, "SELECT id FROM report_definitions WHERE tenant_id=? AND code=?", (tenant_id, code)):
                    continue
                connection.execute(self._sql("""INSERT INTO report_definitions
                  (id, tenant_id, code, name, description, version, parameter_schema,
                   visible_fields, sensitive_fields, supported_scopes, max_days, max_rows,
                   export_policy, status, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'approval', 'active', ?, ?)"""),
                  (report_id, tenant_id, code, definition["name"], definition["description"],
                   _json(definition["parameters"]), _json(definition["fields"]),
                   _json(definition["sensitive"]), _json(definition["scopes"]),
                   definition["max_days"], definition["max_rows"], timestamp, timestamp))
                for name, kind in definition["parameters"].items():
                    connection.execute(self._sql("""INSERT INTO report_parameters
                      (id, tenant_id, report_id, name, parameter_type, required, created_at)
                      VALUES (?, ?, ?, ?, ?, 0, ?)"""),
                      (_id("rparam"), tenant_id, report_id, name, kind, timestamp))

    def _definition(self, tenant_id: str, code: str) -> dict[str, Any]:
        self.ensure_definitions(tenant_id)
        with self.database.connect() as connection:
            row = self._one(connection, "SELECT * FROM report_definitions WHERE tenant_id=? AND code=? AND status='active'", (tenant_id, code))
        if row is None:
            raise ReportError(404, "REPORT_NOT_FOUND", "报表不存在或未发布。")
        for key in ("parameter_schema", "visible_fields", "sensitive_fields", "supported_scopes"):
            row[key] = json.loads(row[key])
        return row

    def _audit(self, *, tenant_id: str, actor_id: str, action: str, resource_id: str | None,
               request_id: str, outcome: str, decision_id: str | None = None,
               metadata: dict[str, Any] | None = None) -> None:
        safe = {key: value for key, value in (metadata or {}).items()
                if key not in {"rows", "sql", "password", "token", "credential"}}
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO report_audit_events
              (id, tenant_id, actor_id, action, resource_type, resource_id, request_id,
               authorization_decision_id, outcome, metadata, created_at)
              VALUES (?, ?, ?, ?, 'report', ?, ?, ?, ?, ?, ?)"""),
              (_id("raud"), tenant_id, actor_id, action, resource_id, request_id,
               decision_id, outcome, _json(safe), _now()))

    def list_reports(self, tenant_id: str, actor_id: str, request_id: str = "") -> list[dict[str, Any]]:
        self.ensure_definitions(tenant_id)
        with self.database.connect() as connection:
            rows = self._all(connection, "SELECT code, name, description, version, parameter_schema, visible_fields, sensitive_fields, supported_scopes, max_days, max_rows, export_policy FROM report_definitions WHERE tenant_id=? AND status='active' ORDER BY code", (tenant_id,))
        visible = []
        for row in rows:
            decision = self.authorization.authorize(tenant_id=tenant_id, subject_id=actor_id,
                action="report.read", resource={"type": "report", "id": row["code"]},
                environment={"request_id": request_id})
            if decision["allowed"]:
                for key in ("parameter_schema", "visible_fields", "sensitive_fields", "supported_scopes"):
                    row[key] = json.loads(row[key])
                visible.append(row)
        return visible

    def describe(self, tenant_id: str, actor_id: str, code: str, request_id: str = "") -> dict[str, Any]:
        definition = self._definition(tenant_id, code)
        decision = self.authorization.authorize(tenant_id=tenant_id, subject_id=actor_id,
            action="report.read", resource={"type": "report", "id": code}, environment={"request_id": request_id})
        if not decision["allowed"]:
            raise ReportError(403, "REPORT_ACCESS_DENIED", "无权查看该报表。")
        return {key: definition[key] for key in ("code", "name", "description", "version", "parameter_schema", "visible_fields", "sensitive_fields", "supported_scopes", "max_days", "max_rows", "export_policy")}

    def _parameters(self, definition: dict[str, Any], parameters: dict[str, Any]) -> dict[str, str]:
        forbidden = {"sql", "table", "table_name", "order_by", "query"} & set(parameters)
        unknown = set(parameters) - set(definition["parameter_schema"])
        if forbidden or unknown:
            raise ReportError(422, "INVALID_REPORT_PARAMETER", "报表参数包含不允许的字段。")
        today = date.today()
        if definition["code"] in {"attendance", "sales_summary"}:
            try:
                start = date.fromisoformat(str(parameters.get("start_date") or today - timedelta(days=6)))
                end = date.fromisoformat(str(parameters.get("end_date") or today))
            except ValueError as exc:
                raise ReportError(422, "INVALID_DATE", "日期格式必须为 YYYY-MM-DD。") from exc
            if end < start or (end - start).days + 1 > int(definition["max_days"]):
                raise ReportError(422, "DATE_RANGE_EXCEEDED", "日期范围无效或超过该报表上限。")
            return {"start_date": start.isoformat(), "end_date": end.isoformat()}
        period = str(parameters.get("period") or today.strftime("%Y-%m"))
        try:
            datetime.strptime(period, "%Y-%m")
        except ValueError as exc:
            raise ReportError(422, "INVALID_PERIOD", "月份格式必须为 YYYY-MM。") from exc
        return {"period": period}

    def _membership_scope(self, tenant_id: str, actor_id: str, decision: dict[str, Any]) -> tuple[list[str], list[str]]:
        with self.database.connect() as connection:
            membership = self._one(connection, "SELECT id FROM memberships WHERE tenant_id=? AND user_id=? AND status='active'", (tenant_id, actor_id))
            if membership is None:
                return [], []
            employee_ids = [actor_id]
            if decision["effective_scope"] == "direct_reports":
                reports = self._all(connection, """SELECT memberships.user_id FROM member_manager_relations
                  JOIN memberships ON memberships.id=member_manager_relations.membership_id
                  WHERE member_manager_relations.tenant_id=? AND member_manager_relations.manager_membership_id=?
                    AND member_manager_relations.status='active' AND memberships.status='active'""", (tenant_id, membership["id"]))
                employee_ids.extend(row["user_id"] for row in reports)
            primary = decision["scope_details"].get("primary_department_id")
            departments: list[str] = []
            scope = decision["effective_scope"]
            if scope in {"department", "department_tree"} and primary:
                departments = [primary]
                if scope == "department_tree":
                    units = self._all(connection, "SELECT id, parent_id FROM organization_units WHERE tenant_id=? AND status='active'", (tenant_id,))
                    changed = True
                    while changed:
                        changed = False
                        for unit in units:
                            if unit["parent_id"] in departments and unit["id"] not in departments:
                                departments.append(unit["id"]); changed = True
            elif scope == "explicit_departments":
                departments = list(decision["scope_details"].get("explicit_departments") or [])
        return sorted(set(employee_ids)), sorted(set(departments))

    @staticmethod
    def _in_clause(values: list[str]) -> tuple[str, tuple[str, ...]]:
        return ",".join("?" for _ in values), tuple(values)

    def _execute(self, definition: dict[str, Any], tenant_id: str, params: dict[str, str],
                 scope: str, employee_ids: list[str], departments: list[str]) -> list[dict[str, Any]]:
        code, limit = definition["code"], int(definition["max_rows"]) + 1
        if code == "attendance" and scope in {"self", "direct_reports"} and not employee_ids:
            return []
        if scope in {"department", "department_tree", "explicit_departments"} and not departments:
            return []
        with self.report_database.connect() as connection:
            if code == "attendance":
                sql = "SELECT employee_id, employee_name, department_id, work_date, status, hours, private_note FROM report_attendance WHERE tenant_id=? AND work_date>=? AND work_date<=?"
                args: tuple[Any, ...] = (tenant_id, params["start_date"], params["end_date"])
                if scope in {"self", "direct_reports"}:
                    marks, values = self._in_clause(employee_ids); sql += f" AND employee_id IN ({marks})"; args += values
                elif scope in {"department", "department_tree", "explicit_departments"}:
                    marks, values = self._in_clause(departments); sql += f" AND department_id IN ({marks})"; args += values
                elif scope != "tenant":
                    return []
                sql += " ORDER BY work_date, employee_id LIMIT ?"; args += (limit,)
            elif code == "sales_summary":
                sql = "SELECT department_id, SUM(amount) AS amount, SUM(order_count) AS order_count FROM report_sales WHERE tenant_id=? AND business_date>=? AND business_date<=?"
                args = (tenant_id, params["start_date"], params["end_date"])
                if scope != "tenant":
                    marks, values = self._in_clause(departments); sql += f" AND department_id IN ({marks})"; args += values
                sql += " GROUP BY department_id ORDER BY department_id LIMIT ?"; args += (limit,)
            else:
                sql = "SELECT department_id, period, budget_amount, actual_amount FROM report_budgets WHERE tenant_id=? AND period=?"
                args = (tenant_id, params["period"])
                if scope != "tenant":
                    marks, values = self._in_clause(departments); sql += f" AND department_id IN ({marks})"; args += values
                sql += " ORDER BY department_id LIMIT ?"; args += (limit,)
            return self._all(connection, sql, args, report=True)

    def query(self, *, tenant_id: str, actor_id: str, report_code: str,
              parameters: dict[str, Any], request_id: str = "") -> dict[str, Any]:
        started, query_id = time.monotonic(), _id("rquery")
        definition = self._definition(tenant_id, report_code)
        decision = self.authorization.authorize(tenant_id=tenant_id, subject_id=actor_id,
            action="report.query", resource={"type": "report", "id": report_code},
            environment={"request_id": request_id})
        decision_id, scope = decision["decision_id"], decision["effective_scope"]
        normalized: dict[str, str] = {}
        try:
            if not decision["allowed"]:
                raise ReportError(403, "REPORT_ACCESS_DENIED", "无权查询该报表。")
            normalized = self._parameters(definition, parameters)
            if scope not in definition["supported_scopes"]:
                raise ReportError(403, "REPORT_SCOPE_DENIED", "当前数据范围不允许查询该报表。")
            employees, departments = self._membership_scope(tenant_id, actor_id, decision)
            if scope in {"department", "department_tree", "explicit_departments"} and not departments:
                raise ReportError(403, "REPORT_SCOPE_EMPTY", "当前账号没有可用的部门数据范围。")
            rows = self._execute(definition, tenant_id, normalized, scope, employees, departments)
            truncated = len(rows) > int(definition["max_rows"]); rows = rows[:int(definition["max_rows"])]
            manage = self.authorization.authorize(tenant_id=tenant_id, subject_id=actor_id,
                action="report.manage", resource={"type": "report", "id": report_code},
                environment={"request_id": request_id, "purpose": "sensitive_fields"})
            masked_fields: list[str] = []
            if not manage["allowed"]:
                masked_fields = definition["sensitive_fields"]
                for row in rows:
                    for field in masked_fields:
                        if field in row and row[field] is not None:
                            row[field] = "***"
            duration = int((time.monotonic() - started) * 1000)
            self._record_query(query_id, tenant_id, definition, actor_id, decision_id, request_id,
                normalized, scope, decision["scope_details"], "succeeded", len(rows), truncated, duration, None)
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.query", resource_id=report_code,
                request_id=request_id, outcome="succeeded", decision_id=decision_id,
                metadata={"query_id": query_id, "report_version": definition["version"], "parameter_digest": _digest(normalized), "scope": scope, "row_count": len(rows), "masked_fields": masked_fields})
            return {"query_id": query_id, "report": report_code, "report_version": definition["version"],
                    "authorization_decision_id": decision_id, "effective_scope": scope,
                    "rows": rows, "row_count": len(rows), "truncated": truncated, "masked_fields": masked_fields}
        except ReportError as exc:
            duration = int((time.monotonic() - started) * 1000)
            self._record_query(query_id, tenant_id, definition, actor_id, decision_id, request_id,
                normalized or {"rejected_parameter_digest": _digest(parameters)}, scope,
                decision.get("scope_details", {}), "failed", 0, False, duration, exc.code)
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.query", resource_id=report_code,
                request_id=request_id, outcome="denied" if exc.status_code == 403 else "failed",
                decision_id=decision_id, metadata={"query_id": query_id, "error_code": exc.code, "parameter_digest": _digest(parameters)})
            raise
        except Exception as exc:
            duration = int((time.monotonic() - started) * 1000)
            self._record_query(query_id, tenant_id, definition, actor_id, decision_id, request_id,
                normalized, scope, decision.get("scope_details", {}), "failed", 0, False, duration, "REPORT_SOURCE_UNAVAILABLE")
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.query", resource_id=report_code,
                request_id=request_id, outcome="failed", decision_id=decision_id,
                metadata={"query_id": query_id, "error_code": "REPORT_SOURCE_UNAVAILABLE"})
            raise ReportError(503, "REPORT_SOURCE_UNAVAILABLE", "报表数据源暂时不可用，请稍后重试。") from exc

    def _record_query(self, query_id: str, tenant_id: str, definition: dict[str, Any], actor_id: str,
                      decision_id: str, request_id: str, params: dict[str, Any], scope: str,
                      scope_details: dict[str, Any], status: str, rows: int, truncated: bool,
                      duration: int, error: str | None) -> None:
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO report_queries
              (id, tenant_id, report_id, report_version, requester_id, authorization_decision_id,
               request_id, parameter_digest, parameter_summary, effective_scope, scope_summary,
               status, row_count, truncated, duration_ms, error_code, created_at, completed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
              (query_id, tenant_id, definition["id"], definition["version"], actor_id, decision_id,
               request_id, _digest(params), _json(params), scope, _json(scope_details), status,
               rows, 1 if truncated else 0, duration, error, _now(), _now()))

    def _resolve_export_approver(self, *, tenant_id: str, actor_id: str,
                                  policy: str) -> tuple[str | None, str]:
        """Resolve the export approver based on the report definition policy."""
        if policy == "none":
            return None, "none"
        with self.database.connect() as connection:
            if policy == "line_manager":
                membership = self._one(connection, "SELECT id FROM memberships WHERE tenant_id=? AND user_id=?", (tenant_id, actor_id))
                if not membership:
                    return None, "line_manager"
                manager = self._one(connection, """SELECT memberships.user_id FROM member_manager_relations
                  JOIN memberships ON memberships.id=member_manager_relations.manager_membership_id
                  WHERE member_manager_relations.tenant_id=? AND member_manager_relations.membership_id=? AND member_manager_relations.status='active'""",
                  (tenant_id, membership["id"]))
                if manager and manager["user_id"] != actor_id:
                    return manager["user_id"], "line_manager"
                return None, "line_manager"
            if policy in {"report_role", "configured_group"}:
                members = self._all(connection, """SELECT rb.subject_id FROM role_bindings AS rb
                  JOIN roles AS r ON r.id=rb.role_id
                  WHERE rb.tenant_id=? AND r.name='report_manager' AND rb.subject_type='user'""",
                  (tenant_id,))
                for member in members:
                    if member["subject_id"] != actor_id:
                        return member["subject_id"], policy
                return None, policy
        return None, policy

    def request_export(self, *, tenant_id: str, actor_id: str, report_code: str,
                       parameters: dict[str, Any], idempotency_key: str, request_id: str = "") -> dict[str, Any]:
        definition = self._definition(tenant_id, report_code)
        normalized = self._parameters(definition, parameters)
        decision = self.authorization.authorize(tenant_id=tenant_id, subject_id=actor_id,
            action="report.export", resource={"type": "report", "id": report_code}, environment={"request_id": request_id})
        if not decision["allowed"]:
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.export", resource_id=report_code,
                request_id=request_id, outcome="denied", decision_id=decision["decision_id"], metadata={"parameter_digest": _digest(normalized)})
            raise ReportError(403, "REPORT_EXPORT_DENIED", "无权导出该报表。")
        export_policy = definition.get("export_policy", "line_manager")
        with self.database.connect() as connection:
            existing = self._one(connection, "SELECT * FROM report_exports WHERE tenant_id=? AND idempotency_key=?", (tenant_id, idempotency_key))
            if existing:
                return self._export_response(connection, existing, report_code)
        if export_policy == "none":
            export_id, timestamp = _id("rexport"), _now()
            digest = _digest({"report": report_code, "parameters": normalized, "requester": actor_id})
            with self.database.transaction() as connection:
                connection.execute(self._sql("""INSERT INTO report_exports
                  (id, tenant_id, report_id, requester_id, query_id, approval_case_id,
                   authorization_decision_id, idempotency_key, parameter_digest, status,
                   download_reference, expires_at, created_at, updated_at)
                  VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'completed', ?, ?, ?, ?)"""),
                  (export_id, tenant_id, definition["id"], actor_id,
                   decision["decision_id"], idempotency_key, digest,
                   f"export-{export_id}", (_now_dt() + timedelta(hours=24)).isoformat(), timestamp, timestamp))
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.export", resource_id=report_code,
                request_id=request_id, outcome="completed", decision_id=decision["decision_id"],
                metadata={"export_id": export_id, "policy": "none", "parameter_digest": digest})
            return {"id": export_id, "report": report_code, "status": "completed",
                    "approval_case_id": None, "authorization_decision_id": decision["decision_id"]}
        approver_id, approver_source = self._resolve_export_approver(
            tenant_id=tenant_id, actor_id=actor_id, policy=export_policy)
        if not approver_id:
            self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.export",
                resource_id=report_code, request_id=request_id, outcome="failed",
                decision_id=decision["decision_id"],
                metadata={"error_code": "EXPORT_APPROVER_UNAVAILABLE", "parameter_digest": _digest(normalized), "policy": export_policy})
            raise ReportError(409, "EXPORT_APPROVER_UNAVAILABLE", "未配置可用的导出审批人。")
        with self.database.transaction() as connection:
            existing = self._one(connection, "SELECT * FROM report_exports WHERE tenant_id=? AND idempotency_key=?", (tenant_id, idempotency_key))
            if existing:
                return self._export_response(connection, existing, report_code)
            export_id, case_id, timestamp = _id("rexport"), _id("approval"), _now()
            digest = _digest({"report": report_code, "parameters": normalized, "requester": actor_id})
            connection.execute(self._sql("""INSERT INTO approval_cases
              (id, tenant_id, resource_type, resource_id, requester_id, assignee_id,
               immutable_digest, status, fallback_reason, version, created_at, updated_at)
              VALUES (?, ?, 'report_export', ?, ?, ?, ?, 'pending_approval', NULL, 1, ?, ?)"""),
              (case_id, tenant_id, export_id, actor_id, approver_id, digest, timestamp, timestamp))
            connection.execute(self._sql("""INSERT INTO approval_steps
              (id, tenant_id, approval_case_id, step_number, status, created_at, updated_at)
              VALUES (?, ?, ?, 1, 'pending', ?, ?)"""), (_id("astep"), tenant_id, case_id, timestamp, timestamp))
            connection.execute(self._sql("""INSERT INTO approval_assignees
              (id, tenant_id, approval_case_id, assignee_id, source, created_at)
              VALUES (?, ?, ?, ?, ?, ?)"""), (_id("aasg"), tenant_id, case_id, approver_id, approver_source, timestamp))
            connection.execute(self._sql("""INSERT INTO report_exports
              (id, tenant_id, report_id, requester_id, query_id, approval_case_id,
               authorization_decision_id, idempotency_key, parameter_digest, status,
               download_reference, expires_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 'pending_approval', NULL, NULL, ?, ?)"""),
              (export_id, tenant_id, definition["id"], actor_id, case_id, decision["decision_id"],
               idempotency_key, digest, timestamp, timestamp))
        self._audit(tenant_id=tenant_id, actor_id=actor_id, action="report.export", resource_id=report_code,
            request_id=request_id, outcome="waiting_approval", decision_id=decision["decision_id"],
            metadata={"export_id": export_id, "approval_case_id": case_id, "parameter_digest": digest, "policy": export_policy})
        return {"id": export_id, "report": report_code, "status": "pending_approval",
                "approval_case_id": case_id, "authorization_decision_id": decision["decision_id"]}

    def _export_response(self, connection: Any, export: dict[str, Any], report_code: str | None = None) -> dict[str, Any]:
        if report_code is None:
            definition = self._one(connection, "SELECT code FROM report_definitions WHERE id=?", (export["report_id"],))
            report_code = definition["code"] if definition else ""
        return {
            "id": export["id"],
            "report": report_code,
            "status": export["status"],
            "approval_case_id": export.get("approval_case_id"),
            "authorization_decision_id": export.get("authorization_decision_id"),
        }

    def list_queries(self, tenant_id: str, actor_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            return self._all(connection, "SELECT * FROM report_queries WHERE tenant_id=? AND requester_id=? ORDER BY created_at DESC LIMIT ?", (tenant_id, actor_id, limit))

    def list_exports(self, tenant_id: str, actor_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            return self._all(connection, "SELECT * FROM report_exports WHERE tenant_id=? AND requester_id=? ORDER BY created_at DESC LIMIT ?", (tenant_id, actor_id, limit))

    def list_audit(self, tenant_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            return self._all(connection, "SELECT * FROM report_audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?", (tenant_id, limit))


def build_report_service() -> ReportService | None:
    database_url = os.environ.get("AGENTFOUNDRY_DATABASE_URL", "").strip()
    report_url = os.environ.get("AGENTFOUNDRY_REPORT_DATABASE_URL", "").strip()
    authorization = build_authorization_service()
    if not database_url or not report_url or authorization is None:
        return None
    if os.environ.get("AGENTFOUNDRY_ENV", "").lower() in {"prod", "production"} and not report_url.startswith(("postgresql://", "postgres://")):
        return None
    return ReportService(create_database(database_url), create_database(report_url), authorization)
