"""Service-layer orchestration for tenant-scoped model configuration writes."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, ModelConfigRecord


class PlatformModelConfigServiceError(ValueError):
    """Raised when a model configuration operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class ModelConfigWriteRepository(Protocol):
    """Write tenant-scoped model configs to the production system of record."""

    def upsert_model_config(self, record: ModelConfigRecord) -> ModelConfigRecord:
        """Persist one tenant-scoped model configuration."""


class ModelConfigReadRepository(Protocol):
    """Read tenant-scoped model configs from the production system of record."""

    def list_model_configs(
        self,
        *,
        tenant_id: str,
        purpose: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[ModelConfigRecord]:
        """Return tenant-scoped model configurations."""

    def get_model_config(
        self,
        *,
        tenant_id: str,
        model_config_id: str,
    ) -> ModelConfigRecord | None:
        """Return one tenant-scoped model configuration."""


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


@dataclass(frozen=True)
class ModelConfigWriteCommand:
    """Service input for creating or updating a tenant model configuration."""

    id: str
    tenant_id: str
    name: str
    provider: str
    model: str
    purpose: str
    status: str
    config_ref: str | None
    actor_user_id: str


@dataclass(frozen=True)
class ModelConfigApiCommandInput:
    """API-facing model config write input before service command conversion."""

    id: str
    tenant_id: str
    name: str
    provider: str
    model: str
    purpose: str
    status: str
    config_ref: str | None
    actor_user_id: str


class PlatformModelConfigService:
    """Manage tenant-scoped model configuration records with audit evidence."""

    def __init__(
        self,
        *,
        model_config_writer: ModelConfigWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        model_config_reader: ModelConfigReadRepository | None = None,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._model_config_writer = model_config_writer
        self._audit_event_writer = audit_event_writer
        self._model_config_reader = model_config_reader
        self._now = now or _utc_now_iso

    def upsert_model_config(
        self,
        command: ModelConfigWriteCommand,
    ) -> ModelConfigRecord:
        tenant_id = _required_text(command.tenant_id, "tenant_id")
        model_config_id = _required_text(command.id, "id")
        actor_user_id = _required_text(command.actor_user_id, "actor_user_id")
        timestamp = self._now()

        requested = ModelConfigRecord(
            id=model_config_id,
            tenant_id=tenant_id,
            name=_required_text(command.name, "name"),
            provider=_required_text(command.provider, "provider"),
            model=_required_text(command.model, "model"),
            purpose=_required_text(command.purpose, "purpose"),
            status=_required_text(command.status, "status"),
            config_ref=_optional_text(command.config_ref),
            created_at=timestamp,
            updated_at=timestamp,
        )

        try:
            persisted = self._model_config_writer.upsert_model_config(requested)
            self._append_model_config_audit_event(
                record=persisted,
                actor_user_id=actor_user_id,
                event_type="model_config.upserted",
                created_at=timestamp,
            )
        except PlatformModelConfigServiceError:
            raise
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformModelConfigServiceError(500, str(exc)) from exc

        return persisted

    def upsert_model_config_from_api(
        self,
        input: ModelConfigApiCommandInput,
    ) -> dict[str, Any]:
        persisted = self.upsert_model_config(
            ModelConfigWriteCommand(
                id=input.id,
                tenant_id=input.tenant_id,
                name=input.name,
                provider=input.provider,
                model=input.model,
                purpose=input.purpose,
                status=input.status,
                config_ref=input.config_ref,
                actor_user_id=input.actor_user_id,
            ),
        )
        return model_config_response_payload(persisted)

    def list_model_configs_for_api(
        self,
        *,
        tenant_id: str,
        purpose: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        if self._model_config_reader is None:
            raise PlatformModelConfigServiceError(
                503,
                "Production model configuration reads require PostgreSQL.",
            )

        tenant = _required_text(tenant_id, "tenant_id")
        records = self._model_config_reader.list_model_configs(
            tenant_id=tenant,
            purpose=_optional_text(purpose),
            status=_optional_text(status),
            limit=_clamp_limit(limit),
        )
        return [model_config_response_payload(record) for record in records]

    def get_model_config_for_api(
        self,
        *,
        tenant_id: str,
        model_config_id: str,
    ) -> dict[str, Any]:
        if self._model_config_reader is None:
            raise PlatformModelConfigServiceError(
                503,
                "Production model configuration reads require PostgreSQL.",
            )

        tenant = _required_text(tenant_id, "tenant_id")
        record = self._model_config_reader.get_model_config(
            tenant_id=tenant,
            model_config_id=_required_text(model_config_id, "model_config_id"),
        )
        if record is None:
            raise PlatformModelConfigServiceError(404, "model configuration was not found.")
        return model_config_response_payload(record)

    def _append_model_config_audit_event(
        self,
        *,
        record: ModelConfigRecord,
        actor_user_id: str,
        event_type: str,
        created_at: str,
    ) -> None:
        payload = {
            "schema_version": 1,
            "tenant_id": record.tenant_id,
            "model_config_id": record.id,
            "name": record.name,
            "provider": record.provider,
            "model": record.model,
            "purpose": record.purpose,
            "status": record.status,
            "config_ref_configured": bool(record.config_ref),
        }
        persisted_audit_event = self._audit_event_writer.append_audit_event(
            AuditEventRecord(
                id=str(uuid4()),
                tenant_id=record.tenant_id,
                actor_user_id=actor_user_id,
                event_type=event_type,
                target_type="model_config",
                target_id=record.id,
                payload=payload,
                created_at=created_at,
            ),
        )
        if not persisted_audit_event.id:
            raise PlatformModelConfigServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )


def _required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise PlatformModelConfigServiceError(400, f"{field_name} is required.")
    return normalized


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _clamp_limit(limit: int) -> int:
    return min(max(int(limit), 1), 100)


def model_config_response_payload(record: ModelConfigRecord) -> dict[str, Any]:
    """Return an API-safe model config payload without secret references."""

    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "name": record.name,
        "provider": record.provider,
        "model": record.model,
        "purpose": record.purpose,
        "status": record.status,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "config_ref_configured": bool(record.config_ref),
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
