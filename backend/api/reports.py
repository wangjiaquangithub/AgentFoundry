"""Tenant-scoped governed report routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, NoReturn

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from api.request_identity import get_request_identity
from services.reports import ReportError, ReportService


class ReportQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parameters: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class ReportRouteDependencies:
    service: Callable[[], ReportService | None]


def _raise(exc: ReportError) -> NoReturn:
    raise HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.detail},
    ) from exc


def create_report_router(deps: ReportRouteDependencies) -> APIRouter:
    router = APIRouter(prefix="/api/platform", tags=["enterprise-reports"])

    def context(request: Request) -> tuple[ReportService, str, str, str]:
        identity = get_request_identity(request)
        if not identity.authenticated or not identity.tenant_id or not identity.user_id:
            raise HTTPException(status_code=401, detail="authenticated tenant identity is required")
        service = deps.service()
        if service is None:
            raise HTTPException(status_code=503, detail="governed report service is unavailable")
        request_id = getattr(request.state, "request_id", None) or request.headers.get("x-request-id", "")
        return service, identity.tenant_id, identity.user_id, request_id

    @router.get("/reports")
    def list_reports(request: Request) -> dict[str, object]:
        service, tenant, actor, request_id = context(request)
        return {"items": service.list_reports(tenant, actor, request_id)}

    @router.get("/reports/{report_code}")
    def describe_report(report_code: str, request: Request) -> dict[str, Any]:
        service, tenant, actor, request_id = context(request)
        try:
            return service.describe(tenant, actor, report_code, request_id)
        except ReportError as exc:
            _raise(exc)

    @router.post("/reports/{report_code}/query")
    def query_report(report_code: str, payload: ReportQueryRequest, request: Request) -> dict[str, Any]:
        service, tenant, actor, request_id = context(request)
        try:
            return service.query(tenant_id=tenant, actor_id=actor, report_code=report_code,
                                 parameters=payload.parameters, request_id=request_id)
        except ReportError as exc:
            _raise(exc)

    @router.post("/reports/{report_code}/export", status_code=202)
    def export_report(report_code: str, payload: ReportQueryRequest, request: Request,
                      idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, Any]:
        if not idempotency_key:
            raise HTTPException(status_code=400, detail={"code": "IDEMPOTENCY_KEY_REQUIRED", "message": "导出必须提供 Idempotency-Key。"})
        service, tenant, actor, request_id = context(request)
        try:
            return service.request_export(tenant_id=tenant, actor_id=actor, report_code=report_code,
                                          parameters=payload.parameters, idempotency_key=idempotency_key,
                                          request_id=request_id)
        except ReportError as exc:
            _raise(exc)

    @router.get("/report-queries")
    def list_queries(request: Request, limit: int = Query(100, ge=1, le=500)) -> dict[str, object]:
        service, tenant, actor, _ = context(request)
        return {"items": service.list_queries(tenant, actor, limit)}

    @router.get("/report-exports")
    def list_exports(request: Request, limit: int = Query(100, ge=1, le=500)) -> dict[str, object]:
        service, tenant, actor, _ = context(request)
        return {"items": service.list_exports(tenant, actor, limit)}

    @router.get("/report-audit-events")
    def list_audit(request: Request, limit: int = Query(200, ge=1, le=500)) -> dict[str, object]:
        service, tenant, actor, request_id = context(request)
        decision = service.authorization.authorize(
            tenant_id=tenant, subject_id=actor, action="audit.read",
            resource={"type": "audit", "id": tenant}, environment={"request_id": request_id},
        )
        if not decision["allowed"]:
            raise HTTPException(status_code=403, detail={"code": "AUDIT_ACCESS_DENIED", "message": "无权查看报表审计记录。"})
        return {"items": service.list_audit(tenant, limit)}

    return router
