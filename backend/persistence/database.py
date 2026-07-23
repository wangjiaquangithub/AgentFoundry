"""Database connection and transaction helpers for persistence repositories."""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator, Mapping
from importlib.util import find_spec
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from backend.persistence.database_urls import (
    POSTGRES_DATABASE_SCHEMES,
    has_postgres_database_name,
    is_postgres_database_url,
)
from backend.persistence.migrations import sqlite_path_from_database_url

DATABASE_URL_ENV_VAR = "AGENTFOUNDRY_DATABASE_URL"
DEPLOYMENT_ENV_VAR = "AGENTFOUNDRY_ENV"
PRODUCTION_ENV_VALUES = frozenset({"prod", "production"})


def is_production_environment(environ: Mapping[str, str] | None = None) -> bool:
    source = os.environ if environ is None else environ
    return source.get(DEPLOYMENT_ENV_VAR, "").strip().lower() in PRODUCTION_ENV_VALUES


@dataclass(frozen=True)
class DatabaseConfigurationStatus:
    """Database configuration status that is safe to expose in health checks."""

    env_var: str
    deployment_env_var: str
    production_mode: bool
    configured: bool
    scheme: str | None
    backend: str
    required_backend: str
    production_ready: bool
    driver_package: str | None
    driver_available: bool
    runtime_ready: bool
    operator_ready: bool
    message: str


@dataclass(frozen=True)
class DatabaseReadinessStatus:
    """Result of a live database readiness probe without connection details."""

    configuration: DatabaseConfigurationStatus
    connected: bool
    ready: bool
    message: str


def is_postgres_driver_available() -> bool:
    return find_spec("psycopg") is not None


def inspect_configured_database_status(
    environ: Mapping[str, str] | None = None,
) -> DatabaseConfigurationStatus:
    source = os.environ if environ is None else environ
    database_url = source.get(DATABASE_URL_ENV_VAR, "").strip()
    production_mode = is_production_environment(source)
    if not database_url:
        return DatabaseConfigurationStatus(
            env_var=DATABASE_URL_ENV_VAR,
            deployment_env_var=DEPLOYMENT_ENV_VAR,
            production_mode=production_mode,
            configured=False,
            scheme=None,
            backend="unconfigured",
            required_backend="postgresql",
            production_ready=False,
            driver_package=None,
            driver_available=False,
            runtime_ready=False,
            operator_ready=False,
            message=(
                "Set AGENTFOUNDRY_DATABASE_URL to postgresql:// for the "
                "production data layer."
            ),
        )

    scheme = urlparse(database_url).scheme or None
    if is_postgres_database_url(database_url):
        driver_available = is_postgres_driver_available()
        has_database_name = has_postgres_database_name(database_url)
        return DatabaseConfigurationStatus(
            env_var=DATABASE_URL_ENV_VAR,
            deployment_env_var=DEPLOYMENT_ENV_VAR,
            production_mode=production_mode,
            configured=True,
            scheme=scheme,
            backend="postgresql",
            required_backend="postgresql",
            production_ready=has_database_name,
            driver_package="psycopg",
            driver_available=driver_available,
            runtime_ready=has_database_name and driver_available,
            operator_ready=has_database_name and driver_available,
            message=(
                "Configured for PostgreSQL production persistence."
                if has_database_name and driver_available
                else (
                    "Configured for PostgreSQL, but AGENTFOUNDRY_DATABASE_URL "
                    "must include an explicit database name."
                    if not has_database_name
                    else "Configured for PostgreSQL, but the psycopg driver is not available."
                )
            ),
        )

    if scheme == "sqlite":
        return DatabaseConfigurationStatus(
            env_var=DATABASE_URL_ENV_VAR,
            deployment_env_var=DEPLOYMENT_ENV_VAR,
            production_mode=production_mode,
            configured=True,
            scheme=scheme,
            backend="sqlite",
            required_backend="postgresql",
            production_ready=False,
            driver_package=None,
            driver_available=False,
            runtime_ready=False,
            operator_ready=False,
            message="sqlite:// is only for explicit local development compatibility.",
        )

    return DatabaseConfigurationStatus(
        env_var=DATABASE_URL_ENV_VAR,
        deployment_env_var=DEPLOYMENT_ENV_VAR,
        production_mode=production_mode,
        configured=True,
        scheme=scheme,
        backend="unsupported",
        required_backend="postgresql",
        production_ready=False,
        driver_package=None,
        driver_available=False,
        runtime_ready=False,
        operator_ready=False,
        message=(
            "Unsupported database URL scheme. Use postgresql:// for production "
            "or sqlite:// for explicit local development compatibility."
        ),
    )


@dataclass(frozen=True)
class SQLiteDatabase:
    """Small database boundary used by phase 2 repository work."""

    database_url: str

    @property
    def path(self) -> Path:
        return sqlite_path_from_database_url(self.database_url)

    def connect(self) -> sqlite3.Connection:
        database_path = self.path
        if str(database_path) != ":memory:":
            database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(str(database_path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        connection = self.connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()


def create_sqlite_database(database_url: str) -> SQLiteDatabase:
    return SQLiteDatabase(database_url=database_url)


@dataclass(frozen=True)
class PostgresDatabase:
    """Production PostgreSQL transaction boundary for phase 2 repositories."""

    database_url: str

    def connect(self, *, connect_timeout_seconds: int | None = None) -> Any:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "PostgreSQL database access requires the optional psycopg "
                "package. Install psycopg before using postgresql:// or "
                "postgres:// persistence URLs."
            ) from exc

        connection_options: dict[str, Any] = {"row_factory": dict_row}
        if connect_timeout_seconds is not None:
            connection_options["connect_timeout"] = connect_timeout_seconds
        return psycopg.connect(self.database_url, **connection_options)

    @contextmanager
    def transaction(self) -> Iterator[Any]:
        connection = self.connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()


def create_postgres_database(database_url: str) -> PostgresDatabase:
    if not is_postgres_database_url(database_url):
        raise ValueError("PostgreSQL database URLs must use postgresql:// or postgres://.")
    if not has_postgres_database_name(database_url):
        raise ValueError("PostgreSQL database URLs must include an explicit database name.")
    return PostgresDatabase(database_url=database_url)


def create_configured_postgres_database(
    environ: Mapping[str, str] | None = None,
) -> PostgresDatabase | None:
    source = os.environ if environ is None else environ
    database_url = source.get(DATABASE_URL_ENV_VAR, "").strip()
    require_postgres_database_for_production(source)
    if not is_postgres_database_url(database_url):
        return None
    return create_postgres_database(database_url)


def inspect_configured_database_readiness(
    environ: Mapping[str, str] | None = None,
    *,
    connect_timeout_seconds: int = 3,
) -> DatabaseReadinessStatus:
    """Check that the configured production database accepts a simple query."""

    source = os.environ if environ is None else environ
    configuration = inspect_configured_database_status(source)
    if not configuration.runtime_ready:
        return DatabaseReadinessStatus(
            configuration=configuration,
            connected=False,
            ready=False,
            message=configuration.message,
        )

    database_url = source.get(DATABASE_URL_ENV_VAR, "").strip()
    try:
        database = create_postgres_database(database_url)
        connection = database.connect(
            connect_timeout_seconds=connect_timeout_seconds,
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                row = cursor.fetchone()
            if row is None:
                raise RuntimeError("Database readiness query returned no row.")
        finally:
            connection.close()
    except Exception:
        return DatabaseReadinessStatus(
            configuration=configuration,
            connected=False,
            ready=False,
            message="PostgreSQL connection check failed.",
        )

    return DatabaseReadinessStatus(
        configuration=configuration,
        connected=True,
        ready=True,
        message="PostgreSQL connection check passed.",
    )


def require_postgres_database_for_production(
    environ: Mapping[str, str] | None = None,
) -> DatabaseConfigurationStatus:
    status = inspect_configured_database_status(environ)
    if not status.production_mode:
        return status

    if not status.configured:
        raise RuntimeError(
            "AGENTFOUNDRY_ENV=production requires AGENTFOUNDRY_DATABASE_URL "
            "to use postgresql:// or postgres://."
        )
    if status.backend == "sqlite":
        raise RuntimeError(
            "AGENTFOUNDRY_ENV=production cannot use sqlite://. Configure "
            "AGENTFOUNDRY_DATABASE_URL with postgresql:// or postgres://."
        )
    if status.backend == "postgresql" and not status.production_ready:
        raise RuntimeError(
            "AGENTFOUNDRY_ENV=production requires a PostgreSQL URL with an "
            "explicit database name."
        )
    if status.production_ready and not status.operator_ready:
        raise RuntimeError(
            "AGENTFOUNDRY_ENV=production requires PostgreSQL runtime readiness. "
            "Install psycopg before using postgresql:// or postgres:// persistence URLs."
        )
    if status.production_ready:
        return status
    raise RuntimeError(
        "AGENTFOUNDRY_ENV=production requires PostgreSQL persistence. Configure "
        "AGENTFOUNDRY_DATABASE_URL with postgresql:// or postgres://."
    )


def _environment_with_database_url(
    database_url: str,
    environ: Mapping[str, str] | None,
) -> dict[str, str]:
    source = os.environ if environ is None else environ
    configured = dict(source)
    configured[DATABASE_URL_ENV_VAR] = database_url
    return configured


def create_database(
    database_url: str,
    environ: Mapping[str, str] | None = None,
) -> SQLiteDatabase | PostgresDatabase:
    if is_production_environment(environ):
        require_postgres_database_for_production(
            _environment_with_database_url(database_url, environ)
        )

    parsed = urlparse(database_url)
    if is_postgres_database_url(database_url):
        return create_postgres_database(database_url)
    if parsed.scheme == "sqlite":
        return create_sqlite_database(database_url)
    raise ValueError(
        "Unsupported database URL scheme. Use postgresql:// for production "
        "or sqlite:// for explicit local development compatibility."
    )
