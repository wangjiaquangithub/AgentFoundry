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


class PlatformModelConfigService:
    """Manage tenant-scoped model configuration records with audit evidence."""

    def __init__(
        self,
        *,
        model_config_writer: ModelConfigWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._model_config_writer = model_config_writer
        self._audit_event_writer = audit_event_writer
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


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
