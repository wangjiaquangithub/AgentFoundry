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
        "agent catalog request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_catalog_request_tenant.py",
        ],
    ),
    (
        "model config request tenant",
        [
            sys.executable,
            "scripts/check_phase6_model_config_request_tenant.py",
        ],
    ),
    (
        "knowledge request tenant",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_request_tenant.py",
        ],
    ),
    (
        "tool request tenant",
        [
            sys.executable,
            "scripts/check_phase6_tool_request_tenant.py",
        ],
    ),
    (
        "workflow request tenant",
        [
            sys.executable,
            "scripts/check_phase6_workflow_request_tenant.py",
        ],
    ),
    (
        "agent execution request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_execution_request_tenant.py",
        ],
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
        "production request identity authentication",
        [sys.executable, "scripts/check_phase6_request_authentication.py"],
    ),
    (
        "canonical request identity consumption",
        [sys.executable, "scripts/check_phase6_request_identity_consumption.py"],
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
        "health probe HTTP semantics",
        [sys.executable, "scripts/check_phase6_health_probes.py"],
    ),
    (
        "completed agent run audit contract",
        [sys.executable, "scripts/check_phase6_agent_run_audit.py"],
    ),
    (
        "approval mutation audit contract",
        [sys.executable, "scripts/check_phase6_approval_audit.py"],
    ),
    (
        "model config mutation audit contract",
        [sys.executable, "scripts/check_phase6_model_config_audit.py"],
    ),
    (
        "tool call audit contract",
        [sys.executable, "scripts/check_phase6_tool_call_audit.py"],
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
