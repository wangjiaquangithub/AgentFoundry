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
        "PostgreSQL URL boundary",
        (sys.executable, "scripts/check_phase2_postgres_url_boundary.py"),
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
