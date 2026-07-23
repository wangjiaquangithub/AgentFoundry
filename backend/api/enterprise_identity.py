"""Tenant-scoped enterprise identity and organization HTTP routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal, NoReturn

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.request_identity import get_request_identity
from services.enterprise_identity import EnterpriseIdentityError, EnterpriseIdentityService


class UserCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    role: str = Field(default="employee", min_length=1, max_length=100)
    user_id: str | None = None


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class OrganizationUnitCreateRequest(BaseModel):
    organization_id: str
    name: str = Field(min_length=1, max_length=200)
    parent_id: str | None = None
    unit_type: str = Field(default="department", min_length=1, max_length=100)


class OrganizationAssignmentRequest(BaseModel):
    organization_unit_id: str
    assignment_type: Literal["primary", "auxiliary"] = "primary"
    position_id: str | None = None


class ManagerUpdateRequest(BaseModel):
    manager_membership_id: str


@dataclass(frozen=True)
class EnterpriseIdentityRouteDependencies:
    service: Callable[[], EnterpriseIdentityService | None]


def _raise_service_error(exc: EnterpriseIdentityError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def create_enterprise_identity_router(
    deps: EnterpriseIdentityRouteDependencies,
) -> APIRouter:
    router = APIRouter(prefix="/api/platform", tags=["enterprise-identity"])

    def context(request: Request) -> tuple[EnterpriseIdentityService, str, str]:
        identity = get_request_identity(request)
        if not identity.authenticated or not identity.tenant_id or not identity.user_id:
            raise HTTPException(status_code=401, detail="authenticated tenant identity is required")
        service = deps.service()
        if service is None:
            raise HTTPException(status_code=503, detail="enterprise identity persistence is unavailable")
        try:
            service.require_active_subject(identity.tenant_id, identity.user_id)
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)
        return service, identity.tenant_id, identity.user_id

    @router.get("/users")
    def list_users(request: Request, include_inactive: bool = Query(False)) -> dict[str, object]:
        service, tenant_id, _ = context(request)
        return {"items": service.list_users(tenant_id, include_inactive=include_inactive)}

    @router.post("/users", status_code=201)
    def create_user(payload: UserCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.create_user(tenant_id=tenant_id, actor_id=actor_id, **payload.model_dump())
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.post("/users/{user_id}/deactivate")
    def deactivate_user(user_id: str, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.deactivate_user(tenant_id=tenant_id, actor_id=actor_id, user_id=user_id)
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.get("/organizations")
    def organizations(request: Request) -> dict[str, object]:
        service, tenant_id, _ = context(request)
        return service.organization_snapshot(tenant_id)

    @router.post("/organizations", status_code=201)
    def create_organization(payload: OrganizationCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.create_organization(tenant_id=tenant_id, actor_id=actor_id, name=payload.name)
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.get("/organization-units")
    def list_units(request: Request) -> dict[str, object]:
        service, tenant_id, _ = context(request)
        return {"items": service.list_units(tenant_id)}

    @router.post("/organization-units", status_code=201)
    def create_unit(payload: OrganizationUnitCreateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.create_unit(tenant_id=tenant_id, actor_id=actor_id, **payload.model_dump())
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.get("/memberships")
    def list_memberships(request: Request, include_inactive: bool = Query(False)) -> dict[str, object]:
        service, tenant_id, _ = context(request)
        return {"items": service.list_memberships(tenant_id, include_inactive=include_inactive)}

    @router.post("/memberships/{membership_id}/organization-assignments", status_code=201)
    def assign_unit(membership_id: str, payload: OrganizationAssignmentRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.assign_unit(tenant_id=tenant_id, actor_id=actor_id,
                                       membership_id=membership_id, **payload.model_dump())
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.put("/memberships/{membership_id}/manager")
    def set_manager(membership_id: str, payload: ManagerUpdateRequest, request: Request) -> dict[str, object]:
        service, tenant_id, actor_id = context(request)
        try:
            return service.set_manager(tenant_id=tenant_id, actor_id=actor_id,
                                       membership_id=membership_id,
                                       manager_membership_id=payload.manager_membership_id)
        except EnterpriseIdentityError as exc:
            _raise_service_error(exc)

    @router.get("/identity/mutations")
    def list_mutations(request: Request, limit: int = Query(100, ge=1, le=500)) -> dict[str, object]:
        service, tenant_id, _ = context(request)
        return {"items": service.list_mutations(tenant_id, limit)}

    return router
