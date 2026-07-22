#!/usr/bin/env python3
"""Check Phase 6 audit event immutability at the PostgreSQL boundary."""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT_EVENTS = ROOT / "backend" / "persistence" / "audit_events.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def _class_node(tree: ast.Module, class_name: str) -> ast.ClassDef | None:
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return node
    return None


def _method_node(
    class_node: ast.ClassDef,
    method_name: str,
) -> ast.FunctionDef | ast.AsyncFunctionDef | None:
    for node in class_node.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == method_name:
            return node
    return None


def _normalized_sql_literals(node: ast.AST) -> list[str]:
    return [
        " ".join(child.value.split()).lower()
        for child in ast.walk(node)
        if isinstance(child, ast.Constant) and isinstance(child.value, str)
    ]


def _method_source(tree: ast.Module, method: ast.AST) -> str:
    source = AUDIT_EVENTS.read_text(encoding="utf-8")
    segment = ast.get_source_segment(source, method)
    if segment is None:
        raise ValueError("could not read append_audit_event source segment")
    return segment


def check_audit_event_repository() -> list[str]:
    errors: list[str] = []
    tree = ast.parse(AUDIT_EVENTS.read_text(encoding="utf-8"), filename=str(AUDIT_EVENTS))
    repository = _class_node(tree, "PostgresAuditEventWriteRepository")
    if repository is None:
        return ["missing PostgresAuditEventWriteRepository"]

    method = _method_node(repository, "append_audit_event")
    if method is None:
        return ["missing PostgresAuditEventWriteRepository.append_audit_event"]

    sql_literals = _normalized_sql_literals(method)
    method_source = _method_source(tree, method)

    if not any("on conflict (id) do nothing" in literal for literal in sql_literals):
        errors.append("audit event append must use ON CONFLICT (id) DO NOTHING")
    if any("on conflict (id) do update" in literal for literal in sql_literals):
        errors.append("audit event append must not update existing audit events")
    if "WHERE id = %s" not in method_source:
        errors.append("audit event append must read the existing event after an id conflict")
    if "_validate_write_result(record, persisted)" not in method_source:
        errors.append("audit event append must validate persisted rows against the requested event")
    if "PostgreSQL audit event append did not return a row." not in method_source:
        errors.append("audit event append must fail if neither insert nor conflict read returns a row")

    return errors


def check_phase6_gate_wires_check() -> list[str]:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_audit_event_immutability.py" not in source:
        return ["Phase 6 backend gate must run check_phase6_audit_event_immutability.py"]
    return []


def main() -> int:
    errors = []
    errors.extend(check_audit_event_repository())
    errors.extend(check_phase6_gate_wires_check())
    if errors:
        for error in errors:
            print(f"[phase6-audit-event-immutability] {error}", file=sys.stderr)
        return 1

    print("[phase6-audit-event-immutability] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
