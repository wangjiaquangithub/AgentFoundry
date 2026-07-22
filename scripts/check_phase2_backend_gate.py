#!/usr/bin/env python3
"""Run the Phase 2 backend production data-layer checks.

This gate is intentionally static and PostgreSQL-first. It verifies the
production data-layer contracts without requiring local database credentials.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("backend compile", (sys.executable, "-m", "compileall", "backend")),
    (
        "PostgreSQL migrations",
        (sys.executable, "scripts/check_phase2_postgres_migrations.py"),
    ),
    (
        "PostgreSQL migration planning",
        (sys.executable, "scripts/check_phase2_postgres_migration_plan.py"),
    ),
    (
        "PostgreSQL URL boundary",
        (sys.executable, "scripts/check_phase2_postgres_url_boundary.py"),
    ),
    (
        "PostgreSQL configuration status",
        (sys.executable, "scripts/check_phase2_postgres_config_status.py"),
    ),
    (
        "PostgreSQL runtime dependencies",
        (sys.executable, "scripts/check_phase2_postgres_runtime_dependencies.py"),
    ),
    (
        "PostgreSQL production mode guard",
        (sys.executable, "scripts/check_phase2_postgres_production_mode_guard.py"),
    ),
    (
        "PostgreSQL seed migration toggle",
        (sys.executable, "scripts/check_phase2_postgres_seed_migration_toggle.py"),
    ),
    (
        "PostgreSQL seed completeness",
        (sys.executable, "scripts/check_phase2_postgres_seed_completeness.py"),
    ),
    (
        "PostgreSQL repository transaction contract",
        (
            sys.executable,
            "scripts/check_phase2_postgres_repository_transaction_contract.py",
        ),
    ),
    (
        "PostgreSQL model config write exposure",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_write_exposure.py",
        ),
    ),
    (
        "PostgreSQL model config service contract",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_service_contract.py",
        ),
    ),
    (
        "PostgreSQL model config service behavior",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_service_behavior.py",
        ),
    ),
    (
        "PostgreSQL model config service factory",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_service_factory.py",
        ),
    ),
    (
        "PostgreSQL model config API command boundary",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_api_command_boundary.py",
        ),
    ),
    (
        "PostgreSQL model config API route boundary",
        (
            sys.executable,
            "scripts/check_phase2_postgres_model_config_api_route.py",
        ),
    ),
    (
        "PostgreSQL composition boundary",
        (
            sys.executable,
            "scripts/check_phase2_postgres_composition_boundary.py",
        ),
    ),
    (
        "PostgreSQL index contract",
        (sys.executable, "scripts/check_phase2_postgres_index_contract.py"),
    ),
    (
        "platform database status",
        (sys.executable, "scripts/check_phase2_platform_database_status.py"),
    ),
    (
        "PostgreSQL docs contract",
        (sys.executable, "scripts/check_phase2_postgres_docs_contract.py"),
    ),
    ("production data layer", (sys.executable, "scripts/check_phase2_data_layer.py")),
)


def run_check(label: str, command: tuple[str, ...]) -> None:
    print(f"[phase2-backend-gate] {label}: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    for label, command in CHECKS:
        run_check(label, command)
    print("[phase2-backend-gate] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
