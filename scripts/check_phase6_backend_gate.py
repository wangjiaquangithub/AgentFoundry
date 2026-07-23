#!/usr/bin/env python3
"""Run the backend-focused production gate for Phase 6."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("backend compile", [sys.executable, "-m", "compileall", "backend"]),
    (
        "tenant access boundary",
        [sys.executable, "scripts/check_phase6_tenant_access_boundary.py"],
    ),
    (
        "audit event immutability",
        [sys.executable, "scripts/check_phase6_audit_event_immutability.py"],
    ),
    (
        "structured request logging",
        [sys.executable, "scripts/check_phase6_request_logging.py"],
    ),
    (
        "backend logging configuration",
        [sys.executable, "scripts/check_phase6_logging_config.py"],
    ),
    (
        "correlated API error responses",
        [sys.executable, "scripts/check_phase6_error_handling.py"],
    ),
    (
        "secret hygiene",
        [sys.executable, "scripts/check_phase6_secret_hygiene.py"],
    ),
    (
        "deployment environment contract",
        [sys.executable, "scripts/check_phase6_deployment_env_contract.py"],
    ),
    (
        "production-safe server configuration",
        [sys.executable, "scripts/check_phase6_server_config.py"],
    ),
    (
        "README bootstrap",
        [sys.executable, "scripts/check_phase6_readme_bootstrap.py"],
    ),
    (
        "backend production gates CI workflow",
        [sys.executable, "scripts/check_phase6_backend_ci_workflow.py"],
    ),
    (
        "runtime provider health",
        [sys.executable, "scripts/check_phase4_runtime_provider_health.py"],
    ),
    (
        "agent document readiness",
        [sys.executable, "scripts/check_phase3_agent_document_readiness.py"],
    ),
)


def main() -> int:
    for label, command in CHECKS:
        printable = " ".join(command)
        print(f"[phase6-backend-gate] {label}: {printable}")
        subprocess.run(command, cwd=ROOT, check=True)

    print("[phase6-backend-gate] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
