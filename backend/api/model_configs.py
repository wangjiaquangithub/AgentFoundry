"""Enterprise model configuration HTTP routes."""

from dataclasses import dataclass
from typing import Callable
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from api.schemas import (
    EnterpriseModelConfigDetailRequest,
    EnterpriseModelConfigsRequest,
    EnterpriseModelConfigUpsertRequest,
)
from services.model_configs import (
    ModelConfigApiCommandInput,
    PlatformModelConfigService,
    PlatformModelConfigServiceError,
)


@dataclass(frozen=True)
class ModelConfigRouteDependencies:
    model_config_service: Callable[[], PlatformModelConfigService | None]
    tenant_hint_from_user_id: Callable[[str], str | None]


def _resolve_tenant(
    *,
    tenant: str | None,
    request: Request,
    tenant_hint_from_user_id: Callable[[str], str | None],
) -> str:
    explicit_tenant = (tenant or "").strip()
    user_id = request.headers.get("X-User-ID") or ""
    hinted_tenant = tenant_hint_from_user_id(user_id)
    if explicit_tenant and hinted_tenant and explicit_tenant != hinted_tenant:
        raise HTTPException(
            status_code=403,
            detail="tenant does not match X-User-ID tenant boundary.",
        )

    tenant_id = explicit_tenant or hinted_tenant
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant is required when X-User-ID does not imply a tenant.",
        )
    return tenant_id


def create_model_config_router(
    deps: ModelConfigRouteDependencies,
) -> APIRouter:
    router = APIRouter()

    @router.post("/enterprise/platform/model-configs")
    async def list_enterprise_platform_model_configs(
        payload: EnterpriseModelConfigsRequest,
        request: Request,
    ) -> dict[str, object]:
        """Return tenant model configurations through the PostgreSQL service."""
        service = deps.model_config_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail="Production model configuration reads require PostgreSQL.",
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            model_configs = service.list_model_configs_for_api(
                tenant_id=tenant_id,
                purpose=payload.purpose,
                status=payload.status,
                limit=payload.limit,
            )
        except PlatformModelConfigServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "model_configs": model_configs,
        }

    @router.post("/enterprise/platform/model-configs/detail")
    async def get_enterprise_platform_model_config(
        payload: EnterpriseModelConfigDetailRequest,
        request: Request,
    ) -> dict[str, object]:
        """Return one tenant model configuration through the PostgreSQL service."""
        service = deps.model_config_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail="Production model configuration reads require PostgreSQL.",
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        try:
            model_config = service.get_model_config_for_api(
                tenant_id=tenant_id,
                model_config_id=payload.model_config_id,
            )
        except PlatformModelConfigServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "model_config": model_config,
        }

    @router.post("/enterprise/platform/model-configs/upsert")
    async def upsert_enterprise_platform_model_config(
        payload: EnterpriseModelConfigUpsertRequest,
        request: Request,
    ) -> dict[str, object]:
        """Persist one tenant model configuration through the PostgreSQL service."""
        service = deps.model_config_service()
        if service is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Production model configuration writes require PostgreSQL. "
                    "Local JSON or SQLite storage is not a production model "
                    "configuration target."
                ),
            )

        tenant_id = _resolve_tenant(
            tenant=payload.tenant,
            request=request,
            tenant_hint_from_user_id=deps.tenant_hint_from_user_id,
        )
        actor_user_id = request.headers.get("X-User-ID") or "system"
        try:
            model_config = service.upsert_model_config_from_api(
                ModelConfigApiCommandInput(
                    id=payload.model_config_id or f"model-config-{uuid4()}",
                    tenant_id=tenant_id,
                    name=payload.name,
                    provider=payload.provider,
                    model=payload.model,
                    purpose=payload.purpose,
                    status=payload.status,
                    config_ref=payload.config_ref,
                    actor_user_id=actor_user_id,
                )
            )
        except PlatformModelConfigServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {
            "tenant": tenant_id,
            "model_config": model_config,
        }

    return router
