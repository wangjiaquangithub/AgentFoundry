#!/usr/bin/env python3
"""Check the Phase 2 PostgreSQL index coverage contract.

This gate is static and connection-free. It keeps migrations aligned with the
production data model by requiring tenant-scoped indexes for the platform's
core list, lookup, trace, and audit query paths.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "backend" / "persistence" / "migrations"
DATA_MODEL = ROOT / "docs" / "data-model.md"


@dataclass(frozen=True)
class RequiredIndex:
    table: str
    columns: tuple[str, ...]
    reason: str


REQUIRED_INDEXES: tuple[RequiredIndex, ...] = (
    RequiredIndex("memberships", ("tenant_id", "user_id"), "membership lookup"),
    RequiredIndex(
        "model_configs",
        ("tenant_id", "purpose", "status"),
        "model config selection by tenant, purpose, and status",
    ),
    RequiredIndex(
        "memory_policies",
        ("tenant_id", "scope", "write_mode"),
        "memory policy resolution",
    ),
    RequiredIndex(
        "agents",
        ("tenant_id", "status", "updated_at"),
        "agent catalog list by status and recency",
    ),
    RequiredIndex(
        "agent_runs",
        ("tenant_id", "created_at"),
        "run history timeline",
    ),
    RequiredIndex(
        "runtime_invocations",
        ("tenant_id", "provider_id", "created_at"),
        "runtime provider trace queries",
    ),
    RequiredIndex(
        "runtime_invocations",
        ("tenant_id", "agent_run_id", "created_at"),
        "runtime trace lookup from agent run",
    ),
    RequiredIndex(
        "tool_calls",
        ("tenant_id", "agent_run_id", "created_at"),
        "tool call evidence by run",
    ),
    RequiredIndex(
        "approvals",
        ("tenant_id", "status", "created_at"),
        "approval queue by status",
    ),
    RequiredIndex(
        "approvals",
        ("tenant_id", "target_type", "target_id", "created_at"),
        "approval lookup by governed target",
    ),
    RequiredIndex(
        "knowledge_bases",
        ("tenant_id", "status"),
        "knowledge base list by status",
    ),
    RequiredIndex(
        "documents",
        ("tenant_id", "knowledge_base_id"),
        "document lookup by knowledge base",
    ),
    RequiredIndex(
        "documents",
        ("tenant_id", "knowledge_base_id", "status", "created_at"),
        "document ingestion queue by status and recency",
    ),
    RequiredIndex(
        "document_chunks",
        ("tenant_id", "document_id"),
        "chunk lookup by document",
    ),
    RequiredIndex(
        "embedding_records",
        ("tenant_id", "created_at"),
        "embedding record timeline",
    ),
    RequiredIndex(
        "retrieval_events",
        ("tenant_id", "agent_run_id"),
        "retrieval evidence by run",
    ),
    RequiredIndex(
        "retrieval_events",
        ("tenant_id", "knowledge_base_id", "created_at"),
        "retrieval log by knowledge base",
    ),
    RequiredIndex(
        "memory_items",
        ("tenant_id", "user_id", "agent_id"),
        "memory scope lookup",
    ),
    RequiredIndex(
        "memory_items",
        ("tenant_id", "session_id", "created_at"),
        "session memory timeline",
    ),
    RequiredIndex(
        "memory_items",
        ("tenant_id", "source_run_id", "created_at"),
        "memory writes traced to a run",
    ),
    RequiredIndex(
        "workflow_templates",
        ("tenant_id", "status", "updated_at"),
        "workflow template list by status and recency",
    ),
    RequiredIndex(
        "workflow_runs",
        ("tenant_id", "workflow_template_id"),
        "workflow run lookup by template",
    ),
    RequiredIndex(
        "workflow_runs",
        ("tenant_id", "workflow_template_id", "created_at"),
        "workflow run timeline by template",
    ),
    RequiredIndex(
        "workflow_runs",
        ("tenant_id", "status", "created_at"),
        "workflow run queue by status",
    ),
    RequiredIndex(
        "workflow_runs",
        ("tenant_id", "user_id", "created_at"),
        "workflow run history by user",
    ),
    RequiredIndex(
        "workflow_runs",
        ("tenant_id", "triggered_by", "created_at"),
        "workflow run history by trigger actor",
    ),
    RequiredIndex("audit_events", ("tenant_id", "created_at"), "audit timeline"),
    RequiredIndex(
        "audit_events",
        ("tenant_id", "actor_user_id", "created_at"),
        "audit query by actor",
    ),
    RequiredIndex(
        "audit_events",
        ("tenant_id", "event_type", "created_at"),
        "audit query by event type",
    ),
    RequiredIndex(
        "audit_events",
        ("tenant_id", "target_type", "target_id", "created_at"),
        "legacy audit target lookup",
    ),
    RequiredIndex(
        "audit_events",
        ("tenant_id", "resource_type", "resource_id", "created_at"),
        "audit resource lookup",
    ),
    RequiredIndex(
        "tool_user_policies",
        ("tenant_id",),
        "per-user tool policy lookup by tenant",
    ),
)


CREATE_INDEX_RE = re.compile(
    r"""
    CREATE\s+(?:UNIQUE\s+)?INDEX\s+
    (?P<name>[a-zA-Z_][a-zA-Z0-9_]*)\s+
    ON\s+
    (?P<table>[a-zA-Z_][a-zA-Z0-9_]*)\s*
    \((?P<columns>[^;]+?)\)
    \s*;
    """,
    re.IGNORECASE | re.VERBOSE | re.DOTALL,
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def _strip_sql_comments(sql: str) -> str:
    without_block_comments = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", "", without_block_comments)


def _normalize_identifier(identifier: str) -> str:
    return identifier.strip().strip('"').lower()


def _normalize_column(column: str) -> str:
    column = column.strip()
    column = re.sub(
        r"\s+(ASC|DESC|NULLS\s+FIRST|NULLS\s+LAST)\b",
        "",
        column,
        flags=re.IGNORECASE,
    )
    return _normalize_identifier(column)


def _parse_indexes(sql: str) -> dict[str, list[tuple[str, tuple[str, ...]]]]:
    indexes: dict[str, list[tuple[str, tuple[str, ...]]]] = {}
    for match in CREATE_INDEX_RE.finditer(_strip_sql_comments(sql)):
        name = _normalize_identifier(match.group("name"))
        table = _normalize_identifier(match.group("table"))
        columns = tuple(
            _normalize_column(column)
            for column in match.group("columns").split(",")
            if column.strip()
        )
        indexes.setdefault(table, []).append((name, columns))
    return indexes


def _all_migration_sql() -> str:
    return "\n\n".join(_read(path) for path in _migration_files())


def _has_index_prefix(
    indexes: dict[str, list[tuple[str, tuple[str, ...]]]],
    table: str,
    columns: tuple[str, ...],
) -> bool:
    expected = tuple(_normalize_identifier(column) for column in columns)
    return any(
        index_columns[: len(expected)] == expected
        for _, index_columns in indexes.get(table, [])
    )


def _check_required_indexes(
    indexes: dict[str, list[tuple[str, tuple[str, ...]]]],
) -> list[str]:
    errors: list[str] = []
    for required in REQUIRED_INDEXES:
        if _has_index_prefix(indexes, required.table, required.columns):
            continue
        column_list = ", ".join(required.columns)
        errors.append(
            f"missing index on {required.table}({column_list}) for {required.reason}"
        )
    return errors


def _check_tenant_first_indexes(
    indexes: dict[str, list[tuple[str, tuple[str, ...]]]],
) -> list[str]:
    errors: list[str] = []
    tenant_scoped_tables = {required.table for required in REQUIRED_INDEXES}
    for table in sorted(tenant_scoped_tables):
        for name, columns in indexes.get(table, []):
            if not columns or columns[0] != "tenant_id":
                errors.append(
                    f"{name} on {table} must keep tenant_id as the leading column"
                )
    return errors


def _check_data_model_contract() -> list[str]:
    errors: list[str] = []
    data_model = _read(DATA_MODEL)
    for required in REQUIRED_INDEXES:
        if f"`{required.table}`" not in data_model:
            errors.append(f"data model does not document table: {required.table}")
    return errors


def main() -> int:
    migration_files = _migration_files()
    indexes = _parse_indexes(_all_migration_sql())
    index_count = sum(len(table_indexes) for table_indexes in indexes.values())
    errors = [
        *_check_required_indexes(indexes),
        *_check_tenant_first_indexes(indexes),
        *_check_data_model_contract(),
    ]

    print("Phase 2 PostgreSQL index coverage gate")
    print(f"- migrations scanned: {len(migration_files)}")
    print(f"- indexes scanned: {index_count}")
    print(f"- required query-path indexes: {len(REQUIRED_INDEXES)}")
    print("- tenant-scoped index rule: tenant_id first")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL migrations cover the Phase 2 index contract.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
