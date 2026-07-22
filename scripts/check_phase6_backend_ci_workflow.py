#!/usr/bin/env python3
"""Validate the backend production gate GitHub Actions workflow contract."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ".github/workflows/backend-production-gates.yml"

REQUIRED_SNIPPETS = (
    "name: Backend production gates",
    "pull_request:",
    "push:",
    "branches:",
    "- main",
    '- "codex/**"',
    "paths:",
    '- "backend/**"',
    '- "docs/**"',
    '- "scripts/**"',
    '- ".github/workflows/backend-production-gates.yml"',
    "actions/checkout@v4",
    "actions/setup-python@v5",
    'python-version: "3.11"',
    "run: python3 -m compileall backend",
    "run: python3 scripts/check_backend_production_gates.py",
)


def main() -> int:
    path = ROOT / WORKFLOW
    failures: list[str] = []

    if not path.exists():
        print(f"FAIL: {WORKFLOW} does not exist", file=sys.stderr)
        return 1

    text = path.read_text(encoding="utf-8")
    for snippet in REQUIRED_SNIPPETS:
        if snippet not in text:
            failures.append(f"{WORKFLOW} is missing {snippet!r}")

    if text.count("run: python3 scripts/check_backend_production_gates.py") != 1:
        failures.append(f"{WORKFLOW} must run the backend production gate exactly once")

    if text.find("run: python3 -m compileall backend") > text.find(
        "run: python3 scripts/check_backend_production_gates.py"
    ):
        failures.append(f"{WORKFLOW} must compile backend before running production gates")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print("phase 6 backend CI workflow check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
