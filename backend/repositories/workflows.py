"""Workflow persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.workflows import (
    PostgresWorkflowReadRepository,
    PostgresWorkflowWriteRepository,
    WorkflowRunRecord,
)


class WorkflowTemplateRegistryError(ValueError):
    """Raised when workflow template storage is malformed."""


class WorkflowTemplateRepository:
    """Store workflow template definitions."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def exists(self) -> bool:
        return self._path.exists()

    def list(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []

        try:
            workflows = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise WorkflowTemplateRegistryError(
                "Platform workflow registry is not valid JSON.",
            ) from exc

        if not isinstance(workflows, list):
            raise WorkflowTemplateRegistryError(
                "Platform workflow registry must be a JSON array.",
            )

        return [workflow for workflow in workflows if isinstance(workflow, dict)]

    def save_all(self, workflows: list[dict[str, Any]]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(workflows, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


class WorkflowRunRepository:
    """Store and query workflow run records in JSONL format."""

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
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        bounded_limit = min(max(limit, 1), 100)
        records: list[dict[str, Any]] = []
        for record in reversed(self.read_all()):
            if workflow_type and record.get("workflow_type") != workflow_type:
                continue
            if agent_id and record.get("agent_id") != agent_id:
                continue
            if tenant and record.get("tenant") != tenant:
                continue
            if user_id and record.get("user_id") != user_id:
                continue
            records.append(record)
            if len(records) >= bounded_limit:
                break
        return records

    def append(self, record: dict[str, Any]) -> dict[str, Any]:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False, default=str))
            file.write("\n")
        return record


class WorkflowRunRepositoryProtocol(Protocol):
    """Repository contract used by the platform workflow run service."""

    def list(
        self,
        *,
        limit: int = 20,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        ...

    def append(self, record: dict[str, Any]) -> dict[str, Any]:
        ...


class PostgresWorkflowRunReadThroughRepository:
    """Use PostgreSQL as the source of truth for tenant-scoped workflow runs.

    Once configured, platform reads and writes must carry tenant context so the
    repository never falls back to local JSONL as a production data source.
    """

    def __init__(
        self,
        *,
        postgres_reader: PostgresWorkflowReadRepository,
        postgres_writer: PostgresWorkflowWriteRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer

    def list(
        self,
        *,
        limit: int = 20,
        workflow_type: str | None = None,
        agent_id: str | None = None,
        tenant: str | None = None,
        user_id: str | None = None,
    ) -> list[dict[str, Any]]:
        if not tenant:
            raise ValueError("PostgreSQL workflow run reads require tenant context.")

        postgres_limit = 100 if agent_id else limit
        postgres_records = [
            _postgres_run_to_platform_record(record)
            for record in self._postgres_reader.list_runs(
                tenant_id=tenant,
                workflow_template_id=workflow_type,
                user_id=user_id,
                limit=postgres_limit,
            )
        ]
        if agent_id:
            postgres_records = [
                record
                for record in postgres_records
                if record.get("agent_id") == agent_id
            ]
        return postgres_records[: _clamp_limit(limit)]

    def append(self, record: dict[str, Any]) -> dict[str, Any]:
        if not record.get("tenant"):
            raise ValueError("PostgreSQL workflow run writes require tenant context.")

        persisted_record = self._postgres_writer.append_run(
            _platform_record_to_postgres_run(record),
        )
        return _postgres_run_to_platform_record(persisted_record)


def _postgres_run_to_platform_record(record: WorkflowRunRecord) -> dict[str, Any]:
    if isinstance(record.output, dict):
        platform_record = dict(record.output)
    else:
        platform_record = {}

    input_context = record.input if isinstance(record.input, dict) else {}
    inputs = input_context.get("inputs")
    if not isinstance(inputs, dict):
        inputs = input_context

    platform_record.setdefault("run_id", record.id)
    platform_record.setdefault("workflow_type", record.workflow_template_id)
    platform_record.setdefault("status", record.status)
    platform_record.setdefault("started_at", record.created_at)
    platform_record.setdefault("finished_at", record.completed_at)
    platform_record.setdefault("tenant", record.tenant_id)
    platform_record.setdefault("user_id", record.user_id)
    platform_record.setdefault("inputs", inputs)
    platform_record.setdefault("agent_id", input_context.get("agent_id"))
    platform_record.setdefault("connector", input_context.get("connector"))
    platform_record.setdefault(
        "connector_source",
        input_context.get("connector_source"),
    )
    platform_record.setdefault("approval_id", input_context.get("approval_id"))
    platform_record.setdefault("summary", record.error)
    platform_record.setdefault("steps", [])
    platform_record.setdefault("tool_calls", [])
    platform_record["source"] = "postgres"
    return platform_record


def _platform_record_to_postgres_run(record: dict[str, Any]) -> WorkflowRunRecord:
    input_payload = {
        "inputs": _dict_record_value(record.get("inputs")),
        "agent_id": _optional_record_value(record.get("agent_id")),
        "connector": _optional_record_value(record.get("connector")),
        "connector_source": _optional_record_value(record.get("connector_source")),
        "approval_id": _optional_record_value(record.get("approval_id")),
    }
    status = str(record.get("status") or "completed")
    return WorkflowRunRecord(
        id=str(record["run_id"]),
        tenant_id=str(record["tenant"]),
        workflow_template_id=str(record["workflow_type"]),
        user_id=str(record["user_id"]),
        status=status,
        input=input_payload,
        output=dict(record),
        error=(
            _optional_record_value(record.get("summary"))
            if status == "blocked"
            else None
        ),
        created_at=str(record["started_at"]),
        completed_at=_optional_record_value(record.get("finished_at")),
    )


def _dict_record_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _optional_record_value(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _clamp_limit(limit: int) -> int:
    return min(max(limit, 1), 100)
