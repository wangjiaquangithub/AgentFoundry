#!/usr/bin/env python3
"""Check the Phase 2 PostgreSQL seed completeness contract.

This gate is static and connection-free. It verifies that development seed
inputs hydrate the PostgreSQL production schema through the same explicit
database boundary, while keeping SQLite as local compatibility only.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEED_MODULE = ROOT / "backend" / "persistence" / "seed.py"
DATA_MODEL = ROOT / "docs" / "data-model.md"
MIGRATIONS_DIR = ROOT / "backend" / "persistence" / "migrations"

REQUIRED_SUMMARY_FIELDS = {
    "tenants",
    "users",
    "memberships",
    "tools",
    "tool_policies",
    "memory_policies",
    "runtime_providers",
    "agents",
    "agent_versions",
    "updated_agent_versions",
    "warnings",
}

REQUIRED_POSTGRES_UPSERTS = {
    "upsert_tenants": {"tenants"},
    "upsert_users": {"users"},
    "upsert_memberships": {"memberships"},
    "upsert_memory_policies": {"memory_policies"},
    "upsert_runtime_providers": {"runtime_providers"},
    "upsert_tools_and_policies": {"tools", "tool_policies"},
    "upsert_agents": {
        "agents",
        "agent_versions",
        "updated_agent_versions",
        "warnings",
    },
}

REQUIRED_SEEDED_TABLES = {
    "tenants",
    "users",
    "memberships",
    "tools",
    "tool_policies",
    "memory_policies",
    "runtime_providers",
    "agents",
    "agent_versions",
}

SQL_INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _function(tree: ast.AST, name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    return None


def _class(tree: ast.AST, name: str) -> ast.ClassDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == name:
            return node
    return None


def _call_name(call: ast.Call) -> str | None:
    function = call.func
    if isinstance(function, ast.Name):
        return function.id
    if isinstance(function, ast.Attribute):
        return function.attr
    return None


def _calls_name(node: ast.AST, name: str) -> bool:
    return any(
        isinstance(child, ast.Call) and _call_name(child) == name
        for child in ast.walk(node)
    )


def _first_call_line(node: ast.AST, name: str) -> int | None:
    lines = [
        child.lineno
        for child in ast.walk(node)
        if isinstance(child, ast.Call) and _call_name(child) == name
    ]
    return min(lines) if lines else None


def _summary_attribute_names(target: ast.AST) -> set[str]:
    if isinstance(target, ast.Attribute):
        if isinstance(target.value, ast.Name) and target.value.id == "summary":
            return {target.attr}
        return set()
    if isinstance(target, ast.Tuple):
        fields: set[str] = set()
        for element in target.elts:
            fields.update(_summary_attribute_names(element))
        return fields
    return set()


def _assigned_summary_fields_from_call(
    function: ast.FunctionDef,
    call_name: str,
) -> set[str]:
    fields: set[str] = set()
    for node in ast.walk(function):
        if not isinstance(node, ast.Assign):
            continue
        if not isinstance(node.value, ast.Call) or _call_name(node.value) != call_name:
            continue
        for target in node.targets:
            fields.update(_summary_attribute_names(target))
    return fields


def _call_keyword_constant(call: ast.Call, keyword_name: str) -> object | None:
    for keyword in call.keywords:
        if keyword.arg == keyword_name and isinstance(keyword.value, ast.Constant):
            return keyword.value.value
    return None


def _calls_with_parameter_marker(
    function: ast.FunctionDef,
    call_name: str,
    marker: str,
) -> bool:
    for node in ast.walk(function):
        if not isinstance(node, ast.Call) or _call_name(node) != call_name:
            continue
        if _call_keyword_constant(node, "parameter_marker") == marker:
            return True
    return False


def _seed_summary_fields(tree: ast.AST) -> set[str]:
    seed_summary = _class(tree, "SeedSummary")
    if seed_summary is None:
        return set()
    fields: set[str] = set()
    for node in seed_summary.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            fields.add(node.target.id)
    return fields


def _inserted_tables(function: ast.FunctionDef) -> set[str]:
    tables: set[str] = set()
    for node in ast.walk(function):
        if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
            continue
        tables.update(table.lower() for table in SQL_INSERT_RE.findall(node.value))
    return tables


def _migration_tables() -> set[str]:
    tables: set[str] = set()
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        sql = _read(path)
        tables.update(
            table.lower()
            for table in re.findall(
                r"CREATE\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)",
                sql,
                flags=re.IGNORECASE,
            )
        )
    return tables


def _check_seed_module() -> list[str]:
    errors: list[str] = []
    source = _read(SEED_MODULE)
    tree = ast.parse(source, filename=str(SEED_MODULE))
    postgres_seed = _function(tree, "seed_postgres_development_data")

    summary_fields = _seed_summary_fields(tree)
    missing_summary_fields = REQUIRED_SUMMARY_FIELDS - summary_fields
    if missing_summary_fields:
        errors.append(
            "SeedSummary is missing fields: "
            + ", ".join(sorted(missing_summary_fields))
        )

    if postgres_seed is None:
        return [*errors, "missing seed_postgres_development_data"]

    apply_line = _first_call_line(postgres_seed, "apply_migrations")
    load_line = _first_call_line(postgres_seed, "_load_seed_inputs")
    transaction_line = _first_call_line(postgres_seed, "transaction")

    if apply_line is None:
        errors.append("PostgreSQL seed must call apply_migrations")
    if load_line is None:
        errors.append("PostgreSQL seed must load development seed inputs")
    if apply_line is not None and load_line is not None and apply_line >= load_line:
        errors.append("PostgreSQL seed must apply migrations before loading seed inputs")
    if not _calls_name(postgres_seed, "create_postgres_database"):
        errors.append("PostgreSQL seed must use create_postgres_database")
    if transaction_line is None:
        errors.append("PostgreSQL seed must run upserts inside database.transaction()")

    for upsert_name, expected_fields in REQUIRED_POSTGRES_UPSERTS.items():
        if not _calls_with_parameter_marker(postgres_seed, upsert_name, "%s"):
            errors.append(f"{upsert_name} must be called with parameter_marker='%s'")
        assigned_fields = _assigned_summary_fields_from_call(postgres_seed, upsert_name)
        missing_fields = expected_fields - assigned_fields
        if missing_fields:
            errors.append(
                f"{upsert_name} must update summary fields: "
                + ", ".join(sorted(missing_fields))
            )

    inserted_tables: set[str] = set()
    for upsert_name in REQUIRED_POSTGRES_UPSERTS:
        upsert = _function(tree, upsert_name)
        if upsert is None:
            errors.append(f"missing seed upsert function: {upsert_name}")
            continue
        inserted_tables.update(_inserted_tables(upsert))
    missing_seeded_tables = REQUIRED_SEEDED_TABLES - inserted_tables
    if missing_seeded_tables:
        errors.append(
            "seed upserts are missing inserts for tables: "
            + ", ".join(sorted(missing_seeded_tables))
        )

    if "SQLite remains available only as" not in source:
        errors.append("seed module must label SQLite as local compatibility only")
    if "PostgreSQL is the production database target" not in source:
        errors.append("seed module must label PostgreSQL as the production target")

    return errors


def _check_docs_and_schema() -> list[str]:
    errors: list[str] = []
    data_model = _read(DATA_MODEL)
    migration_tables = _migration_tables()

    missing_schema_tables = REQUIRED_SEEDED_TABLES - migration_tables
    if missing_schema_tables:
        errors.append(
            "seeded tables are missing from migrations: "
            + ", ".join(sorted(missing_schema_tables))
        )

    missing_doc_tables = [
        table for table in sorted(REQUIRED_SEEDED_TABLES) if f"`{table}`" not in data_model
    ]
    if missing_doc_tables:
        errors.append(
            "seeded tables are missing from docs/data-model.md: "
            + ", ".join(missing_doc_tables)
        )

    for required_mapping in (
        "backend/data/platform_agents.json",
        "backend/data/platform_tool_policy.json",
        "agents",
        "agent_versions",
        "tool_policies",
    ):
        if required_mapping not in data_model:
            errors.append(f"data model must document seed input mapping: {required_mapping}")

    return errors


def main() -> int:
    errors = [*_check_seed_module(), *_check_docs_and_schema()]

    print("Phase 2 PostgreSQL seed completeness gate")
    print("- seed target: PostgreSQL-first")
    print("- coverage: tenants, users, memberships, tools, policies, runtime, agents")
    print("- boundary: static AST and schema/doc contract only")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL seed completeness contract is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
