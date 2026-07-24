"""Tenant-scoped leave request, approval, and continuation routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, NoReturn

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.request_identity import get_request_identity
from services.leave_requests import LeaveRequestError, LeaveRequestService


class LeaveCreateRequest(BaseModel):
    leave_type: str = Field(min_length=1, max_length=32)
    start_date: str
    end_date: str
    reason: str = Field(min_length=1, max_length=2000)
    agent_id: str = Field(default="leave-assistant", min_length=1, max_length=200)


class ApprovalDecisionRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=2000)


@dataclass(frozen=True)
class LeaveRequestRouteDependencies:
    service: Callable[[], LeaveRequestService | None]


def _raise(exc: LeaveRequestError) -> NoReturn:
    raise HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.detail},
    ) from exc


def create_leave_request_router(deps: LeaveRequestRouteDependencies) -> APIRouter:
    router = APIRouter(prefix="/api/platform", tags=["enterprise-leave"])

    def context(request: Request) -> tuple[LeaveRequestService, str, str, str]:
        identity = get_request_identity(request)
        if not identity.authenticated or not identity.tenant_id or not identity.user_id:
            raise HTTPException(status_code=401, detail="authenticated tenant identity is required")
        service = deps.service()
        if service is None:
            raise HTTPException(status_code=503, detail="leave persistence or HR service is unavailable")
        request_id = getattr(request.state, "request_id", None) or request.headers.get("x-request-id", "")
        return service, identity.tenant_id, identity.user_id, request_id

    @router.post("/leave-requests", status_code=201)
    def create(payload: LeaveCreateRequest, request: Request) -> dict[str, object]:
        service, tenant, actor, request_id = context(request)
        try:
            return service.create(tenant_id=tenant, actor_id=actor, request_id=request_id, **payload.model_dump())
        except LeaveRequestError as exc:
            _raise(exc)

    @router.get("/leave-requests")
    def list_requests(request: Request) -> dict[str, object]:
        service, tenant, actor, _ = context(request)
        return {"items": service.list_runs(tenant, actor)}

    @router.get("/approval-cases")
    def list_approvals(request: Request) -> dict[str, object]:
        service, tenant, actor, _ = context(request)
        return {"items": service.list_approvals(tenant, actor)}

    def decide(case_id: str, value: str, payload: ApprovalDecisionRequest,
               request: Request, idempotency_key: str | None) -> dict[str, object]:
        if not idempotency_key:
            raise HTTPException(status_code=400, detail="Idempotency-Key is required")
        service, tenant, actor, request_id = context(request)
        try:
            return service.decide(tenant_id=tenant, actor_id=actor, request_id=request_id,
                                  case_id=case_id, decision_value=value, comment=payload.comment)
        except LeaveRequestError as exc:
            _raise(exc)

    @router.post("/approval-cases/{case_id}/approve")
    def approve(case_id: str, payload: ApprovalDecisionRequest, request: Request,
                idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, object]:
        return decide(case_id, "approved", payload, request, idempotency_key)

    @router.post("/approval-cases/{case_id}/reject")
    def reject(case_id: str, payload: ApprovalDecisionRequest, request: Request,
               idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, object]:
        return decide(case_id, "rejected", payload, request, idempotency_key)

    @router.post("/runs/{business_run_id}/resume")
    async def resume(business_run_id: str, request: Request,
               idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, object]:
        if not idempotency_key:
            raise HTTPException(status_code=400, detail="Idempotency-Key is required")
        service, tenant, actor, request_id = context(request)
        try:
            return await service.resume(tenant_id=tenant, actor_id=actor,
                                        request_id=request_id, business_run_id=business_run_id)
        except LeaveRequestError as exc:
            _raise(exc)

    @router.get("/runs/{business_run_id}/events")
    def events(business_run_id: str, request: Request) -> dict[str, object]:
        service, tenant, actor, _ = context(request)
        run = service.get_run(tenant, business_run_id)
        if actor not in {run["requester_id"], run["assignee_id"]}:
            raise HTTPException(status_code=403, detail="run access denied")
        return {
            "business_run": run,
            "executions": service.runtime.list_executions(tenant, business_run_id=business_run_id),
            "events": service.runtime.list_events(tenant, business_run_id=business_run_id),
        }

    @router.get("/leave-audit-events")
    def audit(request: Request, limit: int = Query(200, ge=1, le=500)) -> dict[str, object]:
        service, tenant, actor, request_id = context(request)
        try:
            service._authorize(tenant, actor, "audit.read", "audit", tenant, request_id)
            return {"items": service.list_audit(tenant, limit)}
        except LeaveRequestError as exc:
            _raise(exc)

    return router
