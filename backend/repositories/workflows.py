"""Workflow persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any


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

    def append(self, record: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False, default=str))
            file.write("\n")
