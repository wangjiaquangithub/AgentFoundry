"""Governed leave requests, approval, and same-session continuation."""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any, Awaitable, Callable

from backend.hr_client import HRClient, HRServiceError
from backend.persistence.database import PostgresDatabase, SQLiteDatabase
from backend.persistence.database_urls import is_postgres_database_url
from backend.persistence.runtime_lifecycle import RuntimeLifecycleStore
from backend.services.authorization import AuthorizationService
from backend.services.enterprise_identity import EnterpriseIdentityError, EnterpriseIdentityService


class LeaveRequestError(ValueError):
    def __init__(self, status_code: int, detail: str, code: str = "LEAVE_ERROR") -> None:
        super().__init__(detail)
        self.status_code, self.detail, self.code = status_code, detail, code


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _canonical(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest(value: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(value).encode()).hexdigest()


@dataclass(frozen=True)
class LeaveRequestService:
    database: SQLiteDatabase | PostgresDatabase
    identity: EnterpriseIdentityService
    authorization: AuthorizationService
    runtime: RuntimeLifecycleStore
    hr: HRClient
    runtime_resume: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]] | None = None

    @property
    def _sqlite(self) -> bool:
        return not is_postgres_database_url(self.database.database_url)

    def _sql(self, value: str) -> str:
        return value if self._sqlite else value.replace("?", "%s")

    @staticmethod
    def _record(row: Any) -> dict[str, Any]:
        result = dict(row)
        if "metadata" in result:
            try:
                result["metadata"] = json.loads(result["metadata"] or "{}")
            except (TypeError, ValueError):
                result["metadata"] = {}
        return result

    def _one(self, connection: Any, sql: str, values: tuple[Any, ...]) -> dict[str, Any] | None:
        row = connection.execute(self._sql(sql), values).fetchone()
        return None if row is None else self._record(row)

    def _audit(self, connection: Any, *, tenant_id: str, actor_id: str,
               action: str, resource_type: str, resource_id: str,
               outcome: str, request_id: str | None = None,
               business_run_id: str | None = None, session_id: str | None = None,
               execution_id: str | None = None, decision_id: str | None = None,
               metadata: dict[str, Any] | None = None) -> None:
        safe = {k: v for k, v in (metadata or {}).items()
                if k not in {"reason", "token", "password", "credential"}}
        connection.execute(self._sql("""INSERT INTO leave_audit_events
          (id, tenant_id, actor_id, action, resource_type, resource_id, request_id,
           business_run_id, session_id, runtime_execution_id,
           authorization_decision_id, outcome, metadata, occurred_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""),
          (_id("lae"), tenant_id, actor_id, action, resource_type, resource_id,
           request_id, business_run_id, session_id, execution_id, decision_id,
           outcome, _canonical(safe), _now()))

    def _authorize(self, tenant_id: str, subject_id: str, action: str,
                   resource_type: str, resource_id: str | None,
                   request_id: str) -> dict[str, Any]:
        decision = self.authorization.authorize(
            tenant_id=tenant_id, subject_id=subject_id, action=action,
            resource={"type": resource_type, "id": resource_id},
            environment={"request_id": request_id},
        )
        if not decision["allowed"]:
            raise LeaveRequestError(403, "当前账号没有执行此操作的权限", "AUTHORIZATION_DENIED")
        return decision

    def create(self, *, tenant_id: str, actor_id: str, request_id: str,
               leave_type: str, start_date: str, end_date: str, reason: str,
               agent_id: str = "leave-assistant") -> dict[str, Any]:
        try:
            self.identity.require_active_subject(tenant_id, actor_id)
        except EnterpriseIdentityError as exc:
            raise LeaveRequestError(exc.status_code, exc.detail, "IDENTITY_INVALID") from exc
        decision = self._authorize(tenant_id, actor_id, "agent.invoke", "agent", agent_id, request_id)
        try:
            start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)
        except ValueError as exc:
            raise LeaveRequestError(422, "请使用 YYYY-MM-DD 格式填写请假日期") from exc
        normalized_type, normalized_reason = leave_type.strip().lower(), reason.strip()
        if normalized_type not in {"annual", "sick", "personal"}:
            raise LeaveRequestError(422, "请假类型必须是 annual、sick 或 personal")
        if end < start or not normalized_reason:
            raise LeaveRequestError(422, "结束日期不能早于开始日期，且请假原因不能为空")
        days = (end - start).days + 1
        try:
            balance = self.hr.get_balance(actor_id)
            conflict = self.hr.check_conflict(actor_id, start_date, end_date)
        except HRServiceError as exc:
            raise LeaveRequestError(503, str(exc), exc.code) from exc
        if conflict.get("conflict"):
            raise LeaveRequestError(409, "所选日期与已有请假申请冲突", "LEAVE_DATE_CONFLICT")
        if normalized_type in {"annual", "sick"} and float(balance.get(normalized_type, 0)) < days:
            raise LeaveRequestError(409, "可用假期余额不足", "LEAVE_BALANCE_INSUFFICIENT")
        try:
            approver = self.identity.resolve_leave_approver(
                tenant_id=tenant_id,
                requester_id=actor_id,
            )
        except EnterpriseIdentityError as exc:
            raise LeaveRequestError(exc.status_code, exc.detail, "APPROVER_UNAVAILABLE") from exc
        immutable = {"requester_id": actor_id, "leave_type": normalized_type,
                     "start_date": start_date, "end_date": end_date, "reason": normalized_reason}
        digest = _digest(immutable)
        draft_id, case_id = _id("leave"), _id("approval")
        business_run_id, session_id = _id("brun"), _id("ses")
        idempotency_key = f"leave:{tenant_id}:{digest}"
        self.runtime.create_session(tenant_id=tenant_id, subject_id=actor_id,
                                    agent_id=agent_id, session_id=session_id,
                                    metadata={"business_run_id": business_run_id})
        execution = self.runtime.create_execution(
            tenant_id=tenant_id, session_id=session_id, business_run_id=business_run_id,
            state="waiting_approval", context={"request_id": request_id,
            "authorization_decision_id": decision["decision_id"]})
        timestamp = _now()
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO leave_request_drafts
              (id, tenant_id, requester_id, leave_type, start_date, end_date, reason,
               draft_digest, version, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_approval', ?, ?)"""),
              (draft_id, tenant_id, actor_id, normalized_type, start_date, end_date,
               normalized_reason, digest, timestamp, timestamp))
            connection.execute(self._sql("""INSERT INTO approval_cases
              (id, tenant_id, resource_type, resource_id, requester_id, assignee_id,
               immutable_digest, status, fallback_reason, version, created_at, updated_at)
              VALUES (?, ?, 'leave_request', ?, ?, ?, ?, 'pending', ?, 1, ?, ?)"""),
              (case_id, tenant_id, draft_id, actor_id, approver["approver_id"], digest,
               approver["fallback_reason"], timestamp, timestamp))
            connection.execute(self._sql("INSERT INTO approval_steps VALUES (?, ?, ?, 1, 'pending', ?, ?)"),
                               (_id("step"), tenant_id, case_id, timestamp, timestamp))
            connection.execute(self._sql("INSERT INTO approval_assignees VALUES (?, ?, ?, ?, ?, ?)"),
                               (_id("assignee"), tenant_id, case_id, approver["approver_id"], approver["source"], timestamp))
            connection.execute(self._sql("""INSERT INTO business_run_links
              (id, tenant_id, business_run_id, session_id, draft_id, approval_case_id,
               idempotency_key, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting_approval', ?, ?)"""),
              (_id("link"), tenant_id, business_run_id, session_id, draft_id, case_id,
               idempotency_key, timestamp, timestamp))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="leave.approval_requested", resource_type="leave_request",
                        resource_id=draft_id, outcome="waiting_approval", request_id=request_id,
                        business_run_id=business_run_id, session_id=session_id,
                        execution_id=execution["id"], decision_id=decision["decision_id"],
                        metadata={"approval_case_id": case_id, "days": days,
                                  "approver_source": approver["source"]})
        self.runtime.append_event(tenant_id=tenant_id, execution_id=execution["id"],
                                  provider_event_id=f"{execution['id']}:waiting",
                                  event_type="waiting_approval",
                                  payload={"approval_case_id": case_id})
        return self.get_run(tenant_id, business_run_id)

    def _case(self, tenant_id: str, case_id: str) -> dict[str, Any]:
        with self.database.connect() as connection:
            row = self._one(connection, """SELECT cases.*, drafts.leave_type, drafts.start_date,
              drafts.end_date, drafts.reason, links.business_run_id, links.session_id,
              links.continuation_id, links.hr_request_id, links.status AS run_status
              FROM approval_cases AS cases JOIN leave_request_drafts AS drafts
                ON drafts.id=cases.resource_id JOIN business_run_links AS links
                ON links.approval_case_id=cases.id
              WHERE cases.tenant_id=? AND cases.id=?""", (tenant_id, case_id))
        if not row:
            raise LeaveRequestError(404, "审批记录不存在")
        return row

    def decide(self, *, tenant_id: str, actor_id: str, request_id: str,
               case_id: str, decision_value: str, comment: str | None = None) -> dict[str, Any]:
        try:
            self.identity.require_active_subject(tenant_id, actor_id)
        except EnterpriseIdentityError as exc:
            raise LeaveRequestError(exc.status_code, exc.detail, "IDENTITY_INVALID") from exc
        case = self._case(tenant_id, case_id)
        if case["assignee_id"] != actor_id or case["requester_id"] == actor_id:
            raise LeaveRequestError(403, "只有当前审批人可以处理该申请")
        decision = self._authorize(tenant_id, actor_id, "approval.review",
                                   "approval_case", case_id, request_id)
        if decision_value not in {"approved", "rejected"}:
            raise LeaveRequestError(422, "审批结果必须是 approved 或 rejected")
        if case["status"] != "pending":
            return self._case(tenant_id, case_id)
        continuation = None
        if decision_value == "approved":
            continuation = self.runtime.create_continuation(
                tenant_id=tenant_id, business_run_id=case["business_run_id"],
                session_id=case["session_id"], payload={"approval_case_id": case_id,
                "immutable_digest": case["immutable_digest"], "decision": "approved"})
        timestamp = _now()
        with self.database.transaction() as connection:
            connection.execute(self._sql("""INSERT INTO approval_decisions
              (id, tenant_id, approval_case_id, actor_id, decision, comment,
               immutable_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""),
               (_id("decision"), tenant_id, case_id, actor_id, decision_value,
                comment, case["immutable_digest"], timestamp))
            connection.execute(self._sql("UPDATE approval_cases SET status=?, version=version+1, updated_at=? WHERE id=?"),
                               (decision_value, timestamp, case_id))
            connection.execute(self._sql("UPDATE approval_steps SET status=?, updated_at=? WHERE approval_case_id=?"),
                               (decision_value, timestamp, case_id))
            run_status = "approved" if decision_value == "approved" else "rejected"
            connection.execute(self._sql("UPDATE business_run_links SET continuation_id=?, status=?, updated_at=? WHERE approval_case_id=?"),
                               (continuation["id"] if continuation else None, run_status, timestamp, case_id))
            connection.execute(self._sql("UPDATE leave_request_drafts SET status=?, updated_at=? WHERE id=?"),
                               (run_status, timestamp, case["resource_id"]))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action=f"approval.{decision_value}", resource_type="approval_case",
                        resource_id=case_id, outcome=decision_value, request_id=request_id,
                        business_run_id=case["business_run_id"], session_id=case["session_id"],
                        decision_id=decision["decision_id"])
        return self._case(tenant_id, case_id)

    def validate_submit_tool(self, *, tenant_id: str, actor_id: str,
                             tool_input: dict[str, Any], invocation: Any) -> dict[str, Any]:
        business_run_id = str(tool_input.get("business_run_id") or "")
        run = self.get_run(tenant_id, business_run_id)
        expected = {
            "business_run_id": business_run_id,
            "session_id": run["session_id"],
            "continuation_id": run["continuation_id"],
            "immutable_digest": run["draft_digest"],
            "idempotency_key": run["idempotency_key"],
        }
        if run["requester_id"] != actor_id or run["approval_status"] != "approved":
            raise LeaveRequestError(403, "请假申请人或审批状态不匹配")
        if run["status"] != "submitting" or run.get("hr_request_id"):
            raise LeaveRequestError(409, "请假申请不处于可提交状态")
        for key, value in expected.items():
            if getattr(invocation, key, None) != value:
                raise LeaveRequestError(409, f"恢复上下文 {key} 不匹配")
        if not invocation.runtime_execution_id or not invocation.authorization_decision_id:
            raise LeaveRequestError(409, "恢复执行或授权依据缺失")
        try:
            continuation = self.runtime.get_continuation(
                tenant_id=tenant_id, continuation_id=run["continuation_id"]
            )
        except (KeyError, ValueError) as exc:
            raise LeaveRequestError(409, "恢复凭据无效", "CONTINUATION_INVALID") from exc
        if continuation["payload"].get("immutable_digest") != run["draft_digest"]:
            raise LeaveRequestError(409, "申请内容已变化，原审批不能继续使用")
        execution = self.runtime.get_execution(tenant_id, invocation.runtime_execution_id)
        if (execution["business_run_id"] != business_run_id
                or execution["session_id"] != run["session_id"]
                or execution["state"] != "resuming"):
            raise LeaveRequestError(409, "运行时执行上下文不匹配")
        return run

    def execute_submit_tool(self, *, tenant_id: str, actor_id: str,
                            business_run_id: str, invocation: Any) -> dict[str, Any]:
        run = self.validate_submit_tool(
            tenant_id=tenant_id, actor_id=actor_id,
            tool_input={"business_run_id": business_run_id}, invocation=invocation,
        )
        payload = {"employee_id": actor_id, "leave_type": run["leave_type"],
                   "start_date": run["start_date"], "end_date": run["end_date"],
                   "reason": run["reason"]}
        result = self.hr.create_leave(payload, run["idempotency_key"])
        return {"id": result["id"], "status": result.get("status", "submitted")}

    async def resume(self, *, tenant_id: str, actor_id: str, request_id: str,
                     business_run_id: str) -> dict[str, Any]:
        try:
            self.identity.require_active_subject(tenant_id, actor_id)
        except EnterpriseIdentityError as exc:
            raise LeaveRequestError(exc.status_code, exc.detail, "IDENTITY_INVALID") from exc
        run = self.get_run(tenant_id, business_run_id)
        if run["requester_id"] != actor_id:
            raise LeaveRequestError(403, "只有申请人可以恢复此运行")
        if run.get("hr_request_id"):
            return run
        if run["approval_status"] != "approved" or not run.get("continuation_id"):
            raise LeaveRequestError(409, "申请尚未批准，不能提交到 HR")
        decision = self._authorize(tenant_id, actor_id, "tool.invoke",
                                   "tool", "enterprise_submit_leave_request", request_id)
        try:
            continuation = self.runtime.get_continuation(
                tenant_id=tenant_id,
                continuation_id=run["continuation_id"],
            )
        except (KeyError, ValueError) as exc:
            raise LeaveRequestError(
                409,
                "恢复凭据不存在、已使用或完整性校验失败",
                "CONTINUATION_INVALID",
            ) from exc
        if continuation["payload"]["immutable_digest"] != run["draft_digest"]:
            raise LeaveRequestError(409, "申请内容已变化，原审批不能继续使用")
        # Claim submission before making the external call.  Together with the
        # stable HR idempotency key this prevents concurrent resume requests
        # from creating duplicate HR records.
        with self.database.transaction() as connection:
            cursor = connection.execute(
                self._sql("""UPDATE business_run_links
                    SET status='submitting', updated_at=?
                    WHERE tenant_id=? AND business_run_id=?
                      AND status IN ('approved', 'submit_failed')
                      AND hr_request_id IS NULL"""),
                (_now(), tenant_id, business_run_id),
            )
            if cursor.rowcount != 1:
                latest = self.get_run(tenant_id, business_run_id)
                if latest.get("hr_request_id"):
                    return latest
                raise LeaveRequestError(409, "请假申请正在提交，请稍后查询结果", "LEAVE_SUBMIT_IN_PROGRESS")

        execution = self.runtime.create_execution(
            tenant_id=tenant_id, session_id=run["session_id"], business_run_id=business_run_id,
            state="resuming", context={"request_id": request_id,
            "authorization_decision_id": decision["decision_id"]})
        self.runtime.append_event(tenant_id=tenant_id, execution_id=execution["id"],
                                  provider_event_id=f"{execution['id']}:resuming",
                                  event_type="resuming", payload={"continuation_id": run["continuation_id"]})
        try:
            if self.runtime_resume is None:
                raise RuntimeError("AgentScope runtime resume is unavailable")
            runtime_result = await self.runtime_resume({
                "tenant_id": tenant_id, "actor_id": actor_id,
                "request_id": request_id, "session_id": run["session_id"],
                "business_run_id": business_run_id,
                "runtime_execution_id": execution["id"],
                "authorization_decision_id": decision["decision_id"],
                "continuation_id": run["continuation_id"],
                "immutable_digest": run["draft_digest"],
                "idempotency_key": run["idempotency_key"],
                "approval_id": run["approval_case_id"],
            })
            calls = [call for call in ((runtime_result.get("raw") or {}).get("tool_calls") or [])
                     if call.get("tool_name") == "enterprise_submit_leave_request"]
            if runtime_result.get("status") != "completed" or len(calls) != 1 or not calls[0].get("allowed"):
                raise RuntimeError("AgentScope did not complete exactly one approved HR submission")
            hr_result = calls[0].get("result") or {}
            if not hr_result.get("id"):
                raise RuntimeError("AgentScope HR tool result did not contain a request id")
        except Exception as exc:
            error_code = exc.code if isinstance(exc, HRServiceError) else "RUNTIME_RESUME_FAILED"
            self.runtime.update_execution(tenant_id, execution["id"], "failed", error_code=error_code)
            with self.database.transaction() as connection:
                connection.execute(self._sql("UPDATE business_run_links SET status='submit_failed', updated_at=? WHERE business_run_id=? AND tenant_id=?"),
                                   (_now(), business_run_id, tenant_id))
                self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                            action="leave.hr_submit", resource_type="leave_request",
                            resource_id=run["draft_id"], outcome="failed", request_id=request_id,
                            business_run_id=business_run_id, session_id=run["session_id"],
                            execution_id=execution["id"], decision_id=decision["decision_id"],
                            metadata={"error_code": error_code})
            if isinstance(exc, HRServiceError):
                raise LeaveRequestError(503, str(exc), exc.code) from exc
            raise LeaveRequestError(
                503,
                "AgentScope 恢复执行失败，请稍后重试",
                error_code,
            ) from exc
        self.runtime.mark_continuation_consumed(tenant_id=tenant_id,
                                                continuation_id=run["continuation_id"])
        self.runtime.update_execution(tenant_id, execution["id"], "succeeded")
        with self.database.transaction() as connection:
            connection.execute(self._sql("UPDATE business_run_links SET hr_request_id=?, status='completed', updated_at=? WHERE business_run_id=? AND tenant_id=?"),
                               (hr_result["id"], _now(), business_run_id, tenant_id))
            connection.execute(self._sql("UPDATE leave_request_drafts SET status='completed', updated_at=? WHERE id=?"),
                               (_now(), run["draft_id"]))
            self._audit(connection, tenant_id=tenant_id, actor_id=actor_id,
                        action="leave.hr_submit", resource_type="leave_request",
                        resource_id=run["draft_id"], outcome="completed", request_id=request_id,
                        business_run_id=business_run_id, session_id=run["session_id"],
                        execution_id=execution["id"], decision_id=decision["decision_id"],
                        metadata={"hr_request_id": hr_result["id"]})
        self.runtime.append_event(tenant_id=tenant_id, execution_id=execution["id"],
                                  provider_event_id=f"{execution['id']}:completed",
                                  event_type="completed", payload={"hr_request_id": hr_result["id"]})
        return self.get_run(tenant_id, business_run_id)

    def get_run(self, tenant_id: str, business_run_id: str) -> dict[str, Any]:
        with self.database.connect() as connection:
            row = self._one(connection, """SELECT links.*, drafts.requester_id,
              drafts.leave_type, drafts.start_date, drafts.end_date, drafts.reason,
              drafts.draft_digest, drafts.status AS draft_status,
              cases.status AS approval_status, cases.assignee_id, cases.fallback_reason
              FROM business_run_links AS links JOIN leave_request_drafts AS drafts
                ON drafts.id=links.draft_id JOIN approval_cases AS cases
                ON cases.id=links.approval_case_id
              WHERE links.tenant_id=? AND links.business_run_id=?""",
              (tenant_id, business_run_id))
        if not row:
            raise LeaveRequestError(404, "请假运行不存在")
        return row

    def list_runs(self, tenant_id: str, actor_id: str) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            rows = connection.execute(self._sql("""SELECT links.business_run_id
              FROM business_run_links AS links JOIN leave_request_drafts AS drafts
                ON drafts.id=links.draft_id JOIN approval_cases AS cases
                ON cases.id=links.approval_case_id
              WHERE links.tenant_id=? AND (drafts.requester_id=? OR cases.assignee_id=?)
              ORDER BY links.created_at DESC"""), (tenant_id, actor_id, actor_id)).fetchall()
        return [self.get_run(tenant_id, dict(row)["business_run_id"]) for row in rows]

    def list_approvals(self, tenant_id: str, actor_id: str) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            rows = connection.execute(self._sql("SELECT id FROM approval_cases WHERE tenant_id=? AND (assignee_id=? OR requester_id=?) ORDER BY created_at DESC"),
                                      (tenant_id, actor_id, actor_id)).fetchall()
        return [self._case(tenant_id, dict(row)["id"]) for row in rows]

    def list_audit(self, tenant_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self.database.connect() as connection:
            rows = connection.execute(self._sql("SELECT * FROM leave_audit_events WHERE tenant_id=? ORDER BY occurred_at DESC LIMIT ?"),
                                      (tenant_id, max(1, min(limit, 500)))).fetchall()
        return [self._record(row) for row in rows]
