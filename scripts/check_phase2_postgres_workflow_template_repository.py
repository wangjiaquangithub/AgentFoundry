#!/usr/bin/env python3
"""Check workflow template repository is wired through PostgreSQL selection."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    persistence = _read("backend/persistence/workflows.py")
    repositories = _read("backend/repositories/workflows.py")
    composition = _read("backend/services/composition.py")
    main_py = _read("backend/main.py")

    _require(
        "def replace_templates(" in persistence,
        "Postgres workflow write repository must replace workflow templates.",
    )
    _require(
        "ON CONFLICT (id) DO UPDATE" in persistence
        and "WHERE workflow_templates.tenant_id = EXCLUDED.tenant_id" in persistence,
        "Postgres workflow template upsert must preserve tenant ownership.",
    )
    _require(
        "class WorkflowTemplateRepositoryProtocol" in repositories,
        "Workflow template service must depend on a repository protocol.",
    )
    _require(
        "class PostgresWorkflowTemplateReadThroughRepository" in repositories,
        "Workflow template repository must have a PostgreSQL read-through adapter.",
    )
    _require(
        "def build_workflow_template_repository(" in composition,
        "Composition must select a configured workflow template repository.",
    )
    _require(
        "build_workflow_template_repository(" in main_py,
        "main.py must route workflow template storage through composition.",
    )
    _require(
        "workflow_template_repository = WorkflowTemplateRepository(\n"
        "    PLATFORM_WORKFLOW_TEMPLATES_PATH,\n"
        ")\nworkflow_template_repository = build_workflow_template_repository("
        in main_py,
        "main.py must keep JSON workflow templates as fallback, not production wiring.",
    )

    print("phase2 postgres workflow template repository wiring ok")


if __name__ == "__main__":
    main()
