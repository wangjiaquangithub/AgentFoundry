#!/usr/bin/env python3
"""Validate that README bootstrap docs match the production local path."""

from __future__ import annotations

import os
import stat
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTGRES_URL = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def require_contains(label: str, text: str, needles: list[str]) -> list[str]:
    failures: list[str] = []
    for needle in needles:
        if needle not in text:
            failures.append(f"{label} is missing {needle!r}")
    return failures


def require_script_contract(relative_path: str) -> list[str]:
    path = ROOT / relative_path
    failures: list[str] = []

    if not path.exists():
        return [f"{relative_path} does not exist"]

    mode = path.stat().st_mode
    if not mode & stat.S_IXUSR:
        failures.append(f"{relative_path} is not executable by the owner")

    text = path.read_text(encoding="utf-8")
    failures.extend(
        require_contains(
            relative_path,
            text,
            [
                "#!/usr/bin/env bash",
                "set -euo pipefail",
            ],
        )
    )
    return failures


def require_database_script(relative_path: str) -> list[str]:
    text = read_text(relative_path)
    failures = require_script_contract(relative_path)
    failures.extend(
        require_contains(
            relative_path,
            text,
            [
                "AGENTFOUNDRY_DATABASE_URL",
                POSTGRES_URL,
                "postgresql://*|postgres://*",
                "sqlite://*",
                "psycopg[binary]",
            ],
        )
    )
    if "PostgreSQL is the production target" not in text:
        failures.append(f"{relative_path} must state PostgreSQL is the production target")
    if "local development compatibility" not in text:
        failures.append(f"{relative_path} must limit SQLite to local development compatibility")
    return failures


def require_empty_env_values(env_text: str, names: list[str]) -> list[str]:
    failures: list[str] = []
    lines = {
        line.split("=", 1)[0]: line.split("=", 1)[1]
        for line in env_text.splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    }
    for name in names:
        if name not in lines:
            failures.append(f"backend/.env.example is missing {name}")
        elif lines[name].strip():
            failures.append(f"backend/.env.example must leave {name} empty")
    return failures


def main() -> int:
    readme = read_text("README.md")
    backend_readme = read_text("backend/README.md")
    env_example = read_text("backend/.env.example")
    failures: list[str] = []

    failures.extend(
        require_contains(
            "README.md",
            readme,
            [
                "./scripts/start_agentfoundry.sh",
                "./scripts/smoke_agentfoundry.sh",
                "./scripts/migrate_agentfoundry.sh",
                "./scripts/seed_agentfoundry.sh",
                "AGENTFOUNDRY_DATABASE_URL",
                POSTGRES_URL,
                "/platform",
                "AGENTSCOPE_DIR",
                "PostgreSQL is the production database target",
                "Local JSON/JSONL files",
                "development fixtures",
                "sqlite://",
            ],
        )
    )
    failures.extend(
        require_contains(
            "backend/README.md",
            backend_readme,
            [
                "AgentFoundry",
                "PostgreSQL",
                "AGENTFOUNDRY_DATABASE_URL",
                POSTGRES_URL,
                "./scripts/migrate_agentfoundry.sh",
            ],
        )
    )
    failures.extend(
        require_contains(
            "backend/.env.example",
            env_example,
            [
                "AGENTFOUNDRY_DATABASE_URL=" + POSTGRES_URL,
                "# AGENTFOUNDRY_DATABASE_URL=sqlite:///backend/data/agentfoundry.db",
                "PostgreSQL is the production target",
                "SQLite is only for local development",
            ],
        )
    )
    failures.extend(
        require_empty_env_values(
            env_example,
            [
                "ENTERPRISE_AGENT_ROUTER_API_KEY",
                "ENTERPRISE_API_TOKEN",
                "QDRANT_API_KEY",
            ],
        )
    )

    for script in (
        "scripts/start_agentfoundry.sh",
        "scripts/smoke_agentfoundry.sh",
    ):
        failures.extend(require_script_contract(script))

    failures.extend(require_database_script("scripts/migrate_agentfoundry.sh"))
    failures.extend(require_database_script("scripts/seed_agentfoundry.sh"))

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print("phase 6 README bootstrap check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
