"""Enterprise platform tool and audit HTTP routes."""

from dataclasses import dataclass
from typing import Any, Callable, NoReturn

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import EnterpriseToolRunRequest
from audit import ToolAuditLogger
from permissions import ToolAuthorizationPolicy
from services.agents import PlatformAgentService, PlatformAgentServiceError
from services.connectors import (
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)
from services.tools import PlatformToolPolicyService, PlatformToolPolicyServiceError


def _raise_service_error(exc: Any) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@dataclass(frozen=True)
class ToolAuditRouteDependencies:
    tool_names: list[str]
    tool_catalog: dict[str, dict[str, Any]]
    approval_required_tools: set[str]
    audit_logger: ToolAuditLogger
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    connector_config_service: Callable[[], PlatformConnectorConfigService]
    agent_service: Callable[[], PlatformAgentService]
    get_tool_authorization_policy: Callable[[], ToolAuthorizationPolicy]
    published_agent_tool_scope_for_user: Callable[[str, str], tuple[Any, set[str]]]
    require_platform_approval: Callable[..., str]
    run_authorized_enterprise_tool: Callable[..., dict[str, Any]]
    tenant_hint_from_user_id: Callable[[str], str | None]


def _request_tenant(
    *,
    request: Request,
    tenant: str | None,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    identity = get_request_identity(request)
    identity_tenant = (identity.tenant_id or "").strip()
    hinted_tenant = tenant_hint_from_user_id(identity.user_id or "")
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


def create_tool_audit_router(deps: ToolAuditRouteDependencies) -> APIRouter:
    router = APIRouter()

    @router.get("/enterprise/platform/tools")
    async def enterprise_platform_tools(
        request: Request,
        agent_id: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Return tool catalog metadata, authorization, bindings, and stats."""
        identity = get_request_identity(request)
        tool_policy_service = deps.tool_policy_service()
        catalog_request = tool_policy_service.catalog_request_payload(
            query_user_id=user_id,
            header_user_id=identity.user_id,
            agent_id=agent_id,
        )
        resolved_user_id = catalog_request["user_id"]
        requested_agent_id = catalog_request["agent_id"]
        try:
            runtime = deps.connector_config_service().enterprise_runtime_context(
                resolved_user_id
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        runtime_selection = tool_policy_service.runtime_selection(runtime)
        tenant = _request_tenant(
            request=request,
            tenant=runtime_selection["tenant"],
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            published_agents = deps.agent_service().list_published_agents(
                tenant=tenant,
            )
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)
        configured_agent = None
        if requested_agent_id:
            try:
                configured_agent = deps.agent_service().get_published_agent(
                    requested_agent_id,
                    tenant=tenant,
                )
            except PlatformAgentServiceError as exc:
                _raise_service_error(exc)

        try:
            catalog = tool_policy_service.tenant_tool_catalog(
                tenant=tenant,
                fallback_tool_names=deps.tool_names,
                fallback_tool_catalog=deps.tool_catalog,
            )
        except PlatformToolPolicyServiceError as exc:
            _raise_service_error(exc)
        tool_names = catalog["tool_names"]
        tool_catalog = catalog["tool_catalog"]
        decisions = tool_policy_service.catalog_decisions_by_name(
            authorization_policy=deps.get_tool_authorization_policy(),
            tenant=tenant,
            user_id=resolved_user_id,
            tool_names=tool_names,
        )
        tools = tool_policy_service.catalog_tools_payloads(
            tool_names=tool_names,
            tool_catalog=tool_catalog,
            decisions=decisions,
            audit_events_for_tool=lambda tool_name: deps.audit_logger.query(
                tenant=tenant,
                user_id=resolved_user_id,
                tool_name=tool_name,
                limit=200,
            ),
            published_agents=published_agents,
            configured_agent=configured_agent,
        )
        return tool_policy_service.catalog_response(
            tools=tools,
            user_id=resolved_user_id,
            tenant=tenant,
            runtime_selection=runtime_selection,
            agent_id=requested_agent_id,
        )

    @router.get("/enterprise/platform/audit")
    async def enterprise_platform_audit(
        request: Request,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
        tool_name: str | None = None,
        success: bool | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Return filtered enterprise tool audit events."""
        tenant_id = _request_tenant(
            request=request,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        normalized_limit = max(1, min(limit, 200))
        events = deps.audit_logger.query(
            tenant=tenant_id,
            user_id=user_id,
            agent_id=agent_id,
            tool_name=tool_name,
            success=success,
            limit=normalized_limit,
        )
        return deps.tool_policy_service().audit_log_response(
            events=events,
            filters={
                "tenant": tenant_id,
                "user_id": user_id,
                "agent_id": agent_id,
                "tool_name": tool_name,
                "success": success,
            },
            limit=normalized_limit,
        )

    @router.post("/enterprise/platform/tools/run")
    async def run_enterprise_tool(
        payload: EnterpriseToolRunRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Run one tenant-aware enterprise tool from the platform console."""
        identity = get_request_identity(request)
        tool_policy_service = deps.tool_policy_service()
        run_request = tool_policy_service.run_request_payload(
            tool_name=payload.tool_name,
            inputs=payload.inputs,
            payload_user_id=payload.user_id,
            header_user_id=identity.user_id,
            agent_id=payload.agent_id,
            approval_id=payload.approval_id,
        )
        user_id = run_request["user_id"]
        requested_tool_name = run_request["tool_name"]
        requested_inputs = run_request["inputs"]
        requested_agent_id = run_request["agent_id"]
        requested_approval_id = run_request["approval_id"]
        try:
            runtime = deps.connector_config_service().enterprise_runtime_context(user_id)
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        runtime_selection = tool_policy_service.runtime_selection(runtime)
        tenant = _request_tenant(
            request=request,
            tenant=runtime_selection["tenant"],
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        runner_agent_id = tool_policy_service.tool_run_agent_id(requested_agent_id)
        if requested_agent_id:
            _, configured_tools = deps.published_agent_tool_scope_for_user(
                requested_agent_id,
                user_id,
            )
            if requested_tool_name not in configured_tools:
                try:
                    runtime = deps.connector_config_service().enterprise_runtime_context(
                        user_id
                    )
                except PlatformConnectorConfigServiceError as exc:
                    _raise_service_error(exc)
                runtime_selection = tool_policy_service.runtime_selection(runtime)
                tenant = _request_tenant(
                    request=request,
                    tenant=runtime_selection["tenant"],
                    tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
                )
                decision = deps.agent_service().tool_denial_payload(requested_tool_name)
                return tool_policy_service.agent_tool_denial_response(
                    tool_name=requested_tool_name,
                    tenant=tenant,
                    user_id=user_id,
                    runtime_selection=runtime_selection,
                    decision=decision,
                )

        approval_id = None
        if tool_policy_service.tool_requires_approval(
            requested_tool_name,
            deps.approval_required_tools,
        ):
            approval_id = deps.require_platform_approval(
                approval_id=requested_approval_id,
                request_type="tool_run",
                target_key="tool_name",
                target_value=requested_tool_name,
                tenant=tenant,
                user_id=user_id,
                agent_id=runner_agent_id,
                inputs=requested_inputs,
            )

        response = tool_policy_service.run_platform_tool_from_context(
            run_authorized_enterprise_tool=deps.run_authorized_enterprise_tool,
            user_id=user_id,
            tool_name=requested_tool_name,
            inputs=requested_inputs,
            agent_id=runner_agent_id,
            session_id=tool_policy_service.tool_run_session_id(),
        )
        return tool_policy_service.tool_run_response(
            response,
            approval_id=approval_id,
        )

    return router
