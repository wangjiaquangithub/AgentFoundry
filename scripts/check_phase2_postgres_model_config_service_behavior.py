#!/usr/bin/env python3
"""Exercise PostgreSQL model config service write and audit behavior."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.persistence import AuditEventRecord, ModelConfigRecord
from backend.services.model_configs import (
    ModelConfigWriteCommand,
    PlatformModelConfigService,
    PlatformModelConfigServiceError,
)


SECRET_CONFIG_REF = "secret://tenant/acme/openai-primary"


@dataclass
class CapturingModelConfigWriter:
    records: list[ModelConfigRecord] = field(default_factory=list)

    def upsert_model_config(self, record: ModelConfigRecord) -> ModelConfigRecord:
        self.records.append(record)
        return record


@dataclass
class CapturingAuditEventWriter:
    records: list[AuditEventRecord] = field(default_factory=list)

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        self.records.append(record)
        return record


class EmptyAuditEventIdWriter:
    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        return AuditEventRecord(
            id="",
            tenant_id=record.tenant_id,
            actor_user_id=record.actor_user_id,
            event_type=record.event_type,
            target_type=record.target_type,
            target_id=record.target_id,
            payload=record.payload,
            created_at=record.created_at,
        )


def _command() -> ModelConfigWriteCommand:
    return ModelConfigWriteCommand(
        id="model-config-chat-primary",
        tenant_id="acme",
        name="Primary Chat",
        provider="openai",
        model="gpt-4.1",
        purpose="chat",
        status="active",
        config_ref=SECRET_CONFIG_REF,
        actor_user_id="acme_admin",
    )


def _check_audited_write() -> list[str]:
    errors: list[str] = []
    model_writer = CapturingModelConfigWriter()
    audit_writer = CapturingAuditEventWriter()
    service = PlatformModelConfigService(
        model_config_writer=model_writer,
        audit_event_writer=audit_writer,
        now=lambda: "2026-01-01T00:00:00+00:00",
    )

    persisted = service.upsert_model_config(_command())

    if persisted.id != "model-config-chat-primary":
        errors.append("service did not return the persisted model config")
    if len(model_writer.records) != 1:
        errors.append("service must write exactly one model config record")
    if len(audit_writer.records) != 1:
        errors.append("service must write exactly one audit event")
        return errors

    audit_event = audit_writer.records[0]
    if audit_event.tenant_id != "acme":
        errors.append("audit event must be tenant scoped")
    if audit_event.actor_user_id != "acme_admin":
        errors.append("audit event must preserve actor_user_id")
    if audit_event.event_type != "model_config.upserted":
        errors.append("audit event type must be model_config.upserted")
    if audit_event.target_type != "model_config":
        errors.append("audit event target_type must be model_config")
    if audit_event.target_id != "model-config-chat-primary":
        errors.append("audit event target_id must match the model config")

    payload = audit_event.payload
    if payload.get("config_ref_configured") is not True:
        errors.append("audit payload must record config_ref_configured=true")
    if SECRET_CONFIG_REF in str(payload):
        errors.append("audit payload must not expose the config_ref secret reference")
    if "config_ref" in payload:
        errors.append("audit payload must not include config_ref")

    return errors


def _check_audit_write_failure() -> list[str]:
    service = PlatformModelConfigService(
        model_config_writer=CapturingModelConfigWriter(),
        audit_event_writer=EmptyAuditEventIdWriter(),
        now=lambda: "2026-01-01T00:00:00+00:00",
    )
    try:
        service.upsert_model_config(_command())
    except PlatformModelConfigServiceError as exc:
        if exc.status_code != 500:
            return ["audit write failure must be surfaced as a 500 service error"]
        return []
    return ["service must fail when the audit event write is not persisted"]


def main() -> int:
    errors = [*_check_audited_write(), *_check_audit_write_failure()]

    print("Phase 2 PostgreSQL model config service behavior gate")
    print("- write repository: exercised")
    print("- audit repository: exercised")
    print("- config_ref exposure: blocked from audit payload")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL model config service behavior is audited and secret-safe.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
