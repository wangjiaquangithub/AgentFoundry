#!/usr/bin/env python3
"""Check PostgreSQL repository transaction and tenant-read contracts.

This is a static, PostgreSQL-first gate. It does not open a database; it
protects the repository boundary from accidental write calls outside
PostgresDatabase.transaction() and tenant-scoped reads without tenant filters.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PERSISTENCE_DIR = ROOT / "backend" / "persistence"

POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES = {
    "agents.py": {
        "PostgresAgentCatalogReadRepository",
        "PostgresAgentCatalogWriteRepository",
    },
    "approvals.py": {
        "PostgresApprovalReadRepository",
        "PostgresApprovalWriteRepository",
    },
    "audit_events.py": {
        "PostgresAuditEventReadRepository",
        "PostgresAuditEventWriteRepository",
    },
    "documents.py": {
        "PostgresDocumentReadRepository",
        "PostgresDocumentWriteRepository",
    },
    "document_chunks.py": {
        "PostgresDocumentChunkReadRepository",
        "PostgresDocumentChunkWriteRepository",
    },
    "embedding_records.py": {
        "PostgresEmbeddingRecordReadRepository",
        "PostgresEmbeddingRecordWriteRepository",
    },
    "knowledge_bases.py": {
        "PostgresKnowledgeBaseReadRepository",
        "PostgresKnowledgeBaseWriteRepository",
    },
    "memory_items.py": {
        "PostgresMemoryItemReadRepository",
        "PostgresMemoryItemWriteRepository",
    },
    "memory_policies.py": {"PostgresMemoryPolicyReadRepository"},
    "model_configs.py": {
        "PostgresModelConfigReadRepository",
        "PostgresModelConfigWriteRepository",
    },
    "retrieval_events.py": {
        "PostgresRetrievalEventReadRepository",
        "PostgresRetrievalEventWriteRepository",
    },
    "runtime_records.py": {
        "PostgresRuntimeReadRepository",
        "PostgresRuntimeWriteRepository",
    },
    "runs.py": {
        "PostgresAgentRunReadRepository",
        "PostgresAgentRunWriteRepository",
    },
    "tenancy.py": {
        "PostgresTenancyReadRepository",
        "PostgresTenancyWriteRepository",
    },
    "tool_calls.py": {
        "PostgresToolCallReadRepository",
        "PostgresToolCallWriteRepository",
    },
    "tools.py": {
        "PostgresToolGovernanceReadRepository",
        "PostgresToolGovernanceWriteRepository",
    },
    "workflows.py": {
        "PostgresWorkflowReadRepository",
        "PostgresWorkflowWriteRepository",
    },
}

POSTGRES_TENANT_SCOPED_READ_CLASS_EXEMPTIONS = {
    "tenancy.py": {"PostgresTenancyReadRepository"},
}
POSTGRES_TENANT_SCOPED_READ_METHOD_EXEMPTIONS = {
    "runtime_records.py": {
        "PostgresRuntimeReadRepository": {"get_provider", "list_providers"},
    },
    "tools.py": {
        "PostgresToolGovernanceReadRepository": {"load_policy_snapshot"},
    },
}


def _parse_module(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _public_methods(class_node: ast.ClassDef) -> list[ast.FunctionDef | ast.AsyncFunctionDef]:
    return [
        node
        for node in class_node.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and not node.name.startswith("_")
    ]


def _method_uses_database_call(node: ast.AST, call_name: str) -> bool:
    for child in ast.walk(node):
        if not isinstance(child, ast.Call):
            continue
        function = child.func
        if not isinstance(function, ast.Attribute) or function.attr != call_name:
            continue
        receiver = function.value
        if not isinstance(receiver, ast.Attribute) or receiver.attr != "_database":
            continue
        owner = receiver.value
        if isinstance(owner, ast.Name) and owner.id == "self":
            return True
    return False


def _method_uses_database(node: ast.AST) -> bool:
    for child in ast.walk(node):
        if not isinstance(child, ast.Attribute) or child.attr != "_database":
            continue
        owner = child.value
        if isinstance(owner, ast.Name) and owner.id == "self":
            return True
    return False


def _method_has_required_argument(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
    argument_name: str,
) -> bool:
    positional_defaults = [None] * (len(node.args.args) - len(node.args.defaults)) + list(
        node.args.defaults,
    )
    for argument, default in zip(node.args.args, positional_defaults):
        if argument.arg == argument_name:
            return default is None

    for argument, default in zip(node.args.kwonlyargs, node.args.kw_defaults):
        if argument.arg == argument_name:
            return default is None

    return False


def _normalized_sql_literals(tree: ast.AST) -> list[str]:
    literals = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]
    return [" ".join(literal.split()).lower() for literal in literals]


def _is_exempt_postgres_read_method(filename: str, class_name: str, method_name: str) -> bool:
    if class_name in POSTGRES_TENANT_SCOPED_READ_CLASS_EXEMPTIONS.get(filename, set()):
        return True
    method_exemptions = POSTGRES_TENANT_SCOPED_READ_METHOD_EXEMPTIONS.get(filename, {})
    return method_name in method_exemptions.get(class_name, set())


def _collect_repository_classes(path: Path) -> dict[str, ast.ClassDef]:
    tree = _parse_module(path)
    return {
        node.name: node
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef) and node.name.startswith("Postgres")
    }


def _check_repository_inventory() -> list[str]:
    errors: list[str] = []
    for filename, expected_classes in sorted(POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.items()):
        path = PERSISTENCE_DIR / filename
        if not path.exists():
            errors.append(f"missing PostgreSQL persistence module: backend/persistence/{filename}")
            continue

        classes = _collect_repository_classes(path)
        for class_name in sorted(expected_classes - set(classes)):
            errors.append(
                "missing PostgreSQL persistence repository: "
                f"backend/persistence/{filename}:{class_name}",
            )
    return errors


def _check_write_transaction_contract() -> list[str]:
    errors: list[str] = []

    for filename, expected_classes in sorted(POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.items()):
        classes = _collect_repository_classes(PERSISTENCE_DIR / filename)
        for class_name in sorted(expected_classes):
            if "Write" not in class_name:
                continue
            class_node = classes.get(class_name)
            if class_node is None:
                continue

            for method_node in _public_methods(class_node):
                label = f"backend/persistence/{filename}:{class_name}.{method_node.name}"
                if _method_uses_database_call(method_node, "connect"):
                    errors.append(
                        "PostgreSQL write repository must use transaction(), not connect(): "
                        f"{label}",
                    )
                    continue

                if _method_uses_database(method_node) and not _method_uses_database_call(
                    method_node,
                    "transaction",
                ):
                    errors.append(
                        "PostgreSQL write repository touches the database without transaction(): "
                        f"{label}",
                    )

    return errors


def _check_read_tenant_contract() -> list[str]:
    errors: list[str] = []

    for filename, expected_classes in sorted(POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.items()):
        classes = _collect_repository_classes(PERSISTENCE_DIR / filename)
        for class_name in sorted(expected_classes):
            if "Read" not in class_name:
                continue
            class_node = classes.get(class_name)
            if class_node is None:
                continue

            for method_node in _public_methods(class_node):
                if not _method_uses_database_call(method_node, "connect"):
                    continue
                if _is_exempt_postgres_read_method(filename, class_name, method_node.name):
                    continue

                label = f"backend/persistence/{filename}:{class_name}.{method_node.name}"
                if not _method_has_required_argument(method_node, "tenant_id"):
                    errors.append(
                        "PostgreSQL tenant-scoped read must require tenant_id: "
                        f"{label}",
                    )

                sql_literals = _normalized_sql_literals(method_node)
                if not any("tenant_id = %s" in literal for literal in sql_literals):
                    errors.append(
                        "PostgreSQL tenant-scoped read SQL must filter by tenant_id: "
                        f"{label}",
                    )

    return errors


def main() -> int:
    errors = [
        *_check_repository_inventory(),
        *_check_write_transaction_contract(),
        *_check_read_tenant_contract(),
    ]

    repository_count = sum(
        len(class_names)
        for class_names in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.values()
    )
    write_repository_count = sum(
        1
        for class_names in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.values()
        for class_name in class_names
        if "Write" in class_name
    )
    read_repository_count = sum(
        1
        for class_names in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.values()
        for class_name in class_names
        if "Read" in class_name
    )

    print("Phase 2 PostgreSQL repository transaction contract")
    print(f"- PostgreSQL repositories inventoried: {repository_count}")
    print(f"- PostgreSQL write repositories guarded: {write_repository_count}")
    print(f"- PostgreSQL read repositories guarded: {read_repository_count}")

    if errors:
        print("\nErrors:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("\nOK: PostgreSQL repository transaction and tenant-read contracts are guarded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
