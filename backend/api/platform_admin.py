"""Platform administration HTTP routes."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, NoReturn

from fastapi import APIRouter, HTTPException, Request

from api.request_identity import get_request_identity
from api.schemas import (
    EnterpriseConnectorConfigSaveRequest,
    EnterpriseConnectorTestRequest,
    EnterprisePlatformConfigImportRequest,
    EnterprisePlatformMemberPatchRequest,
    EnterprisePlatformMemberUpsertRequest,
    EnterpriseToolPolicyUpdateRequest,
)
from services.agents import PlatformAgentService, PlatformAgentServiceError
from services.connectors import (
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)
from services.members import PlatformMemberService, PlatformMemberServiceError
from services.platform_status import PlatformStatusService
from services.tools import PlatformToolPolicyService, PlatformToolPolicyServiceError
from services.workflows import (
    PlatformWorkflowTemplateService,
    PlatformWorkflowTemplateServiceError,
)


def _raise_service_error(exc: Any) -> NoReturn:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@dataclass(frozen=True)
class PlatformAdminRouteDependencies:
    platform_version: str
    data_dir: Path
    members_path: Path
    connector_configs_path: Path
    agents_path: Path
    workflow_templates_path: Path
    connector_name: str
    env: Mapping[str, str]
    subagent_templates: list[Any]
    status_service: Callable[[], PlatformStatusService]
    connector_config_service: Callable[[], PlatformConnectorConfigService]
    member_service: Callable[[], PlatformMemberService]
    tool_policy_service: Callable[[], PlatformToolPolicyService]
    agent_service: Callable[[], PlatformAgentService]
    workflow_template_service: Callable[[], PlatformWorkflowTemplateService]
    identity_metadata: Callable[[str, str], list[dict[str, Any]]]
    tool_policy_path: Callable[[], Path]
    now: Callable[[], str]
    get_tool_authorization_policy: Callable[[], Any]
    set_tool_authorization_policy: Callable[[Any], None]
    build_tool_authorization_policy: Callable[[], Any]
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


def _request_user_id(
    *,
    identity_user_id: str | None,
    tenant: str,
    user_id: str | None,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    request_user_id = (user_id or identity_user_id or "").strip()
    if not request_user_id:
        raise HTTPException(
            status_code=400,
            detail="request identity does not resolve to a user.",
        )

    user_tenant = tenant_hint_from_user_id(request_user_id)
    if not user_tenant:
        raise HTTPException(
            status_code=400,
            detail="requested user does not resolve to a tenant.",
        )
    if user_tenant != tenant:
        raise HTTPException(
            status_code=403,
            detail="requested user does not match request identity tenant boundary.",
        )
    return request_user_id


def create_platform_admin_router(
    deps: PlatformAdminRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    def export_platform_config(
        *,
        actor_user_id: str | None = None,
        tenant: str,
    ) -> dict[str, Any]:
        try:
            connector_config_service = deps.connector_config_service()
            connector_configs = connector_config_service.export_configs_payload(
                tenant=tenant,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        try:
            agents = deps.agent_service().list_agents_for_user(actor_user_id)
        except PlatformAgentServiceError as exc:
            _raise_service_error(exc)
        try:
            workflow_templates = deps.workflow_template_service().list_templates()
        except PlatformWorkflowTemplateServiceError as exc:
            _raise_service_error(exc)

        try:
            tool_policy = deps.tool_policy_service().export_policy_payload(
                tenant=tenant,
            )
        except PlatformToolPolicyServiceError as exc:
            _raise_service_error(exc)
        try:
            members = deps.member_service().list_members(
                include_inactive=True,
                tenant=tenant,
            )
        except PlatformMemberServiceError as exc:
            _raise_service_error(exc)

        config = {
            "members": members,
            "connector_configs": connector_configs,
            "agents": agents,
            "workflow_templates": workflow_templates,
            "tool_policy": tool_policy,
        }
        return connector_config_service.export_config_response(
            config=config,
            platform_version=deps.platform_version,
            exported_at=deps.now(),
            file_paths={
                "members": str(deps.members_path),
                "connector_configs": str(deps.connector_configs_path),
                "agents": str(deps.agents_path),
                "workflow_templates": str(deps.workflow_templates_path),
                "tool_policy": str(deps.tool_policy_path()),
            },
        )

    @router.get("/enterprise/platform/status")
    async def enterprise_platform_status(request: Request) -> dict[str, Any]:
        """Return enterprise platform state for the frontend console."""
        status_service = deps.status_service()
        identity = get_request_identity(request)
        try:
            context = status_service.status_request_context(
                user_id=identity.user_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

        return status_service.platform_snapshot(
            platform_version=deps.platform_version,
            data_dir=deps.data_dir,
            runtime=context["runtime"],
            tenant=context["tenant"],
            user_id=context["user_id"],
            identities=context["identities"],
            tenant_workspaces=context["tenant_workspaces"],
            subagent_templates=deps.subagent_templates,
        )

    @router.get("/enterprise/platform/connectors")
    async def enterprise_platform_connectors(request: Request) -> dict[str, Any]:
        """Return enterprise data source connector readiness and tenant scope."""
        identity = get_request_identity(request)
        try:
            connector_config_service = deps.connector_config_service()
            return connector_config_service.platform_connectors_response(
                user_id=identity.user_id,
                connector_name=deps.connector_name,
                env=deps.env,
                identity_metadata=deps.identity_metadata,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

    @router.get("/enterprise/platform/governance")
    async def enterprise_platform_governance(request: Request) -> dict[str, Any]:
        """Return tenant, identity, approval, and audit governance state."""
        status_service = deps.status_service()
        identity = get_request_identity(request)
        try:
            return status_service.governance_request_payload(
                user_id=identity.user_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

    @router.get("/enterprise/platform/members")
    async def enterprise_platform_members(request: Request) -> dict[str, Any]:
        """Return the editable enterprise member registry."""
        identity = get_request_identity(request)
        try:
            return deps.member_service().registry_response_payload(
                user_id=identity.user_id,
                request_context=lambda user_id: deps.status_service().status_request_context(
                    user_id=user_id,
                ),
                registry_path=deps.members_path,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)
        except PlatformMemberServiceError as exc:
            _raise_service_error(exc)

    @router.post("/enterprise/platform/members")
    async def create_enterprise_platform_member(
        payload: EnterprisePlatformMemberUpsertRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Create or replace one enterprise platform member."""
        identity = get_request_identity(request)
        try:
            return deps.member_service().create_member_response_payload(
                payload=payload.model_dump(),
                actor=identity.user_id,
                identity_metadata=deps.identity_metadata,
                registry_path=deps.members_path,
            )
        except PlatformMemberServiceError as exc:
            _raise_service_error(exc)

    @router.patch("/enterprise/platform/members/{user_id:path}")
    async def update_enterprise_platform_member(
        user_id: str,
        payload: EnterprisePlatformMemberPatchRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Update one enterprise platform member."""
        identity = get_request_identity(request)
        try:
            return deps.member_service().update_member_response_payload(
                user_id=user_id,
                payload=payload.model_dump(exclude_unset=True),
                actor=identity.user_id,
                identity_metadata=deps.identity_metadata,
                registry_path=deps.members_path,
            )
        except PlatformMemberServiceError as exc:
            _raise_service_error(exc)

    @router.delete("/enterprise/platform/members/{user_id:path}")
    async def deactivate_enterprise_platform_member(
        user_id: str,
        request: Request,
    ) -> dict[str, Any]:
        """Soft-delete one enterprise platform member by marking it inactive."""
        identity = get_request_identity(request)
        try:
            return deps.member_service().deactivate_member_response_payload(
                user_id=user_id,
                actor=identity.user_id,
                identity_metadata=deps.identity_metadata,
                registry_path=deps.members_path,
            )
        except PlatformMemberServiceError as exc:
            _raise_service_error(exc)

    @router.get("/enterprise/platform/policies/tools")
    async def enterprise_platform_tool_policy(
        request: Request,
        user_id: str | None = None,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        """Return editable enterprise tool authorization policy state."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        query_user_id = _request_user_id(
            identity_user_id=identity.user_id,
            tenant=tenant_id,
            user_id=user_id,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.tool_policy_service().policy_request_payload(
                authorization_policy=deps.get_tool_authorization_policy(),
                query_user_id=query_user_id,
                header_user_id=identity.user_id,
                tenant=tenant_id,
            )
        except PlatformToolPolicyServiceError as exc:
            _raise_service_error(exc)

    @router.patch("/enterprise/platform/policies/tools")
    async def update_enterprise_platform_tool_policy(
        request: Request,
        payload: EnterpriseToolPolicyUpdateRequest,
    ) -> dict[str, Any]:
        """Persist one tenant user's enterprise tool authorization policy."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=payload.tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        update_payload = payload.model_dump()
        update_payload["tenant"] = tenant_id
        try:
            (
                authorization_policy,
                response_payload,
            ) = deps.tool_policy_service().update_user_policy_request_payload(
                update_payload,
                actor_user_id=identity.user_id,
            )
        except PlatformToolPolicyServiceError as exc:
            _raise_service_error(exc)

        deps.set_tool_authorization_policy(authorization_policy)
        return response_payload

    @router.get("/enterprise/platform/connectors/configs")
    async def enterprise_platform_connector_configs(
        request: Request,
    ) -> dict[str, Any]:
        """Return tenant connector configurations without exposing secrets."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.connector_config_service().list_configs_response(
                tenant=tenant_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

    @router.post("/enterprise/platform/connectors/configs")
    async def save_enterprise_platform_connector_config(
        payload: EnterpriseConnectorConfigSaveRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Persist a tenant-scoped connector configuration."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=payload.tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.connector_config_service().save_config_payload(
                payload,
                user_id=identity.user_id,
                tenant=tenant_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

    @router.post("/enterprise/platform/connectors/test")
    async def test_enterprise_platform_connector(
        payload: EnterpriseConnectorTestRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Validate an enterprise HTTP connector against core business endpoints."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=payload.tenant,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            return deps.connector_config_service().test_connector(
                payload,
                tenant=tenant_id,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

    @router.get("/enterprise/platform/config/export")
    async def export_enterprise_platform_config(request: Request) -> dict[str, Any]:
        """Export portable platform configuration without runtime data or secrets."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        return export_platform_config(
            actor_user_id=identity.user_id,
            tenant=tenant_id,
        )

    @router.post("/enterprise/platform/config/import")
    async def import_enterprise_platform_config(
        payload: EnterprisePlatformConfigImportRequest,
        request: Request,
    ) -> dict[str, Any]:
        """Import portable platform configuration by merging or replacing sections."""
        identity = get_request_identity(request)
        tenant_id = _request_tenant(
            identity_user_id=identity.user_id,
            identity_tenant_id=identity.tenant_id,
            tenant=None,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        connector_config_service = deps.connector_config_service()
        actor = connector_config_service.import_actor(
            identity.user_id,
        )
        try:
            mode, incoming = connector_config_service.normalize_config_import_request(
                payload,
            )
        except PlatformConnectorConfigServiceError as exc:
            _raise_service_error(exc)

        if "members" in incoming:
            try:
                deps.member_service().import_members_payload(
                    incoming.get("members"),
                    actor=actor,
                    mode=mode,
                    tenant=tenant_id,
                )
            except PlatformMemberServiceError as exc:
                _raise_service_error(exc)

        if "connector_configs" in incoming:
            try:
                deps.connector_config_service().import_configs_payload(
                    incoming.get("connector_configs"),
                    actor=actor,
                    mode=mode,
                    tenant=tenant_id,
                )
            except PlatformConnectorConfigServiceError as exc:
                _raise_service_error(exc)

        if "agents" in incoming:
            try:
                deps.agent_service().import_agents_payload(
                    incoming.get("agents"),
                    actor=actor,
                    mode=mode,
                )
            except PlatformAgentServiceError as exc:
                _raise_service_error(exc)

        if "workflow_templates" in incoming:
            try:
                deps.workflow_template_service().import_templates_payload(
                    incoming.get("workflow_templates"),
                    mode=mode,
                    actor=actor,
                )
            except PlatformWorkflowTemplateServiceError as exc:
                _raise_service_error(exc)

        if "tool_policy" in incoming:
            try:
                deps.tool_policy_service().import_policy_payload(
                    incoming.get("tool_policy"),
                    mode=mode,
                    tenant=tenant_id,
                )
            except PlatformToolPolicyServiceError as exc:
                _raise_service_error(exc)
            deps.set_tool_authorization_policy(
                deps.build_tool_authorization_policy(),
            )

        exported = export_platform_config(
            actor_user_id=actor,
            tenant=tenant_id,
        )
        return deps.connector_config_service().import_config_response(
            mode=mode,
            exported_config=exported,
        )

    return router
