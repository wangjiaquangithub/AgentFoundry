"""Service-layer orchestration for tenant-scoped knowledge base writes."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord, KnowledgeBaseRecord


class PlatformKnowledgeBaseServiceError(ValueError):
    """Raised when a knowledge base mutation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class KnowledgeBaseWriteRepository(Protocol):
    """Write tenant-scoped knowledge bases to the production system of record."""

    def upsert_knowledge_base(self, record: KnowledgeBaseRecord) -> KnowledgeBaseRecord:
        """Persist one tenant-scoped knowledge base."""


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


@dataclass(frozen=True)
class KnowledgeBaseApiCommandInput:
    """API-facing knowledge base write input."""

    id: str
    tenant_id: str
    name: str
    description: str | None
    status: str
    embedding_model_config_id: str | None
    actor_user_id: str


class PlatformKnowledgeBaseService:
    """Manage tenant-scoped knowledge base records with audit evidence."""

    def __init__(
        self,
        *,
        knowledge_base_writer: KnowledgeBaseWriteRepository,
        audit_event_writer: AuditEventWriteRepository,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._knowledge_base_writer = knowledge_base_writer
        self._audit_event_writer = audit_event_writer
        self._now = now or _utc_now_iso

    def upsert_knowledge_base_from_api(
        self,
        input: KnowledgeBaseApiCommandInput,
    ) -> KnowledgeBaseRecord:
        tenant_id = _required_text(input.tenant_id, "tenant_id")
        knowledge_base_id = _required_text(input.id, "id")
        actor_user_id = _required_text(input.actor_user_id, "actor_user_id")
        timestamp = self._now()
        requested = KnowledgeBaseRecord(
            id=knowledge_base_id,
            tenant_id=tenant_id,
            name=_required_text(input.name, "name"),
            description=_optional_text(input.description),
            status=_required_text(input.status, "status"),
            embedding_model_config_id=_optional_text(
                input.embedding_model_config_id,
            ),
            created_at=timestamp,
            updated_at=timestamp,
        )

        try:
            persisted = self._knowledge_base_writer.upsert_knowledge_base(requested)
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=persisted.tenant_id,
                    actor_user_id=actor_user_id,
                    event_type="knowledge_base.upserted",
                    target_type="knowledge_base",
                    target_id=persisted.id,
                    payload={
                        "schema_version": 1,
                        "tenant_id": persisted.tenant_id,
                        "knowledge_base_id": persisted.id,
                        "name": persisted.name,
                        "description": persisted.description,
                        "status": persisted.status,
                        "embedding_model_config_id": (
                            persisted.embedding_model_config_id
                        ),
                    },
                    created_at=timestamp,
                ),
            )
        except PlatformKnowledgeBaseServiceError:
            raise
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformKnowledgeBaseServiceError(500, str(exc)) from exc

        if not persisted_audit_event.id:
            raise PlatformKnowledgeBaseServiceError(
                500,
                "PostgreSQL audit event write did not return a persisted id.",
            )
        return persisted


def _required_text(value: str, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise PlatformKnowledgeBaseServiceError(400, f"{field_name} is required.")
    return normalized


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
