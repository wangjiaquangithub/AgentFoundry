#!/usr/bin/env python3
"""Check that Phase 2 migrations stay PostgreSQL-first.

This gate is static on purpose. It protects production persistence contracts
without requiring a local PostgreSQL service or external credentials.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION_RUNNER = ROOT / "backend" / "persistence" / "migrations.py"
MIGRATION_SHELL = ROOT / "scripts" / "migrate_agentfoundry.sh"
MIGRATIONS_DIR = ROOT / "backend" / "persistence" / "migrations"

POSTGRES_DEFAULT = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
SQLITE_ONLY_PATTERNS = {
    "AUTOINCREMENT": "SQLite-only autoincrement syntax",
    "WITHOUT ROWID": "SQLite-only table option",
    "PRAGMA ": "SQLite runtime pragma",
    "DATETIME(": "SQLite datetime function",
    "strftime(": "SQLite strftime function",
}


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _check_runner_contract(source: str) -> list[str]:
    errors: list[str] = []
    if POSTGRES_DEFAULT not in source:
        errors.append("migration runner default database URL is not PostgreSQL")
    if "postgresql" not in source or "postgres" not in source:
        errors.append("migration runner does not recognize PostgreSQL URL schemes")
    if "TIMESTAMPTZ" not in source:
        errors.append("PostgreSQL schema_migrations table must use TIMESTAMPTZ")
    if "sqlite:// is" not in source and "sqlite:// for local development" not in source:
        errors.append("migration runner help text must label sqlite:// as local development only")

    tree = ast.parse(source, filename=str(MIGRATION_RUNNER))
    functions = {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
    }
    required_functions = {
        "_apply_postgres_migrations",
        "_apply_sqlite_migrations",
        "apply_migrations",
        "migration_registry",
    }
    for function_name in sorted(required_functions - functions):
        errors.append(f"missing migration runner function: {function_name}")

    return errors


def _check_shell_contract(source: str) -> list[str]:
    errors: list[str] = []
    if POSTGRES_DEFAULT not in source:
        errors.append("migration shell default database URL is not PostgreSQL")
    if 'uv run --with "psycopg[binary]"' not in source:
        errors.append("migration shell should install psycopg for PostgreSQL migrations when uv is available")
    if "PostgreSQL is the production target" not in source:
        errors.append("migration shell help text must say PostgreSQL is the production target")
    if "sqlite:// URLs are accepted only for" not in source:
        errors.append("migration shell help text must label sqlite:// as local development compatibility")
    return errors


def _migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def _check_migration_registry() -> list[str]:
    errors: list[str] = []
    files = _migration_files()
    if not files:
        return ["no SQL migrations found"]

    versions: list[int] = []
    for path in files:
        match = re.fullmatch(r"(\d{4})_[a-z0-9_]+\.sql", path.name)
        if match is None:
            errors.append(f"invalid migration filename: {path.name}")
            continue
        versions.append(int(match.group(1)))

    duplicate_versions = sorted(
        version for version in set(versions) if versions.count(version) > 1
    )
    for version in duplicate_versions:
        errors.append(f"duplicate migration version: {version:04d}")

    expected_versions = list(range(1, len(versions) + 1))
    if sorted(versions) != expected_versions:
        expected = ", ".join(f"{version:04d}" for version in expected_versions)
        actual = ", ".join(f"{version:04d}" for version in sorted(versions))
        errors.append(f"migration versions must be contiguous: expected {expected}; got {actual}")

    return errors


def _check_sql_portability() -> list[str]:
    errors: list[str] = []
    for path in _migration_files():
        sql = _read(path)
        upper_sql = sql.upper()
        for pattern, description in sorted(SQLITE_ONLY_PATTERNS.items()):
            if pattern.upper() in upper_sql:
                errors.append(f"{path.name} contains {description}: {pattern.strip()}")
    return errors


def main() -> int:
    errors = [
        *_check_runner_contract(_read(MIGRATION_RUNNER)),
        *_check_shell_contract(_read(MIGRATION_SHELL)),
        *_check_migration_registry(),
        *_check_sql_portability(),
    ]

    print("Phase 2 PostgreSQL migration gate")
    print(f"- migrations scanned: {len(_migration_files())}")
    print("- production default: PostgreSQL")
    print("- sqlite:// scope: local development compatibility")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: migrations and runner remain PostgreSQL-first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
