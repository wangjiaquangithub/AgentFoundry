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
PERSISTENCE_INIT_MODULE = PERSISTENCE_DIR / "__init__.py"
REPOSITORIES_DIR = ROOT / "backend" / "repositories"
SERVICES_DIR = ROOT / "backend" / "services"
MAIN_MODULE = ROOT / "backend" / "main.py"
DATABASE_MODULE = ROOT / "backend" / "persistence" / "database.py"
PLATFORM_STATUS_SERVICE_MODULE = SERVICES_DIR / "platform_status.py"

AUDIT_EVENT_WRITER_SERVICE_MODULES = {
    "agents.py": "PlatformAgentService",
    "approvals.py": "PlatformApprovalService",
    "connectors.py": "PlatformConnectorConfigService",
    "knowledge.py": "PlatformKnowledgeResponseService",
    "members.py": "PlatformMemberService",
    "memories.py": "PlatformMemoryService",
    "tools.py": "PlatformToolPolicyService",
    "workflows.py": "PlatformWorkflowTemplateService",
}

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
    "model_configs.py": {"PostgresModelConfigReadRepository"},
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

POSTGRES_SCHEME_LITERALS = {"postgres", "postgresql"}
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
POSTGRES_TENANT_SCOPED_READ_KNOWN_GAPS: dict[str, dict[str, set[str]]] = {}

POSTGRES_TENANT_SCOPED_READ_KNOWN_GAP_COUNT = sum(
    len(methods)
    for class_methods in POSTGRES_TENANT_SCOPED_READ_KNOWN_GAPS.values()
    for methods in class_methods.values()
)


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


def _method_has_required_argument(node: ast.FunctionDef | ast.AsyncFunctionDef, argument_name: str) -> bool:
    positional_arguments = node.args.args
    positional_defaults = [None] * (len(positional_arguments) - len(node.args.defaults)) + list(
        node.args.defaults,
    )
    for argument, default in zip(positional_arguments, positional_defaults):
        if argument.arg == argument_name:
            return default is None

    for argument, default in zip(node.args.kwonlyargs, node.args.kw_defaults):
        if argument.arg == argument_name:
            return default is None

    return False


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


def _check_authoritative_postgres_persistence_repositories() -> list[str]:
    errors: list[str] = []
    for filename, class_names in sorted(POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.items()):
        path = PERSISTENCE_DIR / filename
        if not path.exists():
            errors.append(f"missing persistence repository module: backend/persistence/{filename}")
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        classes = {
            node.name: node
            for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        }
        for class_name in sorted(class_names):
            if class_name not in classes:
                errors.append(
                    "missing authoritative PostgreSQL persistence class: "
                    f"backend/persistence/{filename}:{class_name}",
                )

    return errors


def _check_postgres_persistence_repository_inventory() -> list[str]:
    errors: list[str] = []
    guarded_classes = {
        (filename, class_name)
        for filename, class_names in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.items()
        for class_name in class_names
    }

    for path in sorted(PERSISTENCE_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            if not node.name.startswith("Postgres") or not node.name.endswith("Repository"):
                continue
            if (path.name, node.name) not in guarded_classes:
                errors.append(
                    "PostgreSQL persistence repository missing authoritative guard: "
                    f"backend/persistence/{path.name}:{node.name}",
                )

    return errors


def _check_postgres_persistence_exports() -> list[str]:
    errors: list[str] = []
    tree = ast.parse(PERSISTENCE_INIT_MODULE.read_text(encoding="utf-8"), filename=str(PERSISTENCE_INIT_MODULE))
    imported_names: set[str] = set()
    all_names: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            imported_names.update(alias.asname or alias.name for alias in node.names)
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if not isinstance(target, ast.Name) or target.id != "__all__":
                    continue
                if isinstance(node.value, (ast.List, ast.Tuple, ast.Set)):
                    all_names.update(
                        element.value
                        for element in node.value.elts
                        if isinstance(element, ast.Constant) and isinstance(element.value, str)
                    )

    guarded_classes = {
        class_name
        for class_names in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.values()
        for class_name in class_names
    }
    for class_name in sorted(guarded_classes):
        if class_name not in imported_names:
            errors.append(
                "authoritative PostgreSQL persistence repository is not imported by "
                f"backend/persistence/__init__.py:{class_name}",
            )
        if class_name not in all_names:
            errors.append(
                "authoritative PostgreSQL persistence repository is not exported by "
                f"backend/persistence/__init__.py:{class_name}",
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


def _normalized_sql_literals(tree: ast.AST) -> list[str]:
    return [" ".join(literal.split()).lower() for literal in _string_literals(tree)]


def _is_exempt_postgres_read_method(filename: str, class_name: str, method_name: str) -> bool:
    class_exemptions = POSTGRES_TENANT_SCOPED_READ_CLASS_EXEMPTIONS.get(filename, set())
    if class_name in class_exemptions:
        return True

    method_exemptions = POSTGRES_TENANT_SCOPED_READ_METHOD_EXEMPTIONS.get(filename, {})
    return method_name in method_exemptions.get(class_name, set())


def _is_known_postgres_read_gap(filename: str, class_name: str, method_name: str) -> bool:
    known_gaps = POSTGRES_TENANT_SCOPED_READ_KNOWN_GAPS.get(filename, {})
    return method_name in known_gaps.get(class_name, set())


def _check_postgres_url_detection_boundary() -> list[str]:
    errors: list[str] = []

    database_tree = ast.parse(DATABASE_MODULE.read_text(encoding="utf-8"), filename=str(DATABASE_MODULE))
    main_tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))

    if not _module_defines_function(database_tree, "is_postgres_database_url"):
        errors.append(
            "missing centralized PostgreSQL URL helper: "
            "backend/persistence/database.py:is_postgres_database_url",
        )

    if not _module_defines_function(database_tree, "create_configured_postgres_database"):
        errors.append(
            "missing configured PostgreSQL database helper: "
            "backend/persistence/database.py:create_configured_postgres_database",
        )

    if _module_imports_name(main_tree, "urlparse"):
        errors.append("backend/main.py must not parse database URL schemes directly; use is_postgres_database_url")

    if _module_uses_name(main_tree, "is_postgres_database_url"):
        errors.append(
            "backend/main.py must not detect PostgreSQL URLs directly; use create_configured_postgres_database",
        )

    if not _module_uses_name(main_tree, "create_configured_postgres_database"):
        errors.append(
            "backend/main.py must use backend.persistence.create_configured_postgres_database "
            "for PostgreSQL database selection",
        )

    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    database_url_occurrences = main_source.count("AGENTFOUNDRY_DATABASE_URL")
    if database_url_occurrences:
        errors.append(
            "backend/main.py must not read AGENTFOUNDRY_DATABASE_URL directly; route database selection through "
            "create_configured_postgres_database",
        )

    scheme_literals = sorted(POSTGRES_SCHEME_LITERALS & set(_string_literals(main_tree)))
    if scheme_literals:
        errors.append(
            "backend/main.py must not duplicate PostgreSQL scheme literals: "
            f"{', '.join(scheme_literals)}",
        )

    return errors


def _check_postgres_write_transaction_boundary() -> list[str]:
    errors: list[str] = []

    for path in sorted(PERSISTENCE_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for class_node in ast.walk(tree):
            if not isinstance(class_node, ast.ClassDef):
                continue
            if not class_node.name.startswith("Postgres") or "Write" not in class_node.name:
                continue

            for method_node in class_node.body:
                if not isinstance(method_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                if method_node.name.startswith("_"):
                    continue

                if _method_uses_database_call(method_node, "connect"):
                    errors.append(
                        "PostgreSQL write repository must not use connect() for writes; "
                        f"use transaction(): backend/persistence/{path.name}:"
                        f"{class_node.name}.{method_node.name}",
                    )
                    continue

                if _module_uses_name(method_node, "_database") and not _method_uses_database_call(
                    method_node,
                    "transaction",
                ):
                    errors.append(
                        "PostgreSQL write repository touches the database without a transaction boundary: "
                        f"backend/persistence/{path.name}:{class_node.name}.{method_node.name}",
                    )

    return errors


def _check_postgres_read_tenant_boundary() -> list[str]:
    errors: list[str] = []

    for path in sorted(PERSISTENCE_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for class_node in ast.walk(tree):
            if not isinstance(class_node, ast.ClassDef):
                continue
            if not class_node.name.startswith("Postgres") or "Read" not in class_node.name:
                continue

            for method_node in class_node.body:
                if not isinstance(method_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                if method_node.name.startswith("_"):
                    continue
                if not _method_uses_database_call(method_node, "connect"):
                    continue
                if _is_exempt_postgres_read_method(path.name, class_node.name, method_node.name):
                    continue
                if _is_known_postgres_read_gap(path.name, class_node.name, method_node.name):
                    continue

                if not _method_has_required_argument(method_node, "tenant_id"):
                    errors.append(
                        "PostgreSQL read repository method must require tenant_id: "
                        f"backend/persistence/{path.name}:{class_node.name}.{method_node.name}",
                    )

                sql_literals = _normalized_sql_literals(method_node)
                if not any("tenant_id = %s" in literal for literal in sql_literals):
                    errors.append(
                        "PostgreSQL read repository query must filter by tenant_id: "
                        f"backend/persistence/{path.name}:{class_node.name}.{method_node.name}",
                    )

    return errors


def _check_postgres_runtime_provider_reads_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    platform_status_source = PLATFORM_STATUS_SERVICE_MODULE.read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresRuntimeReadRepository"):
        errors.append(
            "backend/main.py must import PostgresRuntimeReadRepository for runtime provider reads",
        )
    if not _module_defines_function(main_tree, "_build_runtime_read_repository"):
        errors.append(
            "backend/main.py must define _build_runtime_read_repository for PostgreSQL runtime provider reads",
        )
    if "runtime_provider_reader=" not in main_source:
        errors.append(
            "backend/main.py must pass runtime_provider_reader into PlatformStatusService",
        )
    if "runtime_provider_reader" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must accept a runtime_provider_reader",
        )
    if 'status="active"' not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must select an active runtime provider from PostgreSQL",
        )
    if "postgres_runtime_provider_record" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must expose postgres_runtime_provider_record in runtime checks",
        )

    return errors


def _check_postgres_runtime_invocation_writes_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    agent_run_source = (SERVICES_DIR / "agent_runs.py").read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresRuntimeWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresRuntimeWriteRepository for runtime invocation writes",
        )
    if not _module_defines_function(main_tree, "_build_runtime_write_repository"):
        errors.append(
            "backend/main.py must define _build_runtime_write_repository for PostgreSQL runtime invocation writes",
        )
    if "runtime_invocation_writer=" not in main_source:
        errors.append(
            "backend/main.py must pass runtime_invocation_writer into PlatformAgentRunService",
        )
    if "runtime_invocation_writer" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must accept a runtime_invocation_writer",
        )
    if "append_runtime_invocation_record_from_context" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must append runtime invocation records from agent run context",
        )
    if "append_invocation" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must call the runtime invocation writer",
        )
    runtime_persistence_source = (PERSISTENCE_DIR / "runtime_records.py").read_text(
        encoding="utf-8",
    )
    for token in (
        "def append_invocation(",
        ") -> RuntimeInvocationRecord:",
        "RETURNING id, tenant_id, provider_id, agent_run_id",
        "row = cursor.fetchone()",
        "Runtime invocation upsert did not return a row.",
        "return _invocation_from_row(dict(row))",
    ):
        if token not in runtime_persistence_source:
            errors.append(
                "backend/persistence/runtime_records.py must return persisted "
                f"PostgreSQL runtime invocation write records: {token}",
            )

    return errors


def _check_postgres_tool_calls_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    agent_run_source = (SERVICES_DIR / "agent_runs.py").read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresToolCallReadRepository"):
        errors.append(
            "backend/main.py must import PostgresToolCallReadRepository for tool call reads",
        )
    if not _module_imports_name(main_tree, "PostgresToolCallWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresToolCallWriteRepository for tool call writes",
        )
    if not _module_defines_function(main_tree, "_build_tool_call_read_repository"):
        errors.append(
            "backend/main.py must define _build_tool_call_read_repository for PostgreSQL tool call reads",
        )
    if not _module_defines_function(main_tree, "_build_tool_call_write_repository"):
        errors.append(
            "backend/main.py must define _build_tool_call_write_repository for PostgreSQL tool call writes",
        )
    if "tool_call_reader=_build_tool_call_read_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tool_call_reader into ToolAuditLogger",
        )
    if "tool_call_writer=_build_tool_call_write_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tool_call_writer into production services",
        )
    if "tool_call_writer" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must accept a tool_call_writer",
        )
    if "append_tool_call_records" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must collect routed tool calls for persistence",
        )
    if "append_tool_call" not in agent_run_source:
        errors.append(
            "backend/services/agent_runs.py must call the tool call writer",
        )
    tool_call_persistence_source = (PERSISTENCE_DIR / "tool_calls.py").read_text(
        encoding="utf-8",
    )
    for token in (
        "def append_tool_call(",
        ") -> ToolCallRecord:",
        "RETURNING id, tenant_id, agent_run_id, tool_id, inputs, result",
        "row = cursor.fetchone()",
        "Tool call upsert did not return a row.",
        "return _tool_call_from_row(dict(row))",
    ):
        if token not in tool_call_persistence_source:
            errors.append(
                "backend/persistence/tool_calls.py must return persisted "
                f"PostgreSQL tool call write records: {token}",
            )

    return errors


def _check_postgres_tool_policy_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    tool_service_source = (SERVICES_DIR / "tools.py").read_text(encoding="utf-8")
    tool_policy_source = (REPOSITORIES_DIR / "tool_policy.py").read_text(
        encoding="utf-8",
    )
    tool_persistence_source = (PERSISTENCE_DIR / "tools.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresToolGovernanceReadRepository"):
        errors.append(
            "backend/main.py must import PostgresToolGovernanceReadRepository for tool policy reads",
        )
    if not _module_imports_name(main_tree, "PostgresToolGovernanceWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresToolGovernanceWriteRepository for tool policy writes",
        )
    if not _module_defines_function(main_tree, "_build_tool_governance_read_repository"):
        errors.append(
            "backend/main.py must define _build_tool_governance_read_repository for PostgreSQL tool policy reads",
        )
    if not _module_defines_function(main_tree, "_build_tool_governance_write_repository"):
        errors.append(
            "backend/main.py must define _build_tool_governance_write_repository for PostgreSQL tool policy writes",
        )
    if "tool_governance_reader=_build_tool_governance_read_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tool_governance_reader into PlatformToolPolicyService",
        )
    if "tool_governance_writer=_build_tool_governance_write_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tool_governance_writer into PlatformToolPolicyService",
        )
    if "now=now_iso" not in main_source:
        errors.append(
            "backend/main.py must pass a clock into PlatformToolPolicyService for PostgreSQL tool policy writes",
        )

    required_service_tokens = [
        "PostgresToolPolicyWriteThroughRepository",
        "_tool_governance_reader",
        "_tool_governance_writer",
        "Tool governance PostgreSQL writer requires a reader.",
        "Tool governance PostgreSQL writer requires a clock.",
        "postgres_reader=self._tool_governance_reader",
        "postgres_writer=self._tool_governance_writer",
        "approval_required_tools=self._approval_required_tools",
    ]
    for token in required_service_tokens:
        if token not in tool_service_source:
            errors.append(
                "backend/services/tools.py must route tool policy persistence through PostgreSQL: "
                f"{token}",
            )

    required_write_through_tokens = [
        "class PostgresToolPolicyWriteThroughRepository",
        "load_policy_snapshot",
        "save_policy",
        "enterprise_tool_catalog",
        "approval_required_tools",
    ]
    for token in required_write_through_tokens:
        if token not in tool_policy_source:
            errors.append(
                "backend/repositories/tool_policy.py must provide the PostgreSQL write-through adapter: "
                f"{token}",
            )

    required_persistence_tokens = [
        "class ToolPolicyWriteResult",
        "class PostgresToolGovernanceReadRepository",
        "class PostgresToolGovernanceWriteRepository",
        "def load_policy_snapshot",
        "def save_policy",
        ") -> ToolPolicyWriteResult:",
        "INSERT INTO tools",
        "INSERT INTO tool_policies",
        "INSERT INTO tool_user_policies",
        "RETURNING id, tenant_id, tool_id, allowed_roles",
        "Tool policy upsert did not return a row.",
        "RETURNING id, tenant_id, user_id, allow_tools",
        "Tool user policy upsert did not return a row.",
    ]
    for token in required_persistence_tokens:
        if token not in tool_persistence_source:
            errors.append(
                "backend/persistence/tools.py must persist tool policy records in PostgreSQL: "
                f"{token}",
            )

    return errors


def _check_postgres_memory_item_writes_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    memory_source = (REPOSITORIES_DIR / "memories.py").read_text(encoding="utf-8")
    memory_persistence_source = (PERSISTENCE_DIR / "memory_items.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))
    memory_tree = ast.parse(memory_source, filename=str(REPOSITORIES_DIR / "memories.py"))

    if not _module_imports_name(main_tree, "PostgresMemoryItemReadRepository"):
        errors.append(
            "backend/main.py must import PostgresMemoryItemReadRepository for memory item reads",
        )
    if not _module_imports_name(main_tree, "PostgresMemoryItemWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresMemoryItemWriteRepository for memory item writes",
        )
    if not _module_defines_function(main_tree, "_build_memory_item_read_repository"):
        errors.append(
            "backend/main.py must define _build_memory_item_read_repository for PostgreSQL memory item reads",
        )
    if not _module_defines_function(main_tree, "_build_memory_item_write_repository"):
        errors.append(
            "backend/main.py must define _build_memory_item_write_repository for PostgreSQL memory item writes",
        )
    if "memory_item_reader=_build_memory_item_read_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL memory_item_reader into PlatformMemoryRepository",
        )
    if "memory_item_writer=_build_memory_item_write_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL memory_item_writer into PlatformMemoryRepository",
        )
    if "memory_item_reader" not in memory_source:
        errors.append(
            "backend/repositories/memories.py must accept a memory_item_reader",
        )
    if "list_memory_items" not in memory_source:
        errors.append(
            "backend/repositories/memories.py must call the memory item reader",
        )
    if "memory_item_writer" not in memory_source:
        errors.append(
            "backend/repositories/memories.py must accept a memory_item_writer",
        )
    if "append_memory_item" not in memory_source:
        errors.append(
            "backend/repositories/memories.py must call the memory item writer",
        )
    for token in (
        "def append_memory_item(",
        ") -> MemoryItemRecord:",
        "RETURNING id, tenant_id, user_id, agent_id, session_id",
        "row = cursor.fetchone()",
        "Memory item upsert did not return a row.",
        "return _memory_item_from_row(dict(row))",
    ):
        if token not in memory_persistence_source:
            errors.append(
                "backend/persistence/memory_items.py must return persisted "
                f"PostgreSQL memory item write records: {token}",
            )

    append_capped = _find_class_method(
        memory_tree,
        class_name="PlatformMemoryRepository",
        method_name="append_capped",
    )
    if append_capped is None:
        errors.append(
            "backend/repositories/memories.py must define PlatformMemoryRepository.append_capped",
        )
        return errors

    if not _append_capped_returns_after_postgres_memory_write(append_capped):
        errors.append(
            "backend/repositories/memories.py must return after PostgreSQL memory_item_writer writes to avoid JSONL fallthrough",
        )

    return errors


def _check_postgres_audit_events_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    platform_status_source = PLATFORM_STATUS_SERVICE_MODULE.read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresAuditEventReadRepository"):
        errors.append(
            "backend/main.py must import PostgresAuditEventReadRepository for audit event reads",
        )
    if not _module_imports_name(main_tree, "PostgresAuditEventWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresAuditEventWriteRepository for audit event writes",
        )
    if not _module_defines_function(main_tree, "_build_audit_event_read_repository"):
        errors.append(
            "backend/main.py must define _build_audit_event_read_repository for PostgreSQL audit event reads",
        )
    if not _module_defines_function(main_tree, "_build_audit_event_write_repository"):
        errors.append(
            "backend/main.py must define _build_audit_event_write_repository for PostgreSQL audit event writes",
        )
    if "audit_event_reader=_build_audit_event_read_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL audit_event_reader into PlatformStatusService",
        )
    if "audit_event_reader" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must accept an audit_event_reader",
        )
    if "list_audit_events" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must query audit events from the PostgreSQL reader",
        )

    for filename, service_name in sorted(AUDIT_EVENT_WRITER_SERVICE_MODULES.items()):
        service_source = (SERVICES_DIR / filename).read_text(encoding="utf-8")
        if "audit_event_writer" not in service_source:
            errors.append(
                f"backend/services/{filename} must accept an audit_event_writer",
            )
        if "append_audit_event" not in service_source:
            errors.append(
                f"backend/services/{filename} must call append_audit_event",
            )
        service_constructor = f"{service_name}("
        service_position = main_source.find(service_constructor)
        if service_position == -1:
            errors.append(
                f"backend/main.py must construct {service_name} with PostgreSQL audit event wiring",
            )
            continue
        next_function_position = main_source.find("\ndef ", service_position + len(service_constructor))
        if next_function_position == -1:
            service_call_source = main_source[service_position:]
        else:
            service_call_source = main_source[service_position:next_function_position]
        if "audit_event_writer=_build_audit_event_write_repository()" not in service_call_source:
            errors.append(
                f"backend/main.py must pass the PostgreSQL audit_event_writer into {service_name}",
            )

    return errors


def _check_postgres_retrieval_events_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    platform_status_source = PLATFORM_STATUS_SERVICE_MODULE.read_text(encoding="utf-8")
    knowledge_response_source = (SERVICES_DIR / "knowledge.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresRetrievalEventReadRepository"):
        errors.append(
            "backend/main.py must import PostgresRetrievalEventReadRepository for retrieval event reads",
        )
    if not _module_imports_name(main_tree, "PostgresRetrievalEventWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresRetrievalEventWriteRepository for retrieval event writes",
        )
    if not _module_defines_function(main_tree, "_build_retrieval_event_read_repository"):
        errors.append(
            "backend/main.py must define _build_retrieval_event_read_repository for PostgreSQL retrieval event reads",
        )
    if not _module_defines_function(main_tree, "_build_retrieval_event_write_repository"):
        errors.append(
            "backend/main.py must define _build_retrieval_event_write_repository for PostgreSQL retrieval event writes",
        )
    if "retrieval_event_reader=_build_retrieval_event_read_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL retrieval_event_reader into PlatformStatusService",
        )
    if "retrieval_event_writer=_build_retrieval_event_write_repository()" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL retrieval_event_writer into PlatformKnowledgeResponseService",
        )
    if "retrieval_event_reader" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must accept a retrieval_event_reader",
        )
    if "list_retrieval_events" not in platform_status_source:
        errors.append(
            "backend/services/platform_status.py must query retrieval events from the PostgreSQL reader",
        )
    if "retrieval_event_writer" not in knowledge_response_source:
        errors.append(
            "backend/services/knowledge.py must accept a retrieval_event_writer",
        )
    if "append_retrieval_event" not in knowledge_response_source:
        errors.append(
            "backend/services/knowledge.py must call append_retrieval_event",
        )

    return errors


def _check_postgres_workflow_runs_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    workflow_repository_source = (REPOSITORIES_DIR / "workflows.py").read_text(
        encoding="utf-8",
    )
    workflow_persistence_source = (PERSISTENCE_DIR / "workflows.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    required_main_imports = [
        "PostgresWorkflowReadRepository",
        "PostgresWorkflowWriteRepository",
        "PostgresWorkflowRunReadThroughRepository",
    ]
    for imported_name in required_main_imports:
        if not _module_imports_name(main_tree, imported_name):
            errors.append(
                f"backend/main.py must import {imported_name} for workflow run PostgreSQL wiring",
            )

    if not _module_defines_function(main_tree, "_build_workflow_run_repository"):
        errors.append(
            "backend/main.py must define _build_workflow_run_repository for PostgreSQL workflow runs",
        )
    if "workflow_run_repository = _build_workflow_run_repository()" not in main_source:
        errors.append(
            "backend/main.py must build workflow_run_repository through the PostgreSQL selector",
        )
    if "PostgresWorkflowRunReadThroughRepository(" not in main_source:
        errors.append(
            "backend/main.py must wrap PostgreSQL workflow repositories with PostgresWorkflowRunReadThroughRepository",
        )
    if "postgres_reader=PostgresWorkflowReadRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL workflow reader into the read-through repository",
        )
    if "postgres_writer=PostgresWorkflowWriteRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL workflow writer into the read-through repository",
        )
    if "repository=workflow_run_repository" not in main_source:
        errors.append(
            "backend/main.py must pass workflow_run_repository into PlatformWorkflowRunService",
        )

    required_read_through_tokens = [
        "class PostgresWorkflowRunReadThroughRepository",
        "PostgreSQL workflow run reads require tenant context.",
        "PostgreSQL workflow run writes require tenant context.",
        "list_runs",
        "append_run",
        "_validate_write_result",
        "_postgres_run_to_platform_record",
        "_platform_record_to_postgres_run",
    ]
    for token in required_read_through_tokens:
        if token not in workflow_repository_source:
            errors.append(
                "backend/repositories/workflows.py must provide the PostgreSQL workflow run read-through adapter: "
                f"{token}",
            )

    required_persistence_tokens = [
        "class PostgresWorkflowReadRepository",
        "class PostgresWorkflowWriteRepository",
        "def list_runs",
        "def get_run",
        "def append_run",
        "FROM workflow_runs",
        "INSERT INTO workflow_runs",
    ]
    for token in required_persistence_tokens:
        if token not in workflow_persistence_source:
            errors.append(
                "backend/persistence/workflows.py must persist workflow run records in PostgreSQL: "
                f"{token}",
            )

    for token in (
        "def append_run(",
        ") -> WorkflowRunRecord:",
        "RETURNING id, tenant_id, workflow_template_id, user_id",
        "row = cursor.fetchone()",
        "Workflow run upsert did not return a row.",
        "return _run_from_row(dict(row))",
    ):
        if token not in workflow_persistence_source:
            errors.append(
                "backend/persistence/workflows.py must return persisted PostgreSQL "
                f"workflow run write records: {token}",
            )

    for token in (
        "PostgreSQL workflow run write did not return a run id.",
        "PostgreSQL workflow run write did not return a tenant id.",
        "PostgreSQL workflow run write did not return a workflow template id.",
        "PostgreSQL workflow run write did not return a user id.",
        "PostgreSQL workflow run write returned another run.",
        "PostgreSQL workflow run write returned another tenant.",
        "PostgreSQL workflow run write returned another workflow template.",
        "PostgreSQL workflow run write returned another user.",
    ):
        if token not in workflow_repository_source:
            errors.append(
                "backend/repositories/workflows.py must validate PostgreSQL "
                f"workflow run write records: {token}",
            )

    return errors


def _check_postgres_agent_catalog_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    agent_repository_source = (REPOSITORIES_DIR / "agents.py").read_text(
        encoding="utf-8",
    )
    agent_persistence_source = (PERSISTENCE_DIR / "agents.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    required_main_imports = [
        "PostgresAgentCatalogReadRepository",
        "PostgresAgentCatalogWriteRepository",
        "PostgresAgentCatalogWriteThroughRepository",
    ]
    for imported_name in required_main_imports:
        if not _module_imports_name(main_tree, imported_name):
            errors.append(
                f"backend/main.py must import {imported_name} for agent catalog PostgreSQL wiring",
            )

    if not _module_defines_function(main_tree, "_build_agent_repository"):
        errors.append(
            "backend/main.py must define _build_agent_repository for PostgreSQL agent catalog records",
        )
    if "agent_repository = _build_agent_repository()" not in main_source:
        errors.append(
            "backend/main.py must build agent_repository through the PostgreSQL selector",
        )
    if "PostgresAgentCatalogWriteThroughRepository(" not in main_source:
        errors.append(
            "backend/main.py must wrap PostgreSQL agent catalog repositories with "
            "PostgresAgentCatalogWriteThroughRepository",
        )
    if "postgres_reader=PostgresAgentCatalogReadRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL agent catalog reader into the write-through repository",
        )
    if "postgres_writer=PostgresAgentCatalogWriteRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL agent catalog writer into the write-through repository",
        )
    if "repository=agent_repository" not in main_source:
        errors.append(
            "backend/main.py must pass agent_repository into PlatformAgentService",
        )

    required_write_through_tokens = [
        "class PostgresAgentCatalogWriteThroughRepository",
        "AgentCatalogWriteResult",
        "PostgreSQL agent catalog list reads require tenant scope.",
        "PostgreSQL agent catalog reads require tenant scope.",
        "_validate_write_results",
        "PostgreSQL agent catalog write did not return a persisted agent id.",
        "PostgreSQL agent catalog write did not return a persisted version id.",
        "PostgreSQL agent catalog write did not persist the current version id.",
        "list_agents",
        "get_agent",
        "save_agents",
        "_agent_catalog_item",
    ]
    for token in required_write_through_tokens:
        if token not in agent_repository_source:
            errors.append(
                "backend/repositories/agents.py must provide the PostgreSQL agent catalog write-through adapter: "
                f"{token}",
            )

    required_persistence_tokens = [
        "class AgentCatalogWriteResult",
        "class PostgresAgentCatalogReadRepository",
        "class PostgresAgentCatalogWriteRepository",
        "def list_agents",
        "def get_agent",
        "def get_current_version",
        "def save_agents",
        "list[AgentCatalogWriteResult]",
        "FROM agents",
        "INSERT INTO agents",
        "INSERT INTO agent_versions",
        "RETURNING id, tenant_id, template_id",
        "RETURNING id, tenant_id, agent_id, version",
        "Agent catalog upsert did not return a row.",
        "Agent version upsert did not return a row.",
        "Agent current version update did not return a row.",
    ]
    for token in required_persistence_tokens:
        if token not in agent_persistence_source:
            errors.append(
                "backend/persistence/agents.py must persist agent catalog records in PostgreSQL: "
                f"{token}",
            )

    return errors


def _check_postgres_agent_runs_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    agent_run_repository_source = (REPOSITORIES_DIR / "agent_runs.py").read_text(
        encoding="utf-8",
    )
    agent_run_persistence_source = (PERSISTENCE_DIR / "runs.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    required_main_imports = [
        "PostgresAgentRunReadRepository",
        "PostgresAgentRunWriteRepository",
        "PostgresAgentRunReadThroughRepository",
    ]
    for imported_name in required_main_imports:
        if not _module_imports_name(main_tree, imported_name):
            errors.append(
                f"backend/main.py must import {imported_name} for agent run PostgreSQL wiring",
            )

    if not _module_defines_function(main_tree, "_build_agent_run_repository"):
        errors.append(
            "backend/main.py must define _build_agent_run_repository for PostgreSQL agent runs",
        )
    if "agent_run_repository = _build_agent_run_repository()" not in main_source:
        errors.append(
            "backend/main.py must build agent_run_repository through the PostgreSQL selector",
        )
    if "PostgresAgentRunReadThroughRepository(" not in main_source:
        errors.append(
            "backend/main.py must wrap PostgreSQL agent run repositories with PostgresAgentRunReadThroughRepository",
        )
    if "postgres_reader=PostgresAgentRunReadRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL agent run reader into the read-through repository",
        )
    if "postgres_writer=PostgresAgentRunWriteRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL agent run writer into the read-through repository",
        )
    if "repository=agent_run_repository" not in main_source:
        errors.append(
            "backend/main.py must pass agent_run_repository into PlatformAgentRunService",
        )

    required_read_through_tokens = [
        "class PostgresAgentRunReadThroughRepository",
        "PostgreSQL agent run reads require tenant context.",
        "PostgreSQL agent run writes require tenant context.",
        "list_runs",
        "get_run",
        "append_run",
        "_validate_write_result",
        "_postgres_run_to_platform_record",
        "_platform_record_to_postgres_run",
    ]
    for token in required_read_through_tokens:
        if token not in agent_run_repository_source:
            errors.append(
                "backend/repositories/agent_runs.py must provide the PostgreSQL agent run read-through adapter: "
                f"{token}",
            )

    required_persistence_tokens = [
        "class PostgresAgentRunReadRepository",
        "class PostgresAgentRunWriteRepository",
        "def list_runs",
        "def get_run",
        "def append_run",
        "FROM agent_runs",
        "INSERT INTO agent_runs",
    ]
    for token in required_persistence_tokens:
        if token not in agent_run_persistence_source:
            errors.append(
                "backend/persistence/runs.py must persist agent run records in PostgreSQL: "
                f"{token}",
            )

    for token in (
        "def append_run(",
        ") -> AgentRunRecord:",
        "RETURNING id, tenant_id, agent_id, agent_version_id, user_id",
        "row = cursor.fetchone()",
        "Agent run upsert did not return a row.",
        "return _run_from_row(dict(row))",
    ):
        if token not in agent_run_persistence_source:
            errors.append(
                "backend/persistence/runs.py must return persisted PostgreSQL "
                f"agent run write records: {token}",
            )

    for token in (
        "PostgreSQL agent run write did not return a run id.",
        "PostgreSQL agent run write did not return a tenant id.",
        "PostgreSQL agent run write did not return a user id.",
        "PostgreSQL agent run write returned another run.",
        "PostgreSQL agent run write returned another tenant.",
        "PostgreSQL agent run write returned another agent.",
        "PostgreSQL agent run write returned another agent version.",
        "PostgreSQL agent run write returned another user.",
    ):
        if token not in agent_run_repository_source:
            errors.append(
                "backend/repositories/agent_runs.py must validate PostgreSQL "
                f"agent run write records: {token}",
            )

    return errors


def _check_postgres_approval_requests_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    approval_repository_source = (REPOSITORIES_DIR / "approvals.py").read_text(encoding="utf-8")
    approval_service_source = (SERVICES_DIR / "approvals.py").read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    if not _module_imports_name(main_tree, "PostgresApprovalReadRepository"):
        errors.append(
            "backend/main.py must import PostgresApprovalReadRepository for approval request reads",
        )
    if not _module_imports_name(main_tree, "PostgresApprovalWriteRepository"):
        errors.append(
            "backend/main.py must import PostgresApprovalWriteRepository for approval request writes",
        )
    if not _module_imports_name(main_tree, "PostgresApprovalReadThroughRepository"):
        errors.append(
            "backend/main.py must import PostgresApprovalReadThroughRepository for approval request wiring",
        )
    if not _module_defines_function(main_tree, "_build_approval_request_repository"):
        errors.append(
            "backend/main.py must define _build_approval_request_repository for PostgreSQL approval requests",
        )
    if "approval_request_repository = _build_approval_request_repository()" not in main_source:
        errors.append(
            "backend/main.py must build the approval_request_repository through the PostgreSQL selector",
        )
    if "PostgresApprovalReadThroughRepository(" not in main_source:
        errors.append(
            "backend/main.py must wrap PostgreSQL approval repositories with PostgresApprovalReadThroughRepository",
        )
    if "repository=approval_request_repository" not in main_source:
        errors.append(
            "backend/main.py must pass approval_request_repository into PlatformApprovalService",
        )
    if "PostgresApprovalReadThroughRepository" not in approval_repository_source:
        errors.append(
            "backend/repositories/approvals.py must define PostgresApprovalReadThroughRepository",
        )
    if "append_approval" not in approval_repository_source:
        errors.append(
            "backend/repositories/approvals.py must write approval requests through PostgreSQL",
        )
    if "update_approval_status" not in approval_repository_source:
        errors.append(
            "backend/repositories/approvals.py must update approval status through PostgreSQL",
        )
    for token in (
        "_validate_write_result(postgres_record, persisted_record)",
        "_validate_decision_result(",
        "PostgreSQL approval decision returned another status.",
        "PostgreSQL approval decision returned another approver.",
        "PostgreSQL approval decision returned another resolution time.",
        "PostgreSQL approval write did not return an approval id.",
        "PostgreSQL approval write did not return a tenant id.",
        "PostgreSQL approval write did not return a request type.",
        "PostgreSQL approval write did not return a target type.",
        "PostgreSQL approval write did not return a target id.",
        "PostgreSQL approval write returned another approval.",
        "PostgreSQL approval write returned another tenant.",
        "PostgreSQL approval write returned another request type.",
        "PostgreSQL approval write returned another target type.",
        "PostgreSQL approval write returned another target.",
    ):
        if token not in approval_repository_source:
            errors.append(
                "backend/repositories/approvals.py must validate persisted "
                f"PostgreSQL approval write records: {token}",
            )
    if "ApprovalRequestRepositoryProtocol" not in approval_service_source:
        errors.append(
            "backend/services/approvals.py must depend on ApprovalRequestRepositoryProtocol",
        )

    approval_persistence_source = (PERSISTENCE_DIR / "approvals.py").read_text(encoding="utf-8")
    for token in (
        "def append_approval(",
        ") -> ApprovalRecord:",
        "RETURNING id, tenant_id, request_type, target_type, target_id",
        "row = cursor.fetchone()",
        "Approval insert did not return a row.",
        "return _approval_from_row(dict(row))",
    ):
        if token not in approval_persistence_source:
            errors.append(
                "backend/persistence/approvals.py must return persisted PostgreSQL "
                f"approval write records: {token}",
            )

    return errors


def _check_postgres_knowledge_readiness_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    knowledge_source = (SERVICES_DIR / "knowledge.py").read_text(encoding="utf-8")
    agents_source = (SERVICES_DIR / "agents.py").read_text(encoding="utf-8")
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    required_main_imports = [
        "PostgresKnowledgeBaseReadRepository",
        "PostgresDocumentReadRepository",
        "PostgresDocumentChunkReadRepository",
        "PostgresEmbeddingRecordReadRepository",
        "PostgresModelConfigReadRepository",
    ]
    for imported_name in required_main_imports:
        if not _module_imports_name(main_tree, imported_name):
            errors.append(
                f"backend/main.py must import {imported_name} for knowledge readiness reads",
            )

    if not _module_defines_function(main_tree, "_build_knowledge_document_readiness_service"):
        errors.append(
            "backend/main.py must define _build_knowledge_document_readiness_service for PostgreSQL knowledge readiness",
        )

    required_constructor_wiring = [
        "knowledge_base_repository=PostgresKnowledgeBaseReadRepository(database)",
        "document_repository=PostgresDocumentReadRepository(database)",
        "document_chunk_repository=PostgresDocumentChunkReadRepository(database)",
        "embedding_record_repository=PostgresEmbeddingRecordReadRepository(database)",
        "model_config_repository=PostgresModelConfigReadRepository(database)",
    ]
    for wiring in required_constructor_wiring:
        if wiring not in main_source:
            errors.append(
                "backend/main.py must wire PostgreSQL knowledge readiness reader: "
                f"{wiring}",
            )

    required_protocols = [
        "KnowledgeBaseReadRepository",
        "DocumentReadRepository",
        "DocumentChunkReadRepository",
        "EmbeddingRecordReadRepository",
        "ModelConfigReadRepository",
    ]
    for protocol_name in required_protocols:
        if protocol_name not in knowledge_source:
            errors.append(
                f"backend/services/knowledge.py must define {protocol_name} for knowledge readiness",
            )

    required_read_calls = [
        "get_knowledge_base",
        "list_documents",
        "list_document_chunks",
        "list_embedding_records",
        "get_model_config",
    ]
    for call_name in required_read_calls:
        if call_name not in knowledge_source:
            errors.append(
                f"backend/services/knowledge.py must read {call_name} for knowledge readiness",
            )

    if "document_readiness_service" not in agents_source:
        errors.append(
            "backend/services/agents.py must accept a document_readiness_service for agent readiness",
        )
    if "build_readiness" not in agents_source:
        errors.append(
            "backend/services/agents.py must use knowledge document readiness during agent readiness checks",
        )

    return errors


def _check_postgres_knowledge_ingestion_write_records() -> list[str]:
    errors: list[str] = []
    knowledge_ingestion_source = (SERVICES_DIR / "knowledge_ingestion.py").read_text(
        encoding="utf-8",
    )
    document_persistence_source = (PERSISTENCE_DIR / "documents.py").read_text(
        encoding="utf-8",
    )
    chunk_persistence_source = (PERSISTENCE_DIR / "document_chunks.py").read_text(
        encoding="utf-8",
    )

    for token in (
        "def upsert_document(self, record: DocumentRecord) -> DocumentRecord:",
        "persisted_document = self._document_repository.upsert_document(",
        "document_id=persisted_document.id",
    ):
        if token not in knowledge_ingestion_source:
            errors.append(
                "backend/services/knowledge_ingestion.py must use persisted "
                f"PostgreSQL document write records: {token}",
            )

    for token in (
        "def append_document_chunk(self, record: DocumentChunkRecord) -> DocumentChunkRecord:",
        "persisted_chunks: list[DocumentChunkRecord] = []",
        "persisted_chunks.append(",
        "chunk_count=len(persisted_chunks)",
    ):
        if token not in knowledge_ingestion_source:
            errors.append(
                "backend/services/knowledge_ingestion.py must use persisted "
                f"PostgreSQL document chunk write records: {token}",
            )

    for token in (
        "def upsert_document(",
        ") -> DocumentRecord:",
        "RETURNING id, tenant_id, knowledge_base_id, title, source_type",
        "row = cursor.fetchone()",
        "return _document_from_row(dict(row))",
    ):
        if token not in document_persistence_source:
            errors.append(
                "backend/persistence/documents.py must return persisted "
                f"PostgreSQL document write records: {token}",
            )

    for token in (
        "def append_document_chunk(",
        ") -> DocumentChunkRecord:",
        "RETURNING id, tenant_id, document_id, chunk_index, content",
        "row = cursor.fetchone()",
        "return _document_chunk_from_row(dict(row))",
    ):
        if token not in chunk_persistence_source:
            errors.append(
                "backend/persistence/document_chunks.py must return persisted "
                f"PostgreSQL document chunk write records: {token}",
            )

    return errors


def _check_postgres_knowledge_audit_write_records() -> list[str]:
    errors: list[str] = []
    knowledge_source = (SERVICES_DIR / "knowledge.py").read_text(encoding="utf-8")
    audit_persistence_source = (PERSISTENCE_DIR / "audit_events.py").read_text(
        encoding="utf-8",
    )

    for token in (
        "def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:",
        "persisted_audit_event = self._audit_event_writer.append_audit_event(",
        "if not persisted_audit_event.id:",
    ):
        if token not in knowledge_source:
            errors.append(
                "backend/services/knowledge.py must use persisted PostgreSQL "
                f"knowledge audit write records: {token}",
            )

    for token in (
        "def append_audit_event(",
        ") -> AuditEventRecord:",
        "RETURNING id, tenant_id, actor_user_id, event_type",
        "row = cursor.fetchone()",
        "Audit event upsert did not return a row.",
        "return _audit_event_from_row(dict(row))",
    ):
        if token not in audit_persistence_source:
            errors.append(
                "backend/persistence/audit_events.py must return persisted "
                f"PostgreSQL audit event write records: {token}",
            )

    return errors


def _check_postgres_service_audit_write_records() -> list[str]:
    errors: list[str] = []

    for filename in sorted(AUDIT_EVENT_WRITER_SERVICE_MODULES):
        service_source = (SERVICES_DIR / filename).read_text(encoding="utf-8")
        for token in (
            "def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:",
            "persisted_audit_event = self._audit_event_writer.append_audit_event(",
            "if not persisted_audit_event.id:",
        ):
            if token not in service_source:
                errors.append(
                    f"backend/services/{filename} must use persisted PostgreSQL "
                    f"service audit write records: {token}",
                )

    return errors


def _check_postgres_members_wired() -> list[str]:
    errors: list[str] = []
    main_source = MAIN_MODULE.read_text(encoding="utf-8")
    member_repository_source = (REPOSITORIES_DIR / "members.py").read_text(
        encoding="utf-8",
    )
    tenancy_persistence_source = (PERSISTENCE_DIR / "tenancy.py").read_text(
        encoding="utf-8",
    )
    main_tree = ast.parse(main_source, filename=str(MAIN_MODULE))

    required_main_imports = [
        "PostgresMemberReadThroughRepository",
        "PostgresTenancyReadRepository",
        "PostgresTenancyWriteRepository",
    ]
    for imported_name in required_main_imports:
        if not _module_imports_name(main_tree, imported_name):
            errors.append(
                f"backend/main.py must import {imported_name} for member PostgreSQL wiring",
            )

    if not _module_defines_function(main_tree, "_build_member_repository"):
        errors.append(
            "backend/main.py must define _build_member_repository for PostgreSQL members",
        )
    if "member_repository = _build_member_repository()" not in main_source:
        errors.append(
            "backend/main.py must build member_repository through the PostgreSQL selector",
        )
    if "PostgresMemberReadThroughRepository(" not in main_source:
        errors.append(
            "backend/main.py must wrap PostgreSQL tenancy repositories with "
            "PostgresMemberReadThroughRepository",
        )
    if "postgres_reader=PostgresTenancyReadRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tenancy reader into the member read-through repository",
        )
    if "postgres_writer=PostgresTenancyWriteRepository(database)" not in main_source:
        errors.append(
            "backend/main.py must pass the PostgreSQL tenancy writer into the member read-through repository",
        )
    if "repository=member_repository" not in main_source:
        errors.append(
            "backend/main.py must pass member_repository into PlatformMemberService",
        )

    required_read_through_tokens = [
        "class PostgresMemberReadThroughRepository",
        "TenancyWriteResult",
        "list_memberships",
        "list_users",
        "list_tenants",
        "upsert_member",
        "_validate_write_result",
        "PostgreSQL member write did not return a tenant id.",
        "PostgreSQL member write did not return a user id.",
        "PostgreSQL member write did not return a membership id.",
        "PostgreSQL member write returned a membership for another tenant.",
        "PostgreSQL member write returned a membership for another user.",
        "Member tenant is required for PostgreSQL writes.",
        "Member user_id is required for PostgreSQL writes.",
    ]
    for token in required_read_through_tokens:
        if token not in member_repository_source:
            errors.append(
                "backend/repositories/members.py must provide the PostgreSQL member read-through adapter: "
                f"{token}",
            )

    required_persistence_tokens = [
        "class TenancyWriteResult",
        "class PostgresTenancyReadRepository",
        "class PostgresTenancyWriteRepository",
        "def list_tenants",
        "def list_users",
        "def list_memberships",
        "def upsert_member",
        "RETURNING id, name, status, plan",
        "RETURNING id, display_name, email, status",
        "RETURNING id, tenant_id, user_id, role",
        "Tenant upsert did not return a row.",
        "User upsert did not return a row.",
        "Membership upsert did not return a row.",
        "FROM memberships",
        "INSERT INTO users",
        "INSERT INTO memberships",
    ]
    for token in required_persistence_tokens:
        if token not in tenancy_persistence_source:
            errors.append(
                "backend/persistence/tenancy.py must persist member records in PostgreSQL: "
                f"{token}",
            )

    return errors


def _check_postgres_memory_policy_reads_guarded() -> list[str]:
    errors: list[str] = []
    memory_policy_path = PERSISTENCE_DIR / "memory_policies.py"
    memory_policy_source = memory_policy_path.read_text(encoding="utf-8")
    memory_policy_tree = ast.parse(memory_policy_source, filename=str(memory_policy_path))

    if "PostgresMemoryPolicyReadRepository" not in memory_policy_source:
        errors.append(
            "backend/persistence/memory_policies.py must define "
            "PostgresMemoryPolicyReadRepository",
        )
        return errors

    required_methods = {
        "list_memory_policies": "FROM memory_policies",
        "get_memory_policy": "WHERE tenant_id = %s AND id = %s",
    }
    for method_name, sql_token in required_methods.items():
        method_node = _find_class_method(
            memory_policy_tree,
            class_name="PostgresMemoryPolicyReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL memory policy read repository missing method: "
                "backend/persistence/memory_policies.py:"
                f"PostgresMemoryPolicyReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL memory policy read method must require tenant_id: "
                "backend/persistence/memory_policies.py:"
                f"PostgresMemoryPolicyReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL memory policy read method must read through PostgreSQL: "
                "backend/persistence/memory_policies.py:"
                f"PostgresMemoryPolicyReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        if sql_token.lower() not in normalized_sql:
            errors.append(
                "PostgreSQL memory policy read method must query tenant-scoped "
                "memory policies: backend/persistence/memory_policies.py:"
                f"PostgresMemoryPolicyReadRepository.{method_name}",
            )

    return errors


def _check_postgres_model_config_reads_guarded() -> list[str]:
    errors: list[str] = []
    model_config_path = PERSISTENCE_DIR / "model_configs.py"
    model_config_source = model_config_path.read_text(encoding="utf-8")
    model_config_tree = ast.parse(model_config_source, filename=str(model_config_path))

    if "PostgresModelConfigReadRepository" not in model_config_source:
        errors.append(
            "backend/persistence/model_configs.py must define "
            "PostgresModelConfigReadRepository",
        )
        return errors

    required_methods = {
        "list_model_configs": ["FROM model_configs", "WHERE tenant_id = %s"],
        "get_model_config": ["FROM model_configs", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            model_config_tree,
            class_name="PostgresModelConfigReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL model config read repository missing method: "
                "backend/persistence/model_configs.py:"
                f"PostgresModelConfigReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL model config read method must require tenant_id: "
                "backend/persistence/model_configs.py:"
                f"PostgresModelConfigReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL model config read method must read through PostgreSQL: "
                "backend/persistence/model_configs.py:"
                f"PostgresModelConfigReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL model config read method must query tenant-scoped "
                    "model configs: backend/persistence/model_configs.py:"
                    f"PostgresModelConfigReadRepository.{method_name}",
                )
        if "coalesce(credential_ref, config_ref) as config_ref" not in normalized_sql:
            errors.append(
                "PostgreSQL model config read method must prefer credential_ref "
                "while preserving config_ref compatibility: "
                "backend/persistence/model_configs.py:"
                f"PostgresModelConfigReadRepository.{method_name}",
            )

    return errors


def _check_postgres_knowledge_base_reads_guarded() -> list[str]:
    errors: list[str] = []
    knowledge_base_path = PERSISTENCE_DIR / "knowledge_bases.py"
    knowledge_base_source = knowledge_base_path.read_text(encoding="utf-8")
    knowledge_base_tree = ast.parse(knowledge_base_source, filename=str(knowledge_base_path))

    if "PostgresKnowledgeBaseReadRepository" not in knowledge_base_source:
        errors.append(
            "backend/persistence/knowledge_bases.py must define "
            "PostgresKnowledgeBaseReadRepository",
        )
        return errors

    required_methods = {
        "list_knowledge_bases": ["FROM knowledge_bases", "WHERE tenant_id = %s"],
        "get_knowledge_base": ["FROM knowledge_bases", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            knowledge_base_tree,
            class_name="PostgresKnowledgeBaseReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL knowledge base read repository missing method: "
                "backend/persistence/knowledge_bases.py:"
                f"PostgresKnowledgeBaseReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL knowledge base read method must require tenant_id: "
                "backend/persistence/knowledge_bases.py:"
                f"PostgresKnowledgeBaseReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL knowledge base read method must read through PostgreSQL: "
                "backend/persistence/knowledge_bases.py:"
                f"PostgresKnowledgeBaseReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL knowledge base read method must query tenant-scoped "
                    "knowledge bases: backend/persistence/knowledge_bases.py:"
                    f"PostgresKnowledgeBaseReadRepository.{method_name}",
                )

    return errors


def _check_postgres_document_reads_guarded() -> list[str]:
    errors: list[str] = []
    document_path = PERSISTENCE_DIR / "documents.py"
    document_source = document_path.read_text(encoding="utf-8")
    document_tree = ast.parse(document_source, filename=str(document_path))

    if "PostgresDocumentReadRepository" not in document_source:
        errors.append(
            "backend/persistence/documents.py must define "
            "PostgresDocumentReadRepository",
        )
        return errors

    required_methods = {
        "list_documents": ["FROM documents", "WHERE tenant_id = %s"],
        "get_document": ["FROM documents", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            document_tree,
            class_name="PostgresDocumentReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL document read repository missing method: "
                "backend/persistence/documents.py:"
                f"PostgresDocumentReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL document read method must require tenant_id: "
                "backend/persistence/documents.py:"
                f"PostgresDocumentReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL document read method must read through PostgreSQL: "
                "backend/persistence/documents.py:"
                f"PostgresDocumentReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL document read method must query tenant-scoped "
                    "documents: backend/persistence/documents.py:"
                    f"PostgresDocumentReadRepository.{method_name}",
                )

    return errors


def _check_postgres_document_chunk_reads_guarded() -> list[str]:
    errors: list[str] = []
    chunk_path = PERSISTENCE_DIR / "document_chunks.py"
    chunk_source = chunk_path.read_text(encoding="utf-8")
    chunk_tree = ast.parse(chunk_source, filename=str(chunk_path))

    if "PostgresDocumentChunkReadRepository" not in chunk_source:
        errors.append(
            "backend/persistence/document_chunks.py must define "
            "PostgresDocumentChunkReadRepository",
        )
        return errors

    required_methods = {
        "list_document_chunks": [
            "FROM document_chunks",
            "WHERE tenant_id = %s AND document_id = %s",
        ],
        "get_document_chunk": ["FROM document_chunks", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            chunk_tree,
            class_name="PostgresDocumentChunkReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL document chunk read repository missing method: "
                "backend/persistence/document_chunks.py:"
                f"PostgresDocumentChunkReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL document chunk read method must require tenant_id: "
                "backend/persistence/document_chunks.py:"
                f"PostgresDocumentChunkReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL document chunk read method must read through PostgreSQL: "
                "backend/persistence/document_chunks.py:"
                f"PostgresDocumentChunkReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL document chunk read method must query tenant-scoped "
                    "document chunks: backend/persistence/document_chunks.py:"
                    f"PostgresDocumentChunkReadRepository.{method_name}",
                )

    return errors


def _check_postgres_embedding_record_reads_guarded() -> list[str]:
    errors: list[str] = []
    embedding_path = PERSISTENCE_DIR / "embedding_records.py"
    embedding_source = embedding_path.read_text(encoding="utf-8")
    embedding_tree = ast.parse(embedding_source, filename=str(embedding_path))

    if "PostgresEmbeddingRecordReadRepository" not in embedding_source:
        errors.append(
            "backend/persistence/embedding_records.py must define "
            "PostgresEmbeddingRecordReadRepository",
        )
        return errors

    required_methods = {
        "list_embedding_records": ["FROM embedding_records", "WHERE tenant_id = %s"],
        "get_embedding_record": ["FROM embedding_records", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            embedding_tree,
            class_name="PostgresEmbeddingRecordReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL embedding record read repository missing method: "
                "backend/persistence/embedding_records.py:"
                f"PostgresEmbeddingRecordReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL embedding record read method must require tenant_id: "
                "backend/persistence/embedding_records.py:"
                f"PostgresEmbeddingRecordReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL embedding record read method must read through PostgreSQL: "
                "backend/persistence/embedding_records.py:"
                f"PostgresEmbeddingRecordReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL embedding record read method must query tenant-scoped "
                    "embedding records: backend/persistence/embedding_records.py:"
                    f"PostgresEmbeddingRecordReadRepository.{method_name}",
                )

    return errors


def _check_postgres_memory_item_reads_guarded() -> list[str]:
    errors: list[str] = []
    memory_item_path = PERSISTENCE_DIR / "memory_items.py"
    memory_item_source = memory_item_path.read_text(encoding="utf-8")
    memory_item_tree = ast.parse(memory_item_source, filename=str(memory_item_path))

    if "PostgresMemoryItemReadRepository" not in memory_item_source:
        errors.append(
            "backend/persistence/memory_items.py must define "
            "PostgresMemoryItemReadRepository",
        )
        return errors

    required_methods = {
        "list_memory_items": ["FROM memory_items", "WHERE tenant_id = %s"],
        "get_memory_item": ["FROM memory_items", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            memory_item_tree,
            class_name="PostgresMemoryItemReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL memory item read repository missing method: "
                "backend/persistence/memory_items.py:"
                f"PostgresMemoryItemReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL memory item read method must require tenant_id: "
                "backend/persistence/memory_items.py:"
                f"PostgresMemoryItemReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL memory item read method must read through PostgreSQL: "
                "backend/persistence/memory_items.py:"
                f"PostgresMemoryItemReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL memory item read method must query tenant-scoped "
                    "memory items: backend/persistence/memory_items.py:"
                    f"PostgresMemoryItemReadRepository.{method_name}",
                )

    return errors


def _check_postgres_retrieval_event_reads_guarded() -> list[str]:
    errors: list[str] = []
    retrieval_event_path = PERSISTENCE_DIR / "retrieval_events.py"
    retrieval_event_source = retrieval_event_path.read_text(encoding="utf-8")
    retrieval_event_tree = ast.parse(retrieval_event_source, filename=str(retrieval_event_path))

    if "PostgresRetrievalEventReadRepository" not in retrieval_event_source:
        errors.append(
            "backend/persistence/retrieval_events.py must define "
            "PostgresRetrievalEventReadRepository",
        )
        return errors

    required_methods = {
        "list_retrieval_events": ["FROM retrieval_events", "WHERE tenant_id = %s"],
        "get_retrieval_event": ["FROM retrieval_events", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            retrieval_event_tree,
            class_name="PostgresRetrievalEventReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL retrieval event read repository missing method: "
                "backend/persistence/retrieval_events.py:"
                f"PostgresRetrievalEventReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL retrieval event read method must require tenant_id: "
                "backend/persistence/retrieval_events.py:"
                f"PostgresRetrievalEventReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL retrieval event read method must read through PostgreSQL: "
                "backend/persistence/retrieval_events.py:"
                f"PostgresRetrievalEventReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL retrieval event read method must query tenant-scoped "
                    "retrieval events: backend/persistence/retrieval_events.py:"
                    f"PostgresRetrievalEventReadRepository.{method_name}",
                )

    return errors


def _check_postgres_workflow_run_reads_guarded() -> list[str]:
    errors: list[str] = []
    workflow_path = PERSISTENCE_DIR / "workflows.py"
    workflow_source = workflow_path.read_text(encoding="utf-8")
    workflow_tree = ast.parse(workflow_source, filename=str(workflow_path))

    if "PostgresWorkflowReadRepository" not in workflow_source:
        errors.append(
            "backend/persistence/workflows.py must define "
            "PostgresWorkflowReadRepository",
        )
        return errors

    required_methods = {
        "list_runs": ["FROM workflow_runs", "WHERE tenant_id = %s"],
        "get_run": ["FROM workflow_runs", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            workflow_tree,
            class_name="PostgresWorkflowReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL workflow run read repository missing method: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL workflow run read method must require tenant_id: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL workflow run read method must read through PostgreSQL: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL workflow run read method must query tenant-scoped "
                    "workflow runs: backend/persistence/workflows.py:"
                    f"PostgresWorkflowReadRepository.{method_name}",
                )

    return errors


def _check_postgres_workflow_template_reads_guarded() -> list[str]:
    errors: list[str] = []
    workflow_path = PERSISTENCE_DIR / "workflows.py"
    workflow_source = workflow_path.read_text(encoding="utf-8")
    workflow_tree = ast.parse(workflow_source, filename=str(workflow_path))

    if "PostgresWorkflowReadRepository" not in workflow_source:
        errors.append(
            "backend/persistence/workflows.py must define "
            "PostgresWorkflowReadRepository",
        )
        return errors

    required_methods = {
        "list_templates": ["FROM workflow_templates", "WHERE tenant_id = %s"],
        "get_template": ["FROM workflow_templates", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            workflow_tree,
            class_name="PostgresWorkflowReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL workflow template read repository missing method: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL workflow template read method must require tenant_id: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL workflow template read method must read through PostgreSQL: "
                "backend/persistence/workflows.py:"
                f"PostgresWorkflowReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL workflow template read method must query "
                    "tenant-scoped workflow templates: "
                    "backend/persistence/workflows.py:"
                    f"PostgresWorkflowReadRepository.{method_name}",
                )

    return errors


def _check_postgres_agent_catalog_reads_guarded() -> list[str]:
    errors: list[str] = []
    agent_path = PERSISTENCE_DIR / "agents.py"
    agent_source = agent_path.read_text(encoding="utf-8")
    agent_tree = ast.parse(agent_source, filename=str(agent_path))

    if "PostgresAgentCatalogReadRepository" not in agent_source:
        errors.append(
            "backend/persistence/agents.py must define "
            "PostgresAgentCatalogReadRepository",
        )
        return errors

    required_methods = {
        "list_agents": ["FROM agents", "WHERE tenant_id = %s"],
        "get_agent": ["FROM agents", "WHERE tenant_id = %s AND id = %s"],
        "list_versions": ["FROM agent_versions", "WHERE tenant_id = %s AND agent_id = %s"],
        "get_current_version": ["FROM agents", "WHERE agents.tenant_id = %s AND agents.id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            agent_tree,
            class_name="PostgresAgentCatalogReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL agent catalog read repository missing method: "
                "backend/persistence/agents.py:"
                f"PostgresAgentCatalogReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL agent catalog read method must require tenant_id: "
                "backend/persistence/agents.py:"
                f"PostgresAgentCatalogReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL agent catalog read method must read through PostgreSQL: "
                "backend/persistence/agents.py:"
                f"PostgresAgentCatalogReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL agent catalog read method must query tenant-scoped "
                    "agent catalog records: backend/persistence/agents.py:"
                    f"PostgresAgentCatalogReadRepository.{method_name}",
                )

    return errors


def _check_postgres_agent_run_reads_guarded() -> list[str]:
    errors: list[str] = []
    run_path = PERSISTENCE_DIR / "runs.py"
    run_source = run_path.read_text(encoding="utf-8")
    run_tree = ast.parse(run_source, filename=str(run_path))

    if "PostgresAgentRunReadRepository" not in run_source:
        errors.append(
            "backend/persistence/runs.py must define "
            "PostgresAgentRunReadRepository",
        )
        return errors

    required_methods = {
        "list_runs": ["FROM agent_runs", "WHERE tenant_id = %s"],
        "get_run": ["FROM agent_runs", "WHERE tenant_id = %s AND id = %s"],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            run_tree,
            class_name="PostgresAgentRunReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL agent run read repository missing method: "
                "backend/persistence/runs.py:"
                f"PostgresAgentRunReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL agent run read method must require tenant_id: "
                "backend/persistence/runs.py:"
                f"PostgresAgentRunReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL agent run read method must read through PostgreSQL: "
                "backend/persistence/runs.py:"
                f"PostgresAgentRunReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL agent run read method must query tenant-scoped "
                    "agent runs: backend/persistence/runs.py:"
                    f"PostgresAgentRunReadRepository.{method_name}",
                )

    return errors


def _check_postgres_approval_request_reads_guarded() -> list[str]:
    errors: list[str] = []
    approval_path = PERSISTENCE_DIR / "approvals.py"
    approval_source = approval_path.read_text(encoding="utf-8")
    approval_tree = ast.parse(approval_source, filename=str(approval_path))

    if "PostgresApprovalReadRepository" not in approval_source:
        errors.append(
            "backend/persistence/approvals.py must define "
            "PostgresApprovalReadRepository",
        )
        return errors

    required_methods = {
        "list_approvals": ["FROM approvals", "WHERE tenant_id = %s"],
        "get_approval": ["FROM approvals", "WHERE tenant_id = %s AND id = %s"],
        "list_for_target": [
            "FROM approvals",
            "WHERE tenant_id = %s AND target_type = %s AND target_id = %s",
        ],
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            approval_tree,
            class_name="PostgresApprovalReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL approval request read repository missing method: "
                "backend/persistence/approvals.py:"
                f"PostgresApprovalReadRepository.{method_name}",
            )
            continue
        if not _method_has_required_argument(method_node, "tenant_id"):
            errors.append(
                "PostgreSQL approval request read method must require tenant_id: "
                "backend/persistence/approvals.py:"
                f"PostgresApprovalReadRepository.{method_name}",
            )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL approval request read method must read through PostgreSQL: "
                "backend/persistence/approvals.py:"
                f"PostgresApprovalReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL approval request read method must query "
                    "tenant-scoped approval requests: "
                    "backend/persistence/approvals.py:"
                    f"PostgresApprovalReadRepository.{method_name}",
                )

    return errors


def _check_postgres_membership_reads_guarded() -> list[str]:
    errors: list[str] = []
    tenancy_path = PERSISTENCE_DIR / "tenancy.py"
    tenancy_source = tenancy_path.read_text(encoding="utf-8")
    tenancy_tree = ast.parse(tenancy_source, filename=str(tenancy_path))

    if "PostgresTenancyReadRepository" not in tenancy_source:
        errors.append(
            "backend/persistence/tenancy.py must define "
            "PostgresTenancyReadRepository",
        )
        return errors

    required_methods = {
        "list_tenants": ["FROM tenants"],
        "get_tenant": ["FROM tenants", "WHERE id = %s"],
        "list_users": ["FROM users", "INNER JOIN memberships", "WHERE memberships.tenant_id = %s"],
        "list_memberships": ["FROM memberships", "tenant_id = %s", "user_id = %s"],
    }
    required_arguments = {
        "list_tenants": {"status"},
        "get_tenant": {"tenant_id"},
        "list_users": {"tenant_id"},
        "list_memberships": {"tenant_id", "user_id"},
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            tenancy_tree,
            class_name="PostgresTenancyReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL membership read repository missing method: "
                "backend/persistence/tenancy.py:"
                f"PostgresTenancyReadRepository.{method_name}",
            )
            continue
        method_arguments = {
            argument.arg
            for argument in [*method_node.args.args, *method_node.args.kwonlyargs]
        }
        for required_argument in required_arguments[method_name]:
            if required_argument not in method_arguments:
                errors.append(
                    "PostgreSQL membership read method must accept required scope: "
                    "backend/persistence/tenancy.py:"
                    f"PostgresTenancyReadRepository.{method_name}",
                )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL membership read method must read through PostgreSQL: "
                "backend/persistence/tenancy.py:"
                f"PostgresTenancyReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL membership read method must query expected "
                    "tenancy tables and filters: backend/persistence/tenancy.py:"
                    f"PostgresTenancyReadRepository.{method_name}",
                )

    return errors


def _check_postgres_runtime_reads_guarded() -> list[str]:
    errors: list[str] = []
    runtime_path = PERSISTENCE_DIR / "runtime_records.py"
    runtime_source = runtime_path.read_text(encoding="utf-8")
    runtime_tree = ast.parse(runtime_source, filename=str(runtime_path))

    if "PostgresRuntimeReadRepository" not in runtime_source:
        errors.append(
            "backend/persistence/runtime_records.py must define "
            "PostgresRuntimeReadRepository",
        )
        return errors

    required_methods = {
        "list_providers": [
            "FROM runtime_providers",
            "status = %s",
            "provider_type = %s",
        ],
        "get_provider": ["FROM runtime_providers", "WHERE id = %s"],
        "list_invocations": ["FROM runtime_invocations", "WHERE tenant_id = %s"],
        "get_invocation": [
            "FROM runtime_invocations",
            "WHERE tenant_id = %s AND id = %s",
        ],
    }
    required_arguments = {
        "get_provider": {"provider_id"},
        "list_invocations": {"tenant_id"},
        "get_invocation": {"tenant_id", "runtime_invocation_id"},
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            runtime_tree,
            class_name="PostgresRuntimeReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL runtime read repository missing method: "
                "backend/persistence/runtime_records.py:"
                f"PostgresRuntimeReadRepository.{method_name}",
            )
            continue
        method_arguments = {
            argument.arg
            for argument in [*method_node.args.args, *method_node.args.kwonlyargs]
        }
        for required_argument in required_arguments.get(method_name, set()):
            if required_argument not in method_arguments:
                errors.append(
                    "PostgreSQL runtime read method must accept required scope: "
                    "backend/persistence/runtime_records.py:"
                    f"PostgresRuntimeReadRepository.{method_name}",
                )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL runtime read method must read through PostgreSQL: "
                "backend/persistence/runtime_records.py:"
                f"PostgresRuntimeReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL runtime read method must query expected runtime "
                    "tables and filters: backend/persistence/runtime_records.py:"
                    f"PostgresRuntimeReadRepository.{method_name}",
                )

    return errors


def _check_postgres_tool_call_reads_guarded() -> list[str]:
    errors: list[str] = []
    tool_calls_path = PERSISTENCE_DIR / "tool_calls.py"
    tool_calls_source = tool_calls_path.read_text(encoding="utf-8")
    tool_calls_tree = ast.parse(tool_calls_source, filename=str(tool_calls_path))

    if "PostgresToolCallReadRepository" not in tool_calls_source:
        errors.append(
            "backend/persistence/tool_calls.py must define "
            "PostgresToolCallReadRepository",
        )
        return errors

    required_methods = {
        "list_tool_calls": [
            "FROM tool_calls",
            "WHERE tenant_id = %s",
            "agent_run_id = %s",
            "tool_id = %s",
            "allowed = %s",
            "approval_id = %s",
        ],
        "get_tool_call": [
            "FROM tool_calls",
            "WHERE tenant_id = %s AND id = %s",
        ],
    }
    required_arguments = {
        "list_tool_calls": {"tenant_id"},
        "get_tool_call": {"tenant_id", "tool_call_id"},
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            tool_calls_tree,
            class_name="PostgresToolCallReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL tool call read repository missing method: "
                "backend/persistence/tool_calls.py:"
                f"PostgresToolCallReadRepository.{method_name}",
            )
            continue
        method_arguments = {
            argument.arg
            for argument in [*method_node.args.args, *method_node.args.kwonlyargs]
        }
        for required_argument in required_arguments[method_name]:
            if required_argument not in method_arguments:
                errors.append(
                    "PostgreSQL tool call read method must accept required scope: "
                    "backend/persistence/tool_calls.py:"
                    f"PostgresToolCallReadRepository.{method_name}",
                )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL tool call read method must read through PostgreSQL: "
                "backend/persistence/tool_calls.py:"
                f"PostgresToolCallReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL tool call read method must query expected tool "
                    "call tables and filters: backend/persistence/tool_calls.py:"
                    f"PostgresToolCallReadRepository.{method_name}",
                )

    return errors


def _check_postgres_tool_governance_reads_guarded() -> list[str]:
    errors: list[str] = []
    tools_path = PERSISTENCE_DIR / "tools.py"
    tools_source = tools_path.read_text(encoding="utf-8")
    tools_tree = ast.parse(tools_source, filename=str(tools_path))

    if "PostgresToolGovernanceReadRepository" not in tools_source:
        errors.append(
            "backend/persistence/tools.py must define "
            "PostgresToolGovernanceReadRepository",
        )
        return errors

    required_methods = {
        "list_tools": [
            "FROM tools",
            "WHERE tenant_id = %s",
            "status = %s",
        ],
        "get_tool": [
            "FROM tools",
            "WHERE tenant_id = %s AND id = %s",
        ],
        "get_tool_by_name": [
            "FROM tools",
            "WHERE tenant_id = %s AND name = %s",
        ],
        "list_policies": [
            "FROM tool_policies",
            "WHERE tenant_id = %s",
        ],
        "get_policy_for_tool": [
            "FROM tool_policies",
            "WHERE tenant_id = %s AND tool_id = %s",
        ],
        "get_policy_for_tool_name": [
            "FROM tool_policies",
            "INNER JOIN tools",
            "tool_policies.tenant_id = %s",
            "tools.tenant_id = %s",
            "tools.name = %s",
        ],
    }
    required_arguments = {
        "list_tools": {"tenant_id"},
        "get_tool": {"tenant_id", "tool_id"},
        "get_tool_by_name": {"tenant_id", "name"},
        "list_policies": {"tenant_id"},
        "get_policy_for_tool": {"tenant_id", "tool_id"},
        "get_policy_for_tool_name": {"tenant_id", "tool_name"},
    }
    for method_name, sql_tokens in required_methods.items():
        method_node = _find_class_method(
            tools_tree,
            class_name="PostgresToolGovernanceReadRepository",
            method_name=method_name,
        )
        if method_node is None:
            errors.append(
                "PostgreSQL tool governance read repository missing method: "
                "backend/persistence/tools.py:"
                f"PostgresToolGovernanceReadRepository.{method_name}",
            )
            continue
        method_arguments = {
            argument.arg
            for argument in [*method_node.args.args, *method_node.args.kwonlyargs]
        }
        for required_argument in required_arguments[method_name]:
            if required_argument not in method_arguments:
                errors.append(
                    "PostgreSQL tool governance read method must accept required scope: "
                    "backend/persistence/tools.py:"
                    f"PostgresToolGovernanceReadRepository.{method_name}",
                )
        if not _method_uses_database_call(method_node, "connect"):
            errors.append(
                "PostgreSQL tool governance read method must read through PostgreSQL: "
                "backend/persistence/tools.py:"
                f"PostgresToolGovernanceReadRepository.{method_name}",
            )
        normalized_sql = " ".join(_normalized_sql_literals(method_node))
        for sql_token in sql_tokens:
            if sql_token.lower() not in normalized_sql:
                errors.append(
                    "PostgreSQL tool governance read method must query expected "
                    "tenant-scoped tool tables and filters: backend/persistence/tools.py:"
                    f"PostgresToolGovernanceReadRepository.{method_name}",
                )

    return errors


def _find_class_method(
    tree: ast.AST,
    *,
    class_name: str,
    method_name: str,
) -> ast.FunctionDef | ast.AsyncFunctionDef | None:
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef) or node.name != class_name:
            continue
        for child in node.body:
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == method_name:
                return child
    return None


def _append_capped_returns_after_postgres_memory_write(
    method_node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> bool:
    for child in method_node.body:
        if not isinstance(child, ast.If):
            continue
        has_postgres_write = False
        has_return = False
        for body_node in ast.walk(child):
            if isinstance(body_node, ast.Call):
                function = body_node.func
                if isinstance(function, ast.Attribute) and function.attr == "append_memory_item":
                    has_postgres_write = True
            if isinstance(body_node, ast.Return):
                has_return = True
        if has_postgres_write and has_return:
            return True
    return False


def main() -> int:
    sql = _read_migrations()
    schema = _extract_schema(sql)

    errors = [
        *_check_required_tables(schema),
        *_check_required_repositories(),
        *_check_authoritative_postgres_repositories(),
        *_check_authoritative_postgres_persistence_repositories(),
        *_check_postgres_persistence_repository_inventory(),
        *_check_postgres_persistence_exports(),
        *_check_postgres_url_detection_boundary(),
        *_check_postgres_write_transaction_boundary(),
        *_check_postgres_read_tenant_boundary(),
        *_check_postgres_runtime_provider_reads_wired(),
        *_check_postgres_runtime_invocation_writes_wired(),
        *_check_postgres_tool_calls_wired(),
        *_check_postgres_tool_policy_wired(),
        *_check_postgres_memory_item_writes_wired(),
        *_check_postgres_audit_events_wired(),
        *_check_postgres_retrieval_events_wired(),
        *_check_postgres_workflow_runs_wired(),
        *_check_postgres_agent_catalog_wired(),
        *_check_postgres_agent_runs_wired(),
        *_check_postgres_approval_requests_wired(),
        *_check_postgres_knowledge_readiness_wired(),
        *_check_postgres_knowledge_ingestion_write_records(),
        *_check_postgres_knowledge_audit_write_records(),
        *_check_postgres_service_audit_write_records(),
        *_check_postgres_members_wired(),
        *_check_postgres_memory_policy_reads_guarded(),
        *_check_postgres_model_config_reads_guarded(),
        *_check_postgres_knowledge_base_reads_guarded(),
        *_check_postgres_document_reads_guarded(),
        *_check_postgres_document_chunk_reads_guarded(),
        *_check_postgres_embedding_record_reads_guarded(),
        *_check_postgres_memory_item_reads_guarded(),
        *_check_postgres_retrieval_event_reads_guarded(),
        *_check_postgres_workflow_run_reads_guarded(),
        *_check_postgres_workflow_template_reads_guarded(),
        *_check_postgres_agent_catalog_reads_guarded(),
        *_check_postgres_agent_run_reads_guarded(),
        *_check_postgres_approval_request_reads_guarded(),
        *_check_postgres_membership_reads_guarded(),
        *_check_postgres_runtime_reads_guarded(),
        *_check_postgres_tool_call_reads_guarded(),
        *_check_postgres_tool_governance_reads_guarded(),
    ]
    warnings = _collect_warnings(schema)

    print("Phase 2 production data-layer coverage")
    print(f"- migrations scanned: {len(list(MIGRATIONS_DIR.glob('*.sql')))}")
    print(f"- required tables covered: {len(REQUIRED_TABLES) - len([e for e in errors if e.startswith('missing migration table')])}/{len(REQUIRED_TABLES)}")
    print(f"- required repositories covered: {len(REQUIRED_REPOSITORIES) - len([e for e in errors if e.startswith('missing persistence repository')])}/{len(REQUIRED_REPOSITORIES)}")
    authoritative_repository_count = sum(
        len(classes)
        for classes in POSTGRES_AUTHORITATIVE_REPOSITORIES.values()
    )
    authoritative_persistence_count = sum(
        len(classes)
        for classes in POSTGRES_AUTHORITATIVE_PERSISTENCE_REPOSITORIES.values()
    )
    print(
        "- authoritative PostgreSQL adapters guarded: "
        f"{authoritative_repository_count + authoritative_persistence_count}",
    )
    print("- PostgreSQL URL detection centralized: yes")
    print("- PostgreSQL write transaction boundary guarded: yes")
    print("- PostgreSQL read tenant boundary guarded: yes")
    print("- PostgreSQL runtime provider reads wired: yes")
    print("- PostgreSQL runtime invocation writes wired: yes")
    print("- PostgreSQL tool calls wired: yes")
    print("- PostgreSQL tool policy write-through wired: yes")
    print("- PostgreSQL memory item writes wired: yes")
    print("- PostgreSQL audit events wired: yes")
    print("- PostgreSQL retrieval events wired: yes")
    print("- PostgreSQL workflow runs wired: yes")
    print("- PostgreSQL agent catalog wired: yes")
    print("- PostgreSQL agent runs wired: yes")
    print("- PostgreSQL approval requests wired: yes")
    print("- PostgreSQL knowledge readiness reads wired: yes")
    print("- PostgreSQL knowledge ingestion write records: yes")
    print("- PostgreSQL knowledge audit write records: yes")
    print("- PostgreSQL service audit write records: yes")
    print("- PostgreSQL members wired: yes")
    print("- PostgreSQL memory policy reads guarded: yes")
    print("- PostgreSQL model config reads guarded: yes")
    print("- PostgreSQL knowledge base reads guarded: yes")
    print("- PostgreSQL document reads guarded: yes")
    print("- PostgreSQL document chunk reads guarded: yes")
    print("- PostgreSQL embedding record reads guarded: yes")
    print("- PostgreSQL memory item reads guarded: yes")
    print("- PostgreSQL retrieval event reads guarded: yes")
    print("- PostgreSQL workflow run reads guarded: yes")
    print("- PostgreSQL workflow template reads guarded: yes")
    print("- PostgreSQL agent catalog reads guarded: yes")
    print("- PostgreSQL agent run reads guarded: yes")
    print("- PostgreSQL approval request reads guarded: yes")
    print("- PostgreSQL membership reads guarded: yes")
    print("- PostgreSQL runtime reads guarded: yes")
    print("- PostgreSQL tool call reads guarded: yes")
    print("- PostgreSQL tool governance reads guarded: yes")
    print(f"- known PostgreSQL tenant read gaps tracked: {POSTGRES_TENANT_SCOPED_READ_KNOWN_GAP_COUNT}")

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
