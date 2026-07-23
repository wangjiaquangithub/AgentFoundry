#!/usr/bin/env python3
"""Validate the Phase 6 backend logging configuration contract."""

from __future__ import annotations

import ast
import logging
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MAIN_MODULE = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from logging_config import (  # noqa: E402
    DEFAULT_LOG_LEVEL,
    LOG_LEVEL_ENV_VAR,
    configure_backend_logging,
    resolve_log_level,
)


def check_log_level_resolution() -> list[str]:
    errors: list[str] = []
    cases = (
        ({}, logging.INFO, "default"),
        ({LOG_LEVEL_ENV_VAR: "debug"}, logging.DEBUG, "case-insensitive DEBUG"),
        ({LOG_LEVEL_ENV_VAR: " WARNING "}, logging.WARNING, "trimmed WARNING"),
        ({LOG_LEVEL_ENV_VAR: "NOTSET"}, logging.INFO, "unsupported level fallback"),
        ({LOG_LEVEL_ENV_VAR: "10\nERROR"}, logging.INFO, "unsafe level fallback"),
    )
    for environ, expected, label in cases:
        actual = resolve_log_level(environ)
        if actual != expected:
            errors.append(f"{label} resolved to {actual}, expected {expected}")
    if DEFAULT_LOG_LEVEL != "INFO":
        errors.append(f"default log level must remain INFO: {DEFAULT_LOG_LEVEL!r}")
    return errors


def check_configuration_is_idempotent() -> list[str]:
    root_logger = logging.getLogger()
    agentfoundry_logger = logging.getLogger("agentfoundry")
    original_handlers = list(root_logger.handlers)
    original_root_level = root_logger.level
    original_agentfoundry_level = agentfoundry_logger.level
    original_propagate = agentfoundry_logger.propagate

    try:
        root_logger.handlers.clear()
        configured_level = configure_backend_logging({LOG_LEVEL_ENV_VAR: "INFO"})
        first_handlers = list(root_logger.handlers)
        configure_backend_logging({LOG_LEVEL_ENV_VAR: "INFO"})

        errors: list[str] = []
        if configured_level != logging.INFO or root_logger.level != logging.INFO:
            errors.append("configuration must enable INFO records on the root logger")
        if agentfoundry_logger.level != logging.INFO or not agentfoundry_logger.propagate:
            errors.append("agentfoundry logger must emit INFO records through the root logger")
        if len(first_handlers) != 1 or root_logger.handlers != first_handlers:
            errors.append("repeated configuration must not add duplicate handlers")
        if not logging.getLogger("agentfoundry.requests").isEnabledFor(logging.INFO):
            errors.append("agentfoundry.requests INFO records must be enabled")
        return errors
    finally:
        root_logger.handlers.clear()
        root_logger.handlers.extend(original_handlers)
        root_logger.setLevel(original_root_level)
        agentfoundry_logger.setLevel(original_agentfoundry_level)
        agentfoundry_logger.propagate = original_propagate


def check_main_configures_logging_after_local_env() -> list[str]:
    tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))
    imported = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "logging_config"
        and any(alias.name == "configure_backend_logging" for alias in node.names)
        for node in ast.walk(tree)
    )
    calls = [
        node.value.func.id
        for node in tree.body
        if isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
        and node.value.func.id in {"load_local_env", "configure_backend_logging"}
    ]

    errors: list[str] = []
    if not imported:
        errors.append("backend/main.py must import configure_backend_logging")
    if calls[:2] != ["load_local_env", "configure_backend_logging"]:
        errors.append(
            "backend/main.py must configure logging immediately after loading local env"
        )
    return errors


def check_phase6_gate_wires_check() -> list[str]:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_logging_config.py" not in source:
        return ["Phase 6 backend gate must run check_phase6_logging_config.py"]
    return []


def main() -> int:
    errors: list[str] = []
    errors.extend(check_log_level_resolution())
    errors.extend(check_configuration_is_idempotent())
    errors.extend(check_main_configures_logging_after_local_env())
    errors.extend(check_phase6_gate_wires_check())

    if errors:
        for error in errors:
            print(f"[phase6-logging-config] {error}", file=sys.stderr)
        return 1

    print("[phase6-logging-config] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
