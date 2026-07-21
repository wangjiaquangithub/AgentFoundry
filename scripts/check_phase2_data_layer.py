#!/usr/bin/env python3
"""Check Phase 2 production data-layer coverage.

The check is intentionally static: it verifies that PostgreSQL migrations and
repository modules cover the Phase 2 core model without opening a database.
"""

from __future__ import annotations

import ast
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "backend" / "persistence" / "migrations"
PERSISTENCE_DIR = ROOT / "backend" / "persistence"
REPOSITORIES_DIR = ROOT / "backend" / "repositories"
MAIN_MODULE = ROOT / "backend" / "main.py"
DATABASE_MODULE = ROOT / "backend" / "persistence" / "database.py"

REQUIRED_TABLES = {
    "tenants",
    "users",
    "memberships",
    "agents",
    "agent_versions",
    "agent_runs",
    "runtime_providers",
    "runtime_invocations",
    "tools",
    "tool_policies",
    "tool_user_policies",
    "tool_calls",
    "approvals",
    "knowledge_bases",
    "documents",
    "document_chunks",
    "embedding_records",
    "retrieval_events",
    "memory_policies",
    "memory_items",
    "workflow_templates",
    "workflow_runs",
    "model_configs",
    "audit_events",
}

REQUIRED_REPOSITORIES = {
    "tenancy.py",
    "agents.py",
    "runs.py",
    "runtime_records.py",
    "tools.py",
    "tool_calls.py",
    "approvals.py",
    "knowledge_bases.py",
    "documents.py",
    "document_chunks.py",
    "embedding_records.py",
    "retrieval_events.py",
    "memory_policies.py",
    "memory_items.py",
    "workflows.py",
    "model_configs.py",
    "audit_events.py",
}

TARGET_COLUMN_WARNINGS: dict[str, set[str]] = {}

POSTGRES_AUTHORITATIVE_REPOSITORIES = {
    "agents.py": {"PostgresAgentCatalogWriteThroughRepository"},
    "agent_runs.py": {"PostgresAgentRunReadThroughRepository"},
    "approvals.py": {"PostgresApprovalReadThroughRepository"},
    "members.py": {"PostgresMemberReadThroughRepository"},
    "tool_policy.py": {"PostgresToolPolicyWriteThroughRepository"},
    "workflows.py": {"PostgresWorkflowRunReadThroughRepository"},
}

POSTGRES_SCHEME_LITERALS = {"postgres", "postgresql"}


def _read_migrations() -> str:
    sql_parts: list[str] = []
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        sql_parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(sql_parts)


def _extract_columns(create_body: str) -> set[str]:
    columns: set[str] = set()
    for raw_line in create_body.splitlines():
        line = raw_line.strip().rstrip(",")
        if not line or line.startswith(("CONSTRAINT ", "PRIMARY ", "UNIQUE ", "FOREIGN ", "CHECK ")):
            continue
        match = re.match(r'"?([A-Za-z_][A-Za-z0-9_]*)"?\s+', line)
        if match:
            columns.add(match.group(1))
    return columns


def _extract_schema(sql: str) -> dict[str, set[str]]:
    schema: dict[str, set[str]] = {}
    create_pattern = re.compile(
        r"CREATE\s+TABLE\s+\"?([A-Za-z_][A-Za-z0-9_]*)\"?\s*\((.*?)\);",
        re.IGNORECASE | re.DOTALL,
    )
    for match in create_pattern.finditer(sql):
        table_name = match.group(1)
        schema[table_name] = _extract_columns(match.group(2))

    alter_pattern = re.compile(
        r"ALTER\s+TABLE\s+\"?([A-Za-z_][A-Za-z0-9_]*)\"?\s+ADD\s+COLUMN\s+\"?([A-Za-z_][A-Za-z0-9_]*)\"?",
        re.IGNORECASE,
    )
    for table_name, column_name in alter_pattern.findall(sql):
        schema.setdefault(table_name, set()).add(column_name)

    return schema


def _check_required_tables(schema: dict[str, set[str]]) -> list[str]:
    missing = sorted(REQUIRED_TABLES - set(schema))
    return [f"missing migration table: {table}" for table in missing]


def _check_required_repositories() -> list[str]:
    existing = {path.name for path in PERSISTENCE_DIR.glob("*.py")}
    missing = sorted(REQUIRED_REPOSITORIES - existing)
    return [f"missing persistence repository module: backend/persistence/{name}" for name in missing]


def _collect_warnings(schema: dict[str, set[str]]) -> list[str]:
    warnings: list[str] = []
    for table_name, target_columns in sorted(TARGET_COLUMN_WARNINGS.items()):
        existing_columns = schema.get(table_name, set())
        missing_columns = sorted(target_columns - existing_columns)
        for column_name in missing_columns:
            warnings.append(f"target model drift: {table_name}.{column_name} is not in migrations")
    return warnings


def _uses_fallback_repository(node: ast.AST) -> bool:
    for child in ast.walk(node):
        if isinstance(child, ast.Attribute) and child.attr == "_fallback_repository":
            value = child.value
            if isinstance(value, ast.Name) and value.id == "self":
                return True
    return False


def _check_authoritative_postgres_repositories() -> list[str]:
    errors: list[str] = []
    for filename, class_names in sorted(POSTGRES_AUTHORITATIVE_REPOSITORIES.items()):
        path = REPOSITORIES_DIR / filename
        if not path.exists():
            errors.append(f"missing repository module: backend/repositories/{filename}")
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        classes = {
            node.name: node
            for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }
        for class_name in sorted(class_names):
            class_node = classes.get(class_name)
            if class_node is None:
                errors.append(
                    "missing authoritative PostgreSQL repository class: "
                    f"backend/repositories/{filename}:{class_name}",
                )
                continue

            for item in class_node.body:
                if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                if item.name == "__init__":
                    continue
                if _uses_fallback_repository(item):
                    errors.append(
                        "PostgreSQL repository uses local fallback in production path: "
                        f"backend/repositories/{filename}:{class_name}.{item.name}",
                    )

    return errors


def _module_defines_function(tree: ast.AST, function_name: str) -> bool:
    return any(
        isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name
        for node in ast.iter_child_nodes(tree)
    )


def _module_imports_name(tree: ast.AST, imported_name: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == imported_name or alias.asname == imported_name:
                    return True
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == imported_name or alias.asname == imported_name:
                    return True
    return False


def _module_uses_name(tree: ast.AST, name: str) -> bool:
    return any(isinstance(node, ast.Name) and node.id == name for node in ast.walk(tree))


def _string_literals(tree: ast.AST) -> list[str]:
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]


def _check_postgres_url_detection_boundary() -> list[str]:
    errors: list[str] = []

    database_tree = ast.parse(DATABASE_MODULE.read_text(encoding="utf-8"), filename=str(DATABASE_MODULE))
    main_tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))

    if not _module_defines_function(database_tree, "is_postgres_database_url"):
        errors.append(
            "missing centralized PostgreSQL URL helper: "
            "backend/persistence/database.py:is_postgres_database_url",
        )

    if _module_imports_name(main_tree, "urlparse"):
        errors.append("backend/main.py must not parse database URL schemes directly; use is_postgres_database_url")

    if not _module_uses_name(main_tree, "is_postgres_database_url"):
        errors.append("backend/main.py must use backend.persistence.is_postgres_database_url for PostgreSQL detection")

    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    database_url_occurrences = main_source.count("AGENTFOUNDRY_DATABASE_URL")
    if database_url_occurrences > 1:
        errors.append(
            "backend/main.py repeats AGENTFOUNDRY_DATABASE_URL checks; route database selection through "
            "_configured_postgres_database",
        )

    scheme_literals = sorted(POSTGRES_SCHEME_LITERALS & set(_string_literals(main_tree)))
    if scheme_literals:
        errors.append(
            "backend/main.py must not duplicate PostgreSQL scheme literals: "
            f"{', '.join(scheme_literals)}",
        )

    return errors


def main() -> int:
    sql = _read_migrations()
    schema = _extract_schema(sql)

    errors = [
        *_check_required_tables(schema),
        *_check_required_repositories(),
        *_check_authoritative_postgres_repositories(),
        *_check_postgres_url_detection_boundary(),
    ]
    warnings = _collect_warnings(schema)

    print("Phase 2 production data-layer coverage")
    print(f"- migrations scanned: {len(list(MIGRATIONS_DIR.glob('*.sql')))}")
    print(f"- required tables covered: {len(REQUIRED_TABLES) - len([e for e in errors if e.startswith('missing migration table')])}/{len(REQUIRED_TABLES)}")
    print(f"- required repositories covered: {len(REQUIRED_REPOSITORIES) - len([e for e in errors if e.startswith('missing persistence repository')])}/{len(REQUIRED_REPOSITORIES)}")
    print(f"- authoritative PostgreSQL adapters guarded: {sum(len(classes) for classes in POSTGRES_AUTHORITATIVE_REPOSITORIES.values())}")
    print("- PostgreSQL URL detection centralized: yes")

    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"- {warning}")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    sys.stdout.flush()
    postgres_gate = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_phase2_postgres_migrations.py")],
        cwd=ROOT,
        check=False,
    )
    if postgres_gate.returncode != 0:
        return postgres_gate.returncode

    print("\nOK: Phase 2 core tables and repository modules are covered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
