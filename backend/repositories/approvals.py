"""Approval request persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.approvals import (
    ApprovalRecord,
    PostgresApprovalReadRepository,
    PostgresApprovalWriteRepository,
)


class ApprovalRequestRepositoryProtocol(Protocol):
    """Repository contract used by the platform approval service."""

    def list(
        self,
        *,
        limit: int = 20,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        ...

    def get(self, approval_id: str) -> dict[str, Any] | None:
        ...

    def append(self, record: dict[str, Any]) -> None:
        ...

    def update_status(
        self,
        *,
        approval_id: str,
        status: str,
        decided_by: str,
        decided_at: str,
        decision_note: str | None,
    ) -> dict[str, Any] | None:
        ...


class ApprovalRequestRepository:
    """Store and query approval request records in JSONL format."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def read_all(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []

        records: list[dict[str, Any]] = []
        for line in self._path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict):
                records.append(record)
        return records

    def list(
        self,
        *,
        limit: int = 20,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        bounded_limit = min(max(limit, 1), 100)
        records: list[dict[str, Any]] = []
        for record in reversed(self.read_all()):
            if status and record.get("status") != status:
                continue
            if tenant and record.get("tenant") != tenant:
                continue
            if user_id and record.get("user_id") != user_id:
                continue
            if agent_id and record.get("agent_id") != agent_id:
                continue
            records.append(record)
            if len(records) >= bounded_limit:
                break
        return records

    def append(self, record: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False, default=str))
            file.write("\n")

    def get(self, approval_id: str) -> dict[str, Any] | None:
        if not approval_id:
            return None

        for record in reversed(self.read_all()):
            if record.get("approval_id") == approval_id:
                return record
        return None

    def update_status(
        self,
        *,
        approval_id: str,
        status: str,
        decided_by: str,
        decided_at: str,
        decision_note: str | None,
    ) -> dict[str, Any] | None:
        records = self.read_all()
        for index, record in enumerate(records):
            if record.get("approval_id") != approval_id:
                continue
            updated = {
                **record,
                "status": status,
                "decided_at": decided_at,
                "decided_by": decided_by,
                "decision_note": decision_note,
            }
            records[index] = updated
            self.replace_all(records)
            return updated
        return None

    def replace_all(self, records: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            json.dumps(record, ensure_ascii=False, default=str)
            for record in records
        ]
        self._path.write_text(
            "\n".join(lines) + ("\n" if lines else ""),
            encoding="utf-8",
        )


class PostgresApprovalReadThroughRepository:
    """Use PostgreSQL for tenant-scoped approvals with a development fallback.

    Tenant-scoped approval records use the production PostgreSQL schema. List
    calls without tenant context remain on the legacy JSONL repository for
    local development compatibility during the data-layer migration. Approval
    id reads, writes, and decisions are authoritative in PostgreSQL once this
    repository is configured.
    """

    def __init__(
        self,
        *,
        postgres_reader: PostgresApprovalReadRepository,
        postgres_writer: PostgresApprovalWriteRepository,
        fallback_repository: ApprovalRequestRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer
        self._fallback_repository = fallback_repository

    def list(
        self,
        *,
        limit: int = 20,
        status: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not tenant:
            return self._fallback_repository.list(
                limit=limit,
                status=status,
                tenant=tenant,
                user_id=user_id,
                agent_id=agent_id,
            )

        postgres_limit = 100 if user_id or agent_id else limit
        postgres_records = [
            _postgres_approval_to_platform_record(record)
            for record in self._postgres_reader.list_approvals(
                tenant_id=tenant,
                status=status,
                limit=postgres_limit,
            )
        ]
        postgres_records = [
            record for record in postgres_records if _matches_filters(
                record,
                user_id=user_id,
                agent_id=agent_id,
            )
        ]
        return postgres_records[: _clamp_limit(limit)]

    def get(self, approval_id: str) -> dict[str, Any] | None:
        if not approval_id:
            return None

        postgres_record = self._postgres_reader.get_approval_by_id(
            approval_id=approval_id,
        )
        if postgres_record is not None:
            return _postgres_approval_to_platform_record(postgres_record)
        return None

    def append(self, record: dict[str, Any]) -> None:
        if not record.get("tenant"):
            raise ValueError("PostgreSQL approval writes require tenant context.")

        self._postgres_writer.append_approval(
            _platform_record_to_postgres_approval(record),
        )

    def update_status(
        self,
        *,
        approval_id: str,
        status: str,
        decided_by: str,
        decided_at: str,
        decision_note: str | None,
    ) -> dict[str, Any] | None:
        postgres_record = self._postgres_reader.get_approval_by_id(
            approval_id=approval_id,
        )
        if postgres_record is not None:
            payload = {
                **postgres_record.payload,
                "decision_note": decision_note,
            }
            updated = self._postgres_writer.update_approval_status(
                approval_id=approval_id,
                status=status,
                approved_by=decided_by,
                resolved_at=decided_at,
                payload=payload,
            )
            if updated is None:
                return None
            return _postgres_approval_to_platform_record(updated)

        return None


def _postgres_approval_to_platform_record(record: ApprovalRecord) -> dict[str, Any]:
    payload = record.payload
    return {
        "approval_id": record.id,
        "status": record.status,
        "tenant": record.tenant_id,
        "user_id": payload.get("user_id") or record.requested_by,
        "agent_id": payload.get("agent_id"),
        "request_type": record.request_type,
        "tool_name": payload.get("tool_name"),
        "workflow_type": payload.get("workflow_type"),
        "inputs": payload.get("inputs") or {},
        "reason": record.reason,
        "requested_at": record.created_at,
        "requested_by": record.requested_by,
        "decided_at": record.resolved_at,
        "decided_by": record.approved_by,
        "decision_note": payload.get("decision_note"),
        "source": "postgres",
    }


def _platform_record_to_postgres_approval(record: dict[str, Any]) -> ApprovalRecord:
    request_type = str(record["request_type"])
    target_type, target_id = _approval_target(request_type, record)
    return ApprovalRecord(
        id=str(record["approval_id"]),
        tenant_id=str(record["tenant"]),
        request_type=request_type,
        target_type=target_type,
        target_id=target_id,
        status=str(record.get("status") or "pending"),
        requested_by=str(record["requested_by"]),
        approved_by=_optional_record_value(record.get("decided_by")),
        reason=_optional_record_value(record.get("reason")),
        payload={
            "user_id": record.get("user_id"),
            "agent_id": record.get("agent_id"),
            "tool_name": record.get("tool_name"),
            "workflow_type": record.get("workflow_type"),
            "inputs": record.get("inputs") if isinstance(record.get("inputs"), dict) else {},
            "decision_note": record.get("decision_note"),
        },
        created_at=str(record["requested_at"]),
        resolved_at=_optional_record_value(record.get("decided_at")),
    )


def _approval_target(
    request_type: str,
    record: dict[str, Any],
) -> tuple[str, str]:
    if request_type == "tool_run":
        return "tool", str(record["tool_name"])
    if request_type == "workflow_run":
        return "workflow", str(record["workflow_type"])
    return "agent", str(record["agent_id"])


def _matches_filters(
    record: dict[str, Any],
    *,
    user_id: str | None = None,
    agent_id: str | None = None,
) -> bool:
    if user_id and record.get("user_id") != user_id:
        return False
    if agent_id and record.get("agent_id") != agent_id:
        return False
    return True


def _optional_record_value(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _clamp_limit(limit: int) -> int:
    return min(max(limit, 1), 100)
