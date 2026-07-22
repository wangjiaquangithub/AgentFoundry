#!/usr/bin/env python3
"""Run the backend production gates across completed non-UI phases."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("phase 2 production data layer", (sys.executable, "scripts/check_phase2_backend_gate.py")),
    ("phase 3 enterprise knowledge backend", (sys.executable, "scripts/check_phase3_backend_gate.py")),
    ("phase 4 runtime adapter backend", (sys.executable, "scripts/check_phase4_backend_gate.py")),
    ("phase 6 governance backend", (sys.executable, "scripts/check_phase6_backend_gate.py")),
)


def run_check(label: str, command: tuple[str, ...]) -> None:
    print(f"[backend-production-gates] {label}: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    for label, command in CHECKS:
        run_check(label, command)

    print("[backend-production-gates] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
