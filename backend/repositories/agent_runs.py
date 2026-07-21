"""Agent run persistence for the AgentFoundry platform."""

import json
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.runs import (
    AgentRunRecord,
    PostgresAgentRunReadRepository,
    PostgresAgentRunWriteRepository,
)


class AgentRunRepositoryProtocol(Protocol):
    """Repository contract used by the platform agent run service."""

    def list(
        self,
        *,
        limit: int = 20,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        ...

    def get(self, turn_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        ...

    def append(self, record: dict[str, Any]) -> None:
        ...

    def delete(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> int:
        ...


class AgentRunRepository:
    """Store and query enterprise agent run records in JSONL format."""

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
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        bounded_limit = min(max(limit, 1), 100)
        records: list[dict[str, Any]] = []
        for record in reversed(self.read_all()):
            if agent_id and record.get("agent_id") != agent_id:
                continue
            if tenant and record.get("tenant") != tenant:
                continue
            if user_id and record.get("user_id") != user_id:
                continue
            if session_id and record.get("session_id") != session_id:
                continue
            records.append(record)
            if len(records) >= bounded_limit:
                break
        return records

    def get(self, turn_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        if not turn_id:
            return None

        for record in reversed(self.read_all()):
            if record.get("turn_id") == turn_id:
                if tenant and record.get("tenant") != tenant:
                    continue
                return record
        return None

    def append(self, record: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False, default=str))
            file.write("\n")

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

    def delete(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> int:
        kept_records: list[dict[str, Any]] = []
        deleted_count = 0
        for record in self.read_all():
            matched = True
            if agent_id and record.get("agent_id") != agent_id:
                matched = False
            if tenant and record.get("tenant") != tenant:
                matched = False
            if user_id and record.get("user_id") != user_id:
                matched = False
            if session_id and record.get("session_id") != session_id:
                matched = False

            if matched:
                deleted_count += 1
            else:
                kept_records.append(record)

        if deleted_count:
            self.replace_all(kept_records)
        return deleted_count


class PostgresAgentRunReadThroughRepository:
    """Use PostgreSQL as the source of truth for tenant-scoped agent runs.

    Tenant-scoped records use the production PostgreSQL schema. Records without
    tenant context stay on the legacy repository for local development
    compatibility until those callers are removed or migrated.
    """

    def __init__(
        self,
        *,
        postgres_reader: PostgresAgentRunReadRepository,
        postgres_writer: PostgresAgentRunWriteRepository,
        fallback_repository: AgentRunRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer
        self._fallback_repository = fallback_repository

    def list(
        self,
        *,
        limit: int = 20,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not tenant:
            return self._fallback_repository.list(
                limit=limit,
                agent_id=agent_id,
                tenant=tenant,
                user_id=user_id,
                session_id=session_id,
            )

        postgres_records = [
            _postgres_run_to_platform_record(record)
            for record in self._postgres_reader.list_runs(
                tenant_id=tenant,
                agent_id=agent_id,
                user_id=user_id,
                session_id=session_id,
                limit=limit,
            )
        ]
        return postgres_records

    def get(self, turn_id: str, *, tenant: str | None = None) -> dict[str, Any] | None:
        if tenant:
            record = self._postgres_reader.get_run(tenant_id=tenant, run_id=turn_id)
            if record is not None:
                return _postgres_run_to_platform_record(record)
            return None
        return self._fallback_repository.get(turn_id, tenant=tenant)

    def append(self, record: dict[str, Any]) -> None:
        if not record.get("tenant"):
            self._fallback_repository.append(record)
            return

        self._postgres_writer.append_run(_platform_record_to_postgres_run(record))

    def delete(
        self,
        *,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> int:
        fallback_deleted = self._fallback_repository.delete(
            agent_id=agent_id,
            tenant=tenant,
            user_id=user_id,
            session_id=session_id,
        )
        if not tenant:
            return fallback_deleted

        return fallback_deleted + self._postgres_writer.delete_runs(
            tenant_id=tenant,
            agent_id=agent_id,
            user_id=user_id,
            session_id=session_id,
        )


def _postgres_run_to_platform_record(record: AgentRunRecord) -> dict[str, Any]:
    return {
        "turn_id": record.id,
        "tenant": record.tenant_id,
        "agent_id": record.agent_id,
        "agent_version_id": record.agent_version_id,
        "user_id": record.user_id,
        "session_id": record.session_id,
        "status": record.status,
        "question": record.question,
        "answer": record.answer,
        "runtime_adapter": {
            "provider": record.runtime_provider,
            "runtime_invocation_id": record.runtime_invocation_id,
        },
        "runtime_invocation_id": record.runtime_invocation_id,
        "created_at": record.created_at,
        "completed_at": record.completed_at,
        "source": "postgres",
    }


def _platform_record_to_postgres_run(record: dict[str, Any]) -> AgentRunRecord:
    runtime_adapter = record.get("runtime_adapter")
    if not isinstance(runtime_adapter, dict):
        runtime_adapter = {}

    runtime_provider = (
        record.get("runtime_provider")
        or runtime_adapter.get("provider")
        or "unknown"
    )
    runtime_invocation_id = (
        record.get("runtime_invocation_id")
        or runtime_adapter.get("runtime_invocation_id")
    )

    return AgentRunRecord(
        id=str(record["turn_id"]),
        tenant_id=str(record["tenant"]),
        agent_id=_optional_record_value(record.get("agent_id")),
        agent_version_id=_optional_record_value(record.get("agent_version_id")),
        user_id=str(record["user_id"]),
        session_id=_optional_record_value(record.get("session_id")),
        status=str(record.get("status") or "completed"),
        question=str(record["question"]),
        answer=_optional_record_value(record.get("answer")),
        runtime_provider=str(runtime_provider),
        runtime_invocation_id=_optional_record_value(runtime_invocation_id),
        created_at=str(record["created_at"]),
        completed_at=_optional_record_value(record.get("completed_at")),
    )


def _optional_record_value(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _clamp_limit(limit: int) -> int:
    return min(max(limit, 1), 100)
