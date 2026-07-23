"""Enterprise RBAC and ABAC management routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Literal, NoReturn

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.request_identity import get_request_identity
from services.authorization import AuthorizationError, AuthorizationService


DataScope = Literal[
    "none",
    "self",
    "direct_reports",
    "department",
    "department_tree",
    "explicit_departments",
    "tenant",
]


class RoleCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)


class RoleBindingCreateRequest(BaseModel):
    role_id: str
    subject_type: Literal["user", "membership", "organization_unit"]
    subject_id: str
    resource_type: str | None = None
    resource_id: str | None = None
    data_scope: DataScope = "none"
    scope_config: dict[str, Any] = Field(default_factory=dict)


class ResourceGrantCreateRequest(BaseModel):
    subject_type: Literal["user", "membership", "organization_unit"]
    subject_id: str
    action: str
    resource_type: str
    resource_id: str
    data_scope: DataScope = "none"
    conditions: dict[str, Any] = Field(default_factory=dict)


class AuthorizationCheckRequest(BaseModel):
    action: str
    resource: dict[str, Any]
    environment: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class AuthorizationRouteDependencies:
    service: Callable[[], AuthorizationService | None]


def _raise(exc: AuthorizationError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def create_authorization_router(deps: AuthorizationRouteDependencies) -> APIRouter:
    router = APIRouter(prefix="/api/platform", tags=["enterprise-authorization"])

    def context(request: Request) -> tuple[AuthorizationService, str, str]:
        identity = get_request_identity(request)
        if not identity.authenticated or not identity.tenant_id or not identity.user_id:
            raise HTTPException(status_code=401, detail="authenticated tenant identity is required")
        service = deps.service()
        if service is None:
            raise HTTPException(status_code=503, detail="authorization persistence is unavailable")
        return service, identity.tenant_id, identity.user_id

    def require(service: AuthorizationService, tenant_id: str, actor_id: str,
                action: str) -> None:
        decision = service.authorize(tenant_id=tenant_id, subject_id=actor_id,
                                     action=action, resource={"type": "authorization", "id": tenant_id})
        if not decision["allowed"]:
            raise HTTPException(status_code=403, detail="authorization denied")

    @router.get("/roles")
    def roles(request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "role.read")
        return {"items": service.list_roles(tenant_id, actor_id)}

    @router.post("/roles", status_code=201)
    def create_role(payload: RoleCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "role.manage")
        try:
            return service.create_role(tenant_id=tenant_id, actor_id=actor_id, **payload.model_dump())
        except AuthorizationError as exc:
            _raise(exc)

    @router.get("/role-bindings")
    def bindings(request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "role.read")
        return {"items": service.list_bindings(tenant_id)}

    @router.post("/role-bindings", status_code=201)
    def bind(payload: RoleBindingCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "role.assign")
        try:
            return service.bind_role(tenant_id=tenant_id, actor_id=actor_id, **payload.model_dump())
        except AuthorizationError as exc:
            _raise(exc)

    @router.post("/resource-grants", status_code=201)
    def grant(payload: ResourceGrantCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "role.assign")
        try:
            return service.create_resource_grant(tenant_id=tenant_id, actor_id=actor_id, **payload.model_dump())
        except AuthorizationError as exc:
            _raise(exc)

    @router.post("/authorization-decisions/check")
    def check(payload: AuthorizationCheckRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        return service.authorize(tenant_id=tenant_id, subject_id=actor_id, **payload.model_dump())

    @router.get("/authorization-decisions")
    def decisions(request: Request, subject_id: str | None = None,
                  limit: int = Query(100, ge=1, le=500)) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        require(service, tenant_id, actor_id, "audit.read")
        return {"items": service.list_decisions(tenant_id, subject_id=subject_id, limit=limit)}

    return router
