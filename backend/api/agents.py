"""Platform agent catalog HTTP routes."""

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, NoReturn

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import EnterpriseAgentPublishRequest, EnterpriseAgentUpdateRequest
from services.agents import PlatformAgentService, PlatformAgentServiceError


def _raise_service_error(exc: PlatformAgentServiceError) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@dataclass(frozen=True)
class AgentCatalogRouteDependencies:
    agent_service: Callable[[], PlatformAgentService]
    validate_agent_resources: Callable[..., Awaitable[None]]
    tenant_hint_from_user_id: Callable[[str], str | None]


def _request_tenant(
    *,
    identity_user_id: str | None,
    identity_tenant_id: str | None,
    tenant: str | None,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    identity_tenant = (identity_tenant_id or "").strip()
    hinted_tenant = tenant_hint_from_user_id(identity_user_id or "")
    request_tenant = identity_tenant or hinted_tenant
    if not request_tenant:
        raise HTTPException(
            status_code=400,
            detail="request identity does not resolve to a tenant.",
        )

    explicit_tenant = (tenant or "").strip()
    if explicit_tenant and explicit_tenant != request_tenant:
        raise HTTPException(
            status_code=403,
            detail="tenant does not match request identity tenant boundary.",
        )
    return request_tenant


def create_agent_catalog_router(
    deps: AgentCatalogRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    async def validate_agent_resources(
        request: Request,
        user_id: str,
        resource_inputs: dict[str, Any],
    ) -> None:
        await deps.validate_agent_resources(
            request,
            user_id,
            **resource_inputs,
        )

    @router.get("/enterprise/platform/agents")
    async def enterprise_platform_agents(request: Request) -> dict[str, Any]:
        """Return platform agent templates and published tenant instances."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        return deps.agent_service().registry_response(tenant=tenant)

    @router.post("/enterprise/platform/agents/publish")
    async def publish_enterprise_platform_agent(
        payload: EnterpriseAgentPublishRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Publish one business template as a tenant-scoped platform agent."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=payload.tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        agent_service = deps.agent_service()
        publish_request = agent_service.publish_request_payload(
            payload,
            header_user_id=identity.user_id,
        )
        user_id = publish_request["user_id"]
        await validate_agent_resources(
            request,
            user_id,
            publish_request["resource_inputs"],
        )
        try:
            return agent_service.publish_agent_response_payload(
                payload,
                user_id,
                tenant=tenant,
            )
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)

    @router.patch("/enterprise/platform/agents/{agent_id}")
    async def update_enterprise_platform_agent(
        agent_id: str,
        payload: EnterpriseAgentUpdateRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Update a tenant-scoped platform agent instance."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=payload.tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        agent_service = deps.agent_service()
        try:
            update_request = agent_service.update_request_payload(
                agent_id,
                payload,
                header_user_id=identity.user_id,
                tenant=tenant,
            )
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)
        user_id = update_request["user_id"]
        await validate_agent_resources(
            request,
            user_id,
            update_request["resource_inputs"],
        )
        try:
            return agent_service.update_agent_response_payload(
                agent_id,
                payload,
                user_id,
                tenant=tenant,
            )
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)

    @router.delete("/enterprise/platform/agents/{agent_id}")
    async def archive_enterprise_platform_agent(
        agent_id: str,
        request: Request,
    ) -> dict[str, Any]:
        """Archive a platform agent while keeping its registry record."""
        identity = get_request_identity(request)
        tenant = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        agent_service = deps.agent_service()
        try:
            return agent_service.archive_agent_response_payload(
                agent_id,
                user_id=identity.user_id,
                tenant=tenant,
            )
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)

    return router
