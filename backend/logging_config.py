"""Backend logging configuration for AgentFoundry observability."""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from typing import Any


LOG_LEVEL_ENV_VAR = "AGENTFOUNDRY_LOG_LEVEL"
DEFAULT_LOG_LEVEL = "INFO"
SUPPORTED_LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


def resolve_log_level(environ: Mapping[str, Any] | None = None) -> int:
    """Resolve a supported log level, falling back safely to INFO."""

    source = os.environ if environ is None else environ
    configured = str(source.get(LOG_LEVEL_ENV_VAR, DEFAULT_LOG_LEVEL)).strip().upper()
    return SUPPORTED_LOG_LEVELS.get(configured, logging.INFO)


def configure_backend_logging(environ: Mapping[str, Any] | None = None) -> int:
    """Configure backend logging without adding duplicate stream handlers."""

    level = resolve_log_level(environ)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if not root_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(handler)

    agentfoundry_logger = logging.getLogger("agentfoundry")
    agentfoundry_logger.setLevel(level)
    agentfoundry_logger.propagate = True
    return level
