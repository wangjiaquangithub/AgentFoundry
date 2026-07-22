#!/usr/bin/env python3
"""Check agent runtime disables dev knowledge fallback in production."""

from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AGENT_RUNTIME = ROOT / "backend" / "api" / "agent_runtime.py"


def _fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def _calls_name(node: ast.AST, name: str) -> bool:
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name


def _is_not_production_env(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.UnaryOp)
        and isinstance(node.op, ast.Not)
        and _calls_name(node.operand, "is_production_environment")
        and len(node.operand.args) == 1
        and isinstance(node.operand.args[0], ast.Attribute)
        and node.operand.args[0].attr == "env"
        and isinstance(node.operand.args[0].value, ast.Name)
        and node.operand.args[0].value.id == "deps"
    )


def main() -> int:
    source = AGENT_RUNTIME.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(AGENT_RUNTIME))

    imports_production_guard = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "persistence.database"
        and any(alias.name == "is_production_environment" for alias in node.names)
        for node in tree.body
    )
    if not imports_production_guard:
        _fail("agent runtime must import is_production_environment")

    guarded_fallback = False
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        for keyword in node.keywords:
            if keyword.arg != "allow_dev_knowledge_fallback":
                continue
            if _is_not_production_env(keyword.value):
                guarded_fallback = True
            else:
                _fail(
                    "allow_dev_knowledge_fallback must be "
                    "not is_production_environment(deps.env)"
                )

    if not guarded_fallback:
        _fail("agent runtime must pass allow_dev_knowledge_fallback explicitly")

    print("OK: agent runtime disables dev knowledge fallback in production")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
