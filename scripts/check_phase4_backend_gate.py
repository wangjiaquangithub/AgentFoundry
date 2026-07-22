#!/usr/bin/env python3
"""Run the backend-focused runtime adapter checks for Phase 4."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("backend compile", (sys.executable, "-m", "compileall", "backend")),
    (
        "runtime invocation evidence",
        (sys.executable, "scripts/check_phase4_runtime_invocation_evidence.py"),
    ),
    (
        "runtime provider health",
        (sys.executable, "scripts/check_phase4_runtime_provider_health.py"),
    ),
    (
        "runtime provider config gate",
        (sys.executable, "scripts/check_phase4_runtime_provider_config_gate.py"),
    ),
    (
        "runtime provider status config gate",
        (
            sys.executable,
            "scripts/check_phase4_runtime_provider_status_config_gate.py",
        ),
    ),
    (
        "runtime pending config gate",
        (sys.executable, "scripts/check_phase4_runtime_pending_config_gate.py"),
    ),
    (
        "adapter-backed local invocation",
        (sys.executable, "scripts/check_phase4_adapter_backed_local_invocation.py"),
    ),
    (
        "runtime invocation error contract",
        (sys.executable, "scripts/check_phase4_runtime_invocation_error_contract.py"),
    ),
    (
        "provider-native invocation client seam",
        (
            sys.executable,
            "scripts/check_phase4_provider_native_invocation_client.py",
        ),
    ),
    (
        "adapter invocation pending result",
        (
            sys.executable,
            "scripts/check_phase4_adapter_invocation_pending_result.py",
        ),
    ),
    (
        "adapter pending result persistence",
        (
            sys.executable,
            "scripts/check_phase4_adapter_pending_result_persistence.py",
        ),
    ),
    (
        "runtime adapter API contract",
        (sys.executable, "scripts/check_phase4_runtime_api_contract.py"),
    ),
    (
        "runtime adapter invoke boundary",
        (sys.executable, "scripts/check_phase4_runtime_invoke_boundary.py"),
    ),
    (
        "agent run invoke boundary",
        (sys.executable, "scripts/check_phase4_agent_run_invoke_boundary.py"),
    ),
    (
        "agent run runtime context",
        (sys.executable, "scripts/check_phase4_agent_run_runtime_context.py"),
    ),
    (
        "runtime invocation request context contract",
        (
            sys.executable,
            "scripts/check_phase4_runtime_invocation_request_context_contract.py",
        ),
    ),
    (
        "runtime invocation context persistence guard",
        (
            sys.executable,
            "scripts/check_phase4_runtime_invocation_context_persistence_guard.py",
        ),
    ),
    (
        "runtime invocation read redaction",
        (
            sys.executable,
            "scripts/check_phase4_runtime_invocation_read_redaction.py",
        ),
    ),
)


def run_check(label: str, command: tuple[str, ...]) -> None:
    print(f"[phase4-backend-gate] {label}: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    for label, command in CHECKS:
        run_check(label, command)
    print("[phase4-backend-gate] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
