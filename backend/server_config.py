"""Deployment-safe HTTP server configuration for AgentFoundry."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any


PRODUCTION_ENV_VALUES = frozenset({"prod", "production"})
TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
FALSE_VALUES = frozenset({"0", "false", "no", "off"})


class ServerConfigurationError(ValueError):
    """Raised when deployment server settings are unsafe or invalid."""


@dataclass(frozen=True)
class ServerConfig:
    """Resolved server settings shared by ASGI middleware and Uvicorn."""

    deployment_environment: str
    host: str
    port: int
    reload: bool
    cors_allow_origins: tuple[str, ...]

    @property
    def production_mode(self) -> bool:
        return self.deployment_environment in PRODUCTION_ENV_VALUES


def _parse_boolean(name: str, raw_value: Any, *, default: str) -> bool:
    value = str(default if raw_value is None else raw_value).strip().lower()
    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False
    supported = ", ".join(sorted(TRUE_VALUES | FALSE_VALUES))
    raise ServerConfigurationError(f"{name} must be one of: {supported}")


def _parse_port(raw_value: Any) -> int:
    value = str("8000" if raw_value is None else raw_value).strip()
    try:
        port = int(value)
    except ValueError as exc:
        raise ServerConfigurationError("PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ServerConfigurationError("PORT must be between 1 and 65535")
    return port


def _parse_cors_origins(raw_value: Any) -> tuple[str, ...]:
    value = "*" if raw_value is None else str(raw_value)
    origins = tuple(dict.fromkeys(part.strip() for part in value.split(",") if part.strip()))
    return origins


def resolve_server_config(environ: Mapping[str, Any] | None = None) -> ServerConfig:
    """Resolve server settings and reject unsafe production defaults."""

    source = os.environ if environ is None else environ
    deployment_environment = str(
        source.get("AGENTFOUNDRY_ENV", "development")
    ).strip().lower()
    config = ServerConfig(
        deployment_environment=deployment_environment,
        host=str(source.get("HOST", "0.0.0.0")).strip() or "0.0.0.0",
        port=_parse_port(source.get("PORT")),
        reload=_parse_boolean(
            "UVICORN_RELOAD",
            source.get("UVICORN_RELOAD"),
            default="1",
        ),
        cors_allow_origins=_parse_cors_origins(source.get("CORS_ALLOW_ORIGINS")),
    )

    if not config.production_mode:
        return config
    if config.reload:
        raise ServerConfigurationError(
            "UVICORN_RELOAD must be disabled in production; set UVICORN_RELOAD=0"
        )
    if not config.cors_allow_origins or "*" in config.cors_allow_origins:
        raise ServerConfigurationError(
            "CORS_ALLOW_ORIGINS must list explicit origins in production; "
            "wildcard and empty values are not allowed"
        )
    return config
