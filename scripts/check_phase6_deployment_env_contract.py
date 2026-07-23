#!/usr/bin/env python3
"""Validate the checked-in deployment environment template contract."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_EXAMPLE = ROOT / "backend" / ".env.example"
BACKEND_README = ROOT / "backend" / "README.md"

REQUIRED_VALUES = {
    "AGENTFOUNDRY_ENV": "development",
    "AGENTFOUNDRY_LOG_LEVEL": "INFO",
    "AGENTFOUNDRY_DATABASE_URL": (
        "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
    ),
    "HOST": "0.0.0.0",
    "PORT": "8000",
    "UVICORN_RELOAD": "1",
    "CORS_ALLOW_ORIGINS": "*",
}
REQUIRED_EMPTY_ENV_VARS = {
    "ENTERPRISE_AGENT_ROUTER_API_KEY",
    "ENTERPRISE_API_TOKEN",
    "QDRANT_API_KEY",
    "REDIS_PASSWORD",
}


def parse_env(text: str) -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    failures: list[str] = []
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            failures.append(f"backend/.env.example:{line_no} is not KEY=VALUE")
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        if name in values:
            failures.append(f"backend/.env.example defines {name} more than once")
            continue
        values[name] = value.strip()
    return values, failures


def main() -> int:
    env_text = ENV_EXAMPLE.read_text(encoding="utf-8")
    readme = BACKEND_README.read_text(encoding="utf-8")
    values, failures = parse_env(env_text)

    for name, expected in REQUIRED_VALUES.items():
        actual = values.get(name)
        if actual != expected:
            failures.append(
                f"backend/.env.example must define {name}={expected}; got {actual!r}"
            )

    for name in sorted(REQUIRED_EMPTY_ENV_VARS):
        actual = values.get(name)
        if actual is None:
            failures.append(f"backend/.env.example is missing {name}")
        elif actual:
            failures.append(f"backend/.env.example must leave {name} empty")

    required_guidance = (
        "AGENTFOUNDRY_ENV=production",
        "Production mode",
        "PostgreSQL",
        "SQLite is only for local development",
    )
    for phrase in required_guidance:
        if phrase not in env_text:
            failures.append(f"backend/.env.example is missing guidance {phrase!r}")

    for name in REQUIRED_VALUES:
        if f"`{name}`" not in readme:
            failures.append(f"backend/README.md does not document {name}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print("phase 6 deployment environment contract check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
