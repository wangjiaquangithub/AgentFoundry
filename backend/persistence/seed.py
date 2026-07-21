"""Seed local development data into the persistence baseline.

The seed command treats JSON files as development inputs only. It does not
replace repository storage or make local JSON the production source of truth.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from backend.persistence.migrations import (
    apply_migrations,
    sqlite_path_from_database_url,
)


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TENANT_FIXTURE_PATH = BACKEND_DIR / "fixtures" / "tenant_data.local.json"
DEFAULT_AGENTS_PATH = BACKEND_DIR / "data" / "platform_agents.json"
DEFAULT_TOOL_POLICY_PATH = BACKEND_DIR / "data" / "platform_tool_policy.json"


@dataclass
class SeedSummary:
    tenants: int = 0
    users: int = 0
    memberships: int = 0
    tools: int = 0
    tool_policies: int = 0
    memory_policies: int = 0
    runtime_providers: int = 0
    agents: int = 0
    agent_versions: int = 0
    updated_agent_versions: int = 0
    warnings: list[str] = field(default_factory=list)


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as json_file:
        return json.load(json_file)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def tenant_from_user_id(user_id: str) -> str | None:
    tenant, separator, _ = user_id.partition(":")
    if not separator or not tenant:
        return None
    return tenant


def display_name_from_user_id(user_id: str) -> str:
    _, _, local_part = user_id.partition(":")
    label = local_part or user_id
    return label.replace(".", " ").replace("_", " ").title()


def email_from_user_id(user_id: str) -> str | None:
    tenant = tenant_from_user_id(user_id)
    _, _, local_part = user_id.partition(":")
    if not tenant or not local_part:
        return None
    return f"{local_part}@{tenant}.local"


def normalize_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def extract_tenants(tenant_fixture: dict[str, Any], agents: list[dict[str, Any]]) -> set[str]:
    tenants = set(tenant_fixture.get("tenants", {}).keys())
    tenants.update(
        str(agent.get("tenant"))
        for agent in agents
        if isinstance(agent, dict) and agent.get("tenant")
    )
    return tenants


def extract_user_ids(
    agents: list[dict[str, Any]],
    tool_policy: dict[str, Any],
) -> set[str]:
    user_ids = {
        str(agent.get("created_by"))
        for agent in agents
        if isinstance(agent, dict) and agent.get("created_by")
    }
    for tenant_policy in tool_policy.get("tenants", {}).values():
        users = tenant_policy.get("users", {})
        if isinstance(users, dict):
            user_ids.update(str(user_id) for user_id in users.keys())
    return user_ids


def seed_development_data(
    *,
    database_url: str,
    tenant_fixture_path: Path = DEFAULT_TENANT_FIXTURE_PATH,
    agents_path: Path = DEFAULT_AGENTS_PATH,
    tool_policy_path: Path = DEFAULT_TOOL_POLICY_PATH,
    apply_schema_migrations: bool = True,
) -> SeedSummary:
    if apply_schema_migrations:
        apply_migrations(database_url)

    database_path = sqlite_path_from_database_url(database_url)
    if str(database_path) == ":memory:":
        raise ValueError("The seed command requires a file-backed SQLite database.")

    tenant_fixture = load_json(tenant_fixture_path, {"tenants": {}})
    agents = load_json(agents_path, [])
    tool_policy = load_json(tool_policy_path, {"tenants": {}})
    if not isinstance(agents, list):
        raise ValueError(f"Expected a list in {agents_path}")

    summary = SeedSummary()
    timestamp = now_iso()
    tenants = extract_tenants(tenant_fixture, agents)
    user_ids = extract_user_ids(agents, tool_policy)

    database_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(database_path)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            summary.tenants = upsert_tenants(connection, tenants, timestamp)
            summary.users = upsert_users(connection, user_ids, timestamp)
            summary.memberships = upsert_memberships(connection, user_ids, timestamp)
            summary.memory_policies = upsert_memory_policies(
                connection,
                tenants,
                timestamp,
            )
            summary.runtime_providers = upsert_runtime_providers(
                connection,
                timestamp,
            )
            summary.tools, summary.tool_policies = upsert_tools_and_policies(
                connection,
                tool_policy,
                timestamp,
            )
            (
                summary.agents,
                summary.agent_versions,
                summary.updated_agent_versions,
                summary.warnings,
            ) = upsert_agents(connection, agents, user_ids, timestamp)
    return summary


def upsert_tenants(
    connection: sqlite3.Connection,
    tenants: set[str],
    timestamp: str,
) -> int:
    for tenant_id in sorted(tenants):
        connection.execute(
            """
            INSERT INTO tenants (id, name, status, plan, created_at, updated_at)
            VALUES (?, ?, 'active', 'development', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              status = excluded.status,
              plan = excluded.plan,
              updated_at = excluded.updated_at
            """,
            (tenant_id, tenant_id.title(), timestamp, timestamp),
        )
    return len(tenants)


def upsert_users(
    connection: sqlite3.Connection,
    user_ids: set[str],
    timestamp: str,
) -> int:
    for user_id in sorted(user_ids):
        connection.execute(
            """
            INSERT INTO users (id, display_name, email, status, created_at, updated_at)
            VALUES (?, ?, ?, 'active', ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              display_name = excluded.display_name,
              email = excluded.email,
              status = excluded.status,
              updated_at = excluded.updated_at
            """,
            (
                user_id,
                display_name_from_user_id(user_id),
                email_from_user_id(user_id),
                timestamp,
                timestamp,
            ),
        )
    return len(user_ids)


def upsert_memberships(
    connection: sqlite3.Connection,
    user_ids: set[str],
    timestamp: str,
) -> int:
    count = 0
    for user_id in sorted(user_ids):
        tenant_id = tenant_from_user_id(user_id)
        if not tenant_id:
            continue
        connection.execute(
            """
            INSERT INTO memberships (
              id, tenant_id, user_id, role, workspace_ids, created_at, updated_at
            )
            VALUES (?, ?, ?, 'admin', '[]', ?, ?)
            ON CONFLICT(tenant_id, user_id) DO UPDATE SET
              role = excluded.role,
              workspace_ids = excluded.workspace_ids,
              updated_at = excluded.updated_at
            """,
            (
                f"{tenant_id}:{user_id}",
                tenant_id,
                user_id,
                timestamp,
                timestamp,
            ),
        )
        count += 1
    return count


def upsert_memory_policies(
    connection: sqlite3.Connection,
    tenants: set[str],
    timestamp: str,
) -> int:
    for tenant_id in sorted(tenants):
        connection.execute(
            """
            INSERT INTO memory_policies (
              id, tenant_id, name, scope, retention_days, write_mode,
              read_roles, created_at, updated_at
            )
            VALUES (?, ?, 'Development default memory', 'tenant_user_agent', 90,
              'runtime_assisted', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              scope = excluded.scope,
              retention_days = excluded.retention_days,
              write_mode = excluded.write_mode,
              read_roles = excluded.read_roles,
              updated_at = excluded.updated_at
            """,
            (
                f"{tenant_id}:default-memory",
                tenant_id,
                normalize_json(["admin", "member"]),
                timestamp,
                timestamp,
            ),
        )
    return len(tenants)


def upsert_runtime_providers(
    connection: sqlite3.Connection,
    timestamp: str,
) -> int:
    connection.execute(
        """
        INSERT INTO runtime_providers (
          id, name, provider_type, mode, status, capabilities, config_ref,
          created_at, updated_at
        )
        VALUES ('local-dev-runtime', 'Local development runtime', 'local',
          'in_process', 'active', ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider_type = excluded.provider_type,
          mode = excluded.mode,
          status = excluded.status,
          capabilities = excluded.capabilities,
          updated_at = excluded.updated_at
        """,
        (
            normalize_json(
                {
                    "agent_runs": True,
                    "tool_calls": True,
                    "development_only": True,
                }
            ),
            timestamp,
            timestamp,
        ),
    )
    return 1


def upsert_tools_and_policies(
    connection: sqlite3.Connection,
    tool_policy: dict[str, Any],
    timestamp: str,
) -> tuple[int, int]:
    tool_count = 0
    policy_count = 0
    tenant_policies = tool_policy.get("tenants", {})
    if not isinstance(tenant_policies, dict):
        return tool_count, policy_count

    for tenant_id, tenant_policy in sorted(tenant_policies.items()):
        allowed_tools = tenant_policy.get("allow", [])
        if not isinstance(allowed_tools, list):
            continue
        for tool_name in sorted(str(tool_name) for tool_name in allowed_tools):
            tool_id = f"{tenant_id}:{tool_name}"
            connection.execute(
                """
                INSERT INTO tools (
                  id, tenant_id, name, description, category, schema, status,
                  created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 'enterprise', '{}', 'active', ?, ?)
                ON CONFLICT(tenant_id, name) DO UPDATE SET
                  description = excluded.description,
                  category = excluded.category,
                  schema = excluded.schema,
                  status = excluded.status,
                  updated_at = excluded.updated_at
                """,
                (
                    tool_id,
                    tenant_id,
                    tool_name,
                    f"Development seed for {tool_name}",
                    timestamp,
                    timestamp,
                ),
            )
            tool_count += 1
            connection.execute(
                """
                INSERT INTO tool_policies (
                  id, tenant_id, tool_id, allowed_roles, approval_required,
                  rate_limit, data_access_scope, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 0, NULL, 'tenant', ?, ?)
                ON CONFLICT(tenant_id, tool_id) DO UPDATE SET
                  allowed_roles = excluded.allowed_roles,
                  approval_required = excluded.approval_required,
                  data_access_scope = excluded.data_access_scope,
                  updated_at = excluded.updated_at
                """,
                (
                    f"{tool_id}:policy",
                    tenant_id,
                    tool_id,
                    normalize_json(["admin", "member"]),
                    timestamp,
                    timestamp,
                ),
            )
            policy_count += 1
    return tool_count, policy_count


def upsert_agents(
    connection: sqlite3.Connection,
    agents: list[dict[str, Any]],
    user_ids: set[str],
    timestamp: str,
) -> tuple[int, int, int, list[str]]:
    warnings: list[str] = []
    agent_count = 0
    version_count = 0
    version_update_count = 0

    for agent in agents:
        agent_id = str(agent.get("id") or "")
        tenant_id = str(agent.get("tenant") or "")
        owner_user_id = str(agent.get("created_by") or "")
        if not agent_id or not tenant_id or not owner_user_id:
            warnings.append(f"skipped agent with missing identity fields: {agent!r}")
            continue
        if owner_user_id not in user_ids:
            warnings.append(f"skipped agent {agent_id}: unknown owner {owner_user_id}")
            continue

        created_at = str(agent.get("created_at") or timestamp)
        updated_at = str(agent.get("updated_at") or created_at)
        version_id = f"{agent_id}:v1"
        memory_policy_id = (
            f"{tenant_id}:default-memory" if agent.get("memory_enabled") else None
        )
        connection.execute(
            """
            INSERT INTO agents (
              id, tenant_id, name, description, status, owner_user_id,
              current_version_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenant_id = excluded.tenant_id,
              name = excluded.name,
              description = excluded.description,
              status = excluded.status,
              owner_user_id = excluded.owner_user_id,
              updated_at = excluded.updated_at
            """,
            (
                agent_id,
                tenant_id,
                str(agent.get("name") or agent_id),
                str(agent.get("description") or ""),
                str(agent.get("status") or "draft"),
                owner_user_id,
                created_at,
                updated_at,
            ),
        )
        agent_count += 1

        previous_version = connection.execute(
            "SELECT id FROM agent_versions WHERE id = ?",
            (version_id,),
        ).fetchone()
        connection.execute(
            """
            INSERT INTO agent_versions (
              id, tenant_id, agent_id, version, instructions, model_config_id,
              runtime_provider, tool_ids, knowledge_base_ids, memory_policy_id,
              created_by, created_at
            )
            VALUES (?, ?, ?, 1, ?, NULL, 'local-dev-runtime', ?, ?, ?, ?, ?)
            ON CONFLICT(tenant_id, agent_id, version) DO UPDATE SET
              instructions = excluded.instructions,
              runtime_provider = excluded.runtime_provider,
              tool_ids = excluded.tool_ids,
              knowledge_base_ids = excluded.knowledge_base_ids,
              memory_policy_id = excluded.memory_policy_id
            """,
            (
                version_id,
                tenant_id,
                agent_id,
                str(agent.get("description") or agent.get("name") or agent_id),
                normalize_json(agent.get("tools") or []),
                normalize_json(agent.get("knowledge_base_ids") or []),
                memory_policy_id,
                owner_user_id,
                created_at,
            ),
        )
        if previous_version:
            version_update_count += 1
        else:
            version_count += 1
        connection.execute(
            """
            UPDATE agents
            SET current_version_id = ?
            WHERE id = ?
            """,
            (version_id, agent_id),
        )
    return agent_count, version_count, version_update_count, warnings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed AgentFoundry development data into SQLite.",
    )
    parser.add_argument(
        "--database-url",
        default="sqlite:///backend/data/agentfoundry.db",
        help="SQLite URL for the local persistence baseline.",
    )
    parser.add_argument(
        "--tenant-fixture-path",
        type=Path,
        default=DEFAULT_TENANT_FIXTURE_PATH,
        help="Development tenant fixture JSON path.",
    )
    parser.add_argument(
        "--agents-path",
        type=Path,
        default=DEFAULT_AGENTS_PATH,
        help="Development platform agents JSON path.",
    )
    parser.add_argument(
        "--tool-policy-path",
        type=Path,
        default=DEFAULT_TOOL_POLICY_PATH,
        help="Development tool policy JSON path.",
    )
    parser.add_argument(
        "--skip-migrations",
        action="store_true",
        help="Skip applying schema migrations before seeding.",
    )
    args = parser.parse_args()

    summary = seed_development_data(
        database_url=args.database_url,
        tenant_fixture_path=args.tenant_fixture_path,
        agents_path=args.agents_path,
        tool_policy_path=args.tool_policy_path,
        apply_schema_migrations=not args.skip_migrations,
    )
    print(
        "seeded "
        f"tenants={summary.tenants} "
        f"users={summary.users} "
        f"memberships={summary.memberships} "
        f"tools={summary.tools} "
        f"tool_policies={summary.tool_policies} "
        f"memory_policies={summary.memory_policies} "
        f"runtime_providers={summary.runtime_providers} "
        f"agents={summary.agents} "
        f"agent_versions={summary.agent_versions} "
        f"updated_agent_versions={summary.updated_agent_versions}"
    )
    for warning in summary.warnings:
        print(f"warning: {warning}")


if __name__ == "__main__":
    main()
