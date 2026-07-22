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
        "adapter-backed local invocation",
        (sys.executable, "scripts/check_phase4_adapter_backed_local_invocation.py"),
    ),
    (
        "runtime invocation error contract",
        (sys.executable, "scripts/check_phase4_runtime_invocation_error_contract.py"),
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
