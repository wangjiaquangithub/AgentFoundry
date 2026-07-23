#!/usr/bin/env python3
"""Validate production-safe backend server configuration."""

from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MAIN_MODULE = BACKEND_DIR / "main.py"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"
BACKEND_README = BACKEND_DIR / "README.md"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from server_config import ServerConfigurationError, resolve_server_config  # noqa: E402


def check_behavior() -> list[str]:
    errors: list[str] = []
    development = resolve_server_config({})
    if development.reload is not True:
        errors.append("development must preserve reload by default")
    if development.cors_allow_origins != ("*",):
        errors.append("development must preserve wildcard CORS by default")

    production = resolve_server_config(
        {
            "AGENTFOUNDRY_ENV": "production",
            "UVICORN_RELOAD": "0",
            "CORS_ALLOW_ORIGINS": (
                "https://console.example.com, https://admin.example.com,"
                "https://console.example.com"
            ),
            "HOST": "127.0.0.1",
            "PORT": "9000",
            "AGENTFOUNDRY_IDENTITY_PROXY_SECRET": "x" * 32,
        }
    )
    if production.reload or not production.production_mode:
        errors.append("valid production settings were not resolved safely")
    if production.cors_allow_origins != (
        "https://console.example.com",
        "https://admin.example.com",
    ):
        errors.append("CORS origins must be trimmed and deduplicated")
    if production.host != "127.0.0.1" or production.port != 9000:
        errors.append("host and port must be resolved into the server contract")

    rejected_cases = (
        (
            {
                "AGENTFOUNDRY_ENV": "production",
                "UVICORN_RELOAD": "1",
                "CORS_ALLOW_ORIGINS": "https://console.example.com",
            },
            "production reload",
        ),
        (
            {
                "AGENTFOUNDRY_ENV": "production",
                "UVICORN_RELOAD": "0",
                "CORS_ALLOW_ORIGINS": "*",
            },
            "production wildcard CORS",
        ),
        (
            {
                "AGENTFOUNDRY_ENV": "production",
                "UVICORN_RELOAD": "0",
                "CORS_ALLOW_ORIGINS": " , ",
            },
            "production empty CORS",
        ),
        ({"UVICORN_RELOAD": "sometimes"}, "invalid reload boolean"),
        ({"PORT": "70000"}, "invalid port"),
        (
            {
                "AGENTFOUNDRY_ENV": "production",
                "UVICORN_RELOAD": "0",
                "CORS_ALLOW_ORIGINS": "https://console.example.com",
            },
            "production missing identity proxy secret",
        ),
        (
            {
                "AGENTFOUNDRY_ENV": "production",
                "UVICORN_RELOAD": "0",
                "CORS_ALLOW_ORIGINS": "https://console.example.com",
                "AGENTFOUNDRY_IDENTITY_PROXY_SECRET": "x" * 31,
            },
            "production short identity proxy secret",
        ),
    )
    for environ, label in rejected_cases:
        try:
            resolve_server_config(environ)
        except ServerConfigurationError:
            continue
        errors.append(f"{label} must be rejected")
    return errors


def check_main_wiring() -> list[str]:
    tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))
    source = MAIN_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    imported = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "server_config"
        and any(alias.name == "resolve_server_config" for alias in node.names)
        for node in ast.walk(tree)
    )
    if not imported or "server_config = resolve_server_config()" not in source:
        errors.append("backend/main.py must resolve the shared server configuration")
    forbidden_fragments = (
        'os.getenv("CORS_ALLOW_ORIGINS"',
        'os.getenv("UVICORN_RELOAD"',
        'os.getenv("HOST"',
        'os.getenv("PORT"',
    )
    for fragment in forbidden_fragments:
        if fragment in source:
            errors.append(f"backend/main.py bypasses server_config with {fragment}")
    required_fragments = (
        "allow_origins=list(server_config.cors_allow_origins)",
        "host=server_config.host",
        "port=server_config.port",
        "reload=server_config.reload",
    )
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"backend/main.py is missing server wiring: {fragment}")
    return errors


def check_documentation_and_gate() -> list[str]:
    env_text = ENV_EXAMPLE.read_text(encoding="utf-8")
    readme = BACKEND_README.read_text(encoding="utf-8")
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    for phrase in (
        "UVICORN_RELOAD=0",
        "CORS_ALLOW_ORIGINS=https://console.example.com",
        "AGENTFOUNDRY_IDENTITY_PROXY_SECRET=",
        "Production mode rejects reload, wildcard CORS, and an empty CORS allowlist.",
    ):
        if phrase not in env_text:
            errors.append(f"backend/.env.example is missing {phrase!r}")
    for phrase in (
        "生产环境必须设为 `0`",
        "生产环境必须显式列出 origin",
        "AGENTFOUNDRY_ENV=production",
        "AGENTFOUNDRY_IDENTITY_PROXY_SECRET",
    ):
        if phrase not in readme:
            errors.append(f"backend/README.md is missing {phrase!r}")
    if "scripts/check_phase6_server_config.py" not in gate:
        errors.append("Phase 6 backend gate must run the server configuration check")
    return errors


def main() -> int:
    errors = check_behavior() + check_main_wiring() + check_documentation_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-server-config] {error}", file=sys.stderr)
        return 1
    print("[phase6-server-config] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
