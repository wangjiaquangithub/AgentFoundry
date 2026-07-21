# -*- coding: utf-8 -*-
"""Platform identity and resource access helpers."""
from __future__ import annotations

from typing import Any, Callable

from fastapi import HTTPException, Request

from connectors import EnterpriseConnector
from permissions import ToolAuthorizationPolicy
from services.agents import PlatformAgentService, PlatformAgentServiceError
from services.connectors import (
    PlatformConnectorConfigService,
    PlatformConnectorConfigServiceError,
)
from services.members import PlatformMemberService, PlatformMemberServiceError


class PlatformAccessHelpers:
    """Resolve identity metadata and validate platform resource references."""

    def __init__(
        self,
        *,
        agent_service: Callable[[], PlatformAgentService],
        connector_config_service: Callable[[], PlatformConnectorConfigService],
        member_service: Callable[[], PlatformMemberService],
        enterprise_connector: EnterpriseConnector,
        authorization_policy: Callable[[], ToolAuthorizationPolicy],
        tool_names: list[str],
        raise_agent_error: Callable[[PlatformAgentServiceError], None],
        raise_connector_config_error: Callable[
            [PlatformConnectorConfigServiceError],
            None,
        ],
        raise_member_error: Callable[[PlatformMemberServiceError], None],
    ) -> None:
        self._agent_service = agent_service
        self._connector_config_service = connector_config_service
        self._member_service = member_service
        self._enterprise_connector = enterprise_connector
        self._authorization_policy = authorization_policy
        self._tool_names = tool_names
        self._raise_agent_error = raise_agent_error
        self._raise_connector_config_error = raise_connector_config_error
        self._raise_member_error = raise_member_error

    def published_agent_tool_scope_for_user(
        self,
        agent_id: str,
        user_id: str,
    ) -> tuple[dict[str, Any], set[str]]:
        try:
            return self._agent_service().published_tool_scope_access_context(
                agent_id,
                user_id=user_id,
            )
        except PlatformMemberServiceError as exc:
            self._raise_member_error(exc)
        except PlatformAgentServiceError as exc:
            self._raise_agent_error(exc)

    def role_for_user(self, user_id: str) -> str:
        tenant_hint = tenant_hint_from_user_id(user_id)
        if tenant_hint:
            current_tenant = tenant_hint
        else:
            try:
                current_tenant = (
                    self._connector_config_service().runtime_tenant_for_user(user_id)
                )
            except PlatformConnectorConfigServiceError as exc:
                self._raise_connector_config_error(exc)
        if not current_tenant:
            try:
                current_tenant = (
                    self._connector_config_service().configured_tenant_for_user(user_id)
                )
            except PlatformConnectorConfigServiceError as exc:
                self._raise_connector_config_error(exc)
        for identity in self.identity_metadata(user_id, current_tenant):
            if identity.get("user_id") == user_id:
                return str(identity.get("role") or "").strip()
        return ""

    async def validate_agent_resources(
        self,
        request: Request,
        user_id: str,
        *,
        model_config_id: str | None,
        knowledge_base_ids: list[str],
    ) -> None:
        if model_config_id:
            await self._validate_model_config(request, user_id, model_config_id)

        if not knowledge_base_ids:
            return

        knowledge_base_service = getattr(
            request.app.state,
            "knowledge_base_service",
            None,
        )
        storage = getattr(request.app.state, "storage", None)
        knowledge_bases = []
        if knowledge_base_service is not None:
            knowledge_bases = await knowledge_base_service.list_knowledge_bases(user_id)
        elif storage is not None:
            try:
                knowledge_bases = await storage.list_knowledge_bases(user_id)
            except AttributeError:
                knowledge_bases = []

        visible_ids = {
            record_id
            for record_id in (resource_record_id(record) for record in knowledge_bases)
            if record_id
        }
        missing_ids = [
            knowledge_base_id
            for knowledge_base_id in knowledge_base_ids
            if knowledge_base_id not in visible_ids
        ]
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Unknown knowledge bases configured for platform agent.",
                    "unknown_knowledge_base_ids": missing_ids,
                },
            )

    def identity_metadata(
        self,
        current_user_id: str,
        current_tenant: str,
    ) -> list[dict[str, Any]]:
        def current_tenant_sample_questions() -> list[Any]:
            try:
                runtime_connector, _source = (
                    self._connector_config_service()
                    .runtime_enterprise_connector_for_tenant(current_tenant)
                )
            except PlatformConnectorConfigServiceError as exc:
                self._raise_connector_config_error(exc)
            return list(
                runtime_connector.describe_tenant_workspace(current_tenant).get(
                    "sample_questions",
                    [],
                ),
            )

        try:
            return self._member_service().identity_metadata_payload(
                current_user_id=current_user_id,
                current_tenant=current_tenant,
                connector_identities=self._enterprise_connector.list_demo_identities(),
                tenant_for_user=self._enterprise_connector.tenant_for_user,
                current_tenant_sample_questions=current_tenant_sample_questions,
                authorization_policy=self._authorization_policy(),
                tool_names=self._tool_names,
            )
        except PlatformMemberServiceError as exc:
            self._raise_member_error(exc)

    async def _validate_model_config(
        self,
        request: Request,
        user_id: str,
        model_config_id: str,
    ) -> None:
        access_service = getattr(request.app.state, "resource_access_service", None)
        storage = getattr(request.app.state, "storage", None)
        credential = None

        if access_service is not None:
            try:
                credential = await access_service.resolve_credential(
                    user_id,
                    model_config_id,
                )
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
        elif storage is not None:
            try:
                credential = await storage.get_credential(user_id, model_config_id)
            except AttributeError:
                credential = None

        if credential is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": (
                        "Unknown model credential configured for platform agent."
                    ),
                    "unknown_model_config_id": model_config_id,
                },
            )


def tenant_hint_from_user_id(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    tenant, _user = user_id.split(":", 1)
    tenant = tenant.strip()
    return tenant or None


def resource_record_id(record: Any) -> str | None:
    if isinstance(record, dict):
        value = record.get("id")
    else:
        value = getattr(record, "id", None)
    if value is None:
        return None
    item = str(value).strip()
    return item or None
