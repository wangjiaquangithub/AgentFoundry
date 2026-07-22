#!/usr/bin/env python3
"""Check the Phase 2 migration planning contract.

The migration plan must be deterministic and connection-free so production
operators can inspect pending PostgreSQL migrations without touching live
credentials or opening a database connection.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

MIGRATION_RUNNER = ROOT / "backend" / "persistence" / "migrations.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _function(tree: ast.AST, name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    return None


def _calls_name(node: ast.AST, name: str) -> bool:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        function = child.func
        if isinstance(function, ast.Name) and function.id == name:
            return True
        if isinstance(function, ast.Attribute) and function.attr == name:
            return True
    return False


def _check_static_contract() -> list[str]:
    errors: list[str] = []
    source = _read(MIGRATION_RUNNER)
    tree = ast.parse(source, filename=str(MIGRATION_RUNNER))

    plan_function = _function(tree, "plan_migrations")
    if plan_function is None:
        return ["migration runner must expose plan_migrations"]

    forbidden_calls = {
        "connect",
        "execute",
        "executescript",
        "open",
        "_import_psycopg",
        "_apply_postgres_migrations",
        "_apply_sqlite_migrations",
    }
    for call_name in sorted(forbidden_calls):
        if _calls_name(plan_function, call_name):
            errors.append(f"plan_migrations must be connection-free; found {call_name}()")

    if not _calls_name(plan_function, "migration_registry"):
        errors.append("plan_migrations must derive its order from migration_registry")

    for function_name in ("_apply_postgres_migrations", "_apply_sqlite_migrations"):
        function = _function(tree, function_name)
        if function is None:
            errors.append(f"missing migration apply function: {function_name}")
            continue
        if not _calls_name(function, "plan_migrations"):
            errors.append(f"{function_name} must use plan_migrations")

    return errors


def _check_runtime_contract() -> list[str]:
    from backend.persistence.migrations import migration_registry, plan_migrations

    migrations = migration_registry()
    if not migrations:
        return ["migration registry is empty"]

    errors: list[str] = []
    planned_from_empty = plan_migrations(set())
    if planned_from_empty != migrations:
        errors.append("empty completed set must plan all registered migrations in order")

    first_completed = {migrations[0].version}
    planned_after_first = plan_migrations(first_completed)
    if planned_after_first != migrations[1:]:
        errors.append("completed versions must be excluded without reordering pending migrations")

    all_completed = {migration.version for migration in migrations}
    if plan_migrations(all_completed):
        errors.append("fully completed registry must produce an empty migration plan")

    return errors


def main() -> int:
    errors = [*_check_static_contract(), *_check_runtime_contract()]

    print("Phase 2 PostgreSQL migration planning gate")
    print("- migration plan: deterministic")
    print("- planning boundary: no database connection")
    print("- production target: PostgreSQL")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: migration planning is deterministic and connection-free.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
