#!/usr/bin/env python3
"""Check the PostgreSQL seed migration-toggle contract.

The seed path must stay PostgreSQL-first while still allowing explicit SQLite
local compatibility. This check is static: it does not open a database or load
fixture data.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEED_MODULE = ROOT / "backend" / "persistence" / "seed.py"
SEED_SHELL = ROOT / "scripts" / "seed_agentfoundry.sh"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _function(tree: ast.AST, name: str) -> ast.FunctionDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    return None


def _has_bool_default(
    function: ast.FunctionDef,
    argument_name: str,
    expected: bool,
) -> bool:
    positional_defaults = [None] * (len(function.args.args) - len(function.args.defaults))
    positional_defaults.extend(function.args.defaults)
    for argument, default in zip(function.args.args, positional_defaults):
        if argument.arg == argument_name:
            return isinstance(default, ast.Constant) and default.value is expected

    for argument, default in zip(function.args.kwonlyargs, function.args.kw_defaults):
        if argument.arg == argument_name:
            return isinstance(default, ast.Constant) and default.value is expected

    return False


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


def _call_with_keyword(
    node: ast.AST,
    function_name: str,
    keyword_name: str,
) -> ast.Call | None:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        function = child.func
        if not isinstance(function, ast.Name) or function.id != function_name:
            continue
        if any(keyword.arg == keyword_name for keyword in child.keywords):
            return child
    return None


def _call_named(node: ast.AST, function_name: str) -> ast.Call | None:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        function = child.func
        if isinstance(function, ast.Name) and function.id == function_name:
            return child
        if isinstance(function, ast.Attribute) and function.attr == function_name:
            return child
    return None


def _keyword_is_not_args_skip_migrations(call: ast.Call) -> bool:
    for keyword in call.keywords:
        if keyword.arg != "apply_schema_migrations":
            continue
        value = keyword.value
        if not isinstance(value, ast.UnaryOp) or not isinstance(value.op, ast.Not):
            return False
        operand = value.operand
        return (
            isinstance(operand, ast.Attribute)
            and operand.attr == "skip_migrations"
            and isinstance(operand.value, ast.Name)
            and operand.value.id == "args"
        )
    return False


def _check_seed_module() -> list[str]:
    errors: list[str] = []
    source = _read(SEED_MODULE)
    tree = ast.parse(source, filename=str(SEED_MODULE))

    dispatcher = _function(tree, "seed_development_data")
    postgres_seed = _function(tree, "seed_postgres_development_data")
    sqlite_seed = _function(tree, "seed_sqlite_development_data")
    main = _function(tree, "main")

    for function_name, function in (
        ("seed_development_data", dispatcher),
        ("seed_postgres_development_data", postgres_seed),
        ("seed_sqlite_development_data", sqlite_seed),
    ):
        if function is None:
            errors.append(f"missing seed function: {function_name}")
            continue
        if not _has_bool_default(function, "apply_schema_migrations", True):
            errors.append(f"{function_name} must expose apply_schema_migrations=True")

    if dispatcher is not None:
        if not _calls_name(dispatcher, "is_postgres_database_url"):
            errors.append("seed_development_data must route by is_postgres_database_url")
        for callee in ("seed_postgres_development_data", "seed_sqlite_development_data"):
            if _call_with_keyword(dispatcher, callee, "apply_schema_migrations") is None:
                errors.append(f"seed_development_data must pass apply_schema_migrations to {callee}")

    if postgres_seed is not None:
        apply_call = _call_named(postgres_seed, "apply_migrations")
        load_call = _call_named(postgres_seed, "_load_seed_inputs")
        if apply_call is None:
            errors.append("seed_postgres_development_data must call apply_migrations")
        elif not any(
            isinstance(argument, ast.Name) and argument.id == "database_url"
            for argument in apply_call.args
        ):
            errors.append("seed_postgres_development_data must migrate the configured database_url")
        if load_call is None:
            errors.append("seed_postgres_development_data must load development seed inputs")
        elif apply_call is not None and apply_call.lineno >= load_call.lineno:
            errors.append("PostgreSQL seed migrations must run before loading fixture inputs")

    if main is None:
        errors.append("seed CLI must expose main")
    else:
        seed_call = _call_with_keyword(main, "seed_development_data", "apply_schema_migrations")
        if seed_call is None:
            errors.append("seed CLI must pass apply_schema_migrations")
        elif not _keyword_is_not_args_skip_migrations(seed_call):
            errors.append("seed CLI must map --skip-migrations to not args.skip_migrations")
        if "--skip-migrations" not in source:
            errors.append("seed CLI must expose --skip-migrations")

    return errors


def _check_seed_shell() -> list[str]:
    errors: list[str] = []
    source = _read(SEED_SHELL)
    if "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry" not in source:
        errors.append("seed shell must default AGENTFOUNDRY_DATABASE_URL to local PostgreSQL")
    if 'uv run --with "psycopg[binary]"' not in source:
        errors.append("PostgreSQL seed shell must install psycopg when uv is available")
    if "sqlite:// URLs are accepted only for" not in source:
        errors.append("seed shell must label sqlite:// as explicit local compatibility")
    if "unsupported AGENTFOUNDRY_DATABASE_URL scheme" not in source:
        errors.append("seed shell must reject unsupported database URL schemes")
    return errors


def main() -> int:
    errors = [*_check_seed_module(), *_check_seed_shell()]

    print("Phase 2 PostgreSQL seed migration-toggle gate")
    print("- seed target: PostgreSQL-first")
    print("- migration toggle: explicit --skip-migrations")
    print("- boundary: no database connection or fixture loading")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL seed migration toggle contract is explicit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
