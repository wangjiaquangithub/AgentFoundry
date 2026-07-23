#!/usr/bin/env python3
"""Validate liveness and readiness HTTP status semantics for Phase 6."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[1]
BACKEND_README = ROOT / "backend" / "README.md"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class StubResponse:
    def __init__(self) -> None:
        self.status_code = 200


class StubRouter:
    def __init__(self, **_kwargs: Any) -> None:
        self.routes: list[SimpleNamespace] = []

    def get(self, path: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def register(endpoint: Callable[..., Any]) -> Callable[..., Any]:
            self.routes.append(SimpleNamespace(path=path, endpoint=endpoint))
            return endpoint

        return register


fastapi_stub = ModuleType("fastapi")
fastapi_stub.APIRouter = StubRouter
fastapi_stub.Response = StubResponse
fastapi_stub.status = SimpleNamespace(
    HTTP_200_OK=200,
    HTTP_503_SERVICE_UNAVAILABLE=503,
)
sys.modules.setdefault("fastapi", fastapi_stub)

from backend.api import health as health_module  # noqa: E402
from backend.persistence import database as database_module  # noqa: E402
from backend.persistence.database import (  # noqa: E402
    DATABASE_URL_ENV_VAR,
    DatabaseReadinessStatus,
    inspect_configured_database_status,
)


def _route_endpoint(path: str, database_readiness=None):
    router = health_module.create_health_router(database_readiness)
    for route in router.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"health router is missing {path}")


def check_behavior() -> list[str]:
    errors: list[str] = []
    health_endpoint = _route_endpoint("/health")

    health_payload = asyncio.run(health_endpoint())
    if health_payload != {"status": "ok"}:
        errors.append("/health must remain a pure liveness response")

    base_status = inspect_configured_database_status({})
    unavailable = DatabaseReadinessStatus(
        configuration=base_status,
        connected=False,
        ready=False,
        message=base_status.message,
    )
    unavailable_endpoint = _route_endpoint("/ready", lambda: unavailable)
    unavailable_response = StubResponse()
    unavailable_payload = unavailable_endpoint(unavailable_response)
    if unavailable_response.status_code != 503:
        errors.append("/ready must return HTTP 503 when database configuration is unavailable")
    if unavailable_payload.get("status") != "not_ready":
        errors.append("unavailable /ready payload must report not_ready")
    if unavailable_payload.get("database", {}).get("connected") is not False:
        errors.append("unavailable /ready payload must report connected=false")

    configured_status = database_module.DatabaseConfigurationStatus(
        env_var=DATABASE_URL_ENV_VAR,
        deployment_env_var=database_module.DEPLOYMENT_ENV_VAR,
        production_mode=True,
        configured=True,
        scheme="postgresql",
        backend="postgresql",
        required_backend="postgresql",
        production_ready=True,
        driver_package="psycopg",
        driver_available=True,
        runtime_ready=True,
        operator_ready=True,
        message="Configured for PostgreSQL production persistence.",
    )
    failed = DatabaseReadinessStatus(
        configuration=configured_status,
        connected=False,
        ready=False,
        message="PostgreSQL connection check failed.",
    )
    failed_endpoint = _route_endpoint("/ready", lambda: failed)
    failed_response = StubResponse()
    failed_payload = failed_endpoint(failed_response)
    if failed_response.status_code != 503:
        errors.append("/ready must return HTTP 503 when the live connection check fails")
    if failed_payload.get("database", {}).get("runtime_ready") is not True:
        errors.append("failed live checks must preserve runtime configuration status")
    if failed_payload.get("database", {}).get("connected") is not False:
        errors.append("failed live checks must report connected=false")

    ready = DatabaseReadinessStatus(
        configuration=configured_status,
        connected=True,
        ready=True,
        message="PostgreSQL connection check passed.",
    )
    ready_endpoint = _route_endpoint("/ready", lambda: ready)
    ready_response = StubResponse()
    ready_payload = ready_endpoint(ready_response)
    if ready_response.status_code != 200:
        errors.append("/ready must return HTTP 200 when the live connection check succeeds")
    if ready_payload.get("status") != "ready":
        errors.append("available /ready payload must report ready")
    if ready_payload.get("database", {}).get("connected") is not True:
        errors.append("available /ready payload must report connected=true")

    return errors


class FakeCursor:
    def __init__(self, *, row: Any = (1,), failure: Exception | None = None) -> None:
        self.row = row
        self.failure = failure
        self.executed: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, *_args: Any) -> None:
        return None

    def execute(self, statement: str) -> None:
        self.executed.append(statement)
        if self.failure is not None:
            raise self.failure

    def fetchone(self) -> Any:
        return self.row


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


class FakeDatabase:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection
        self.timeouts: list[int | None] = []

    def connect(self, *, connect_timeout_seconds: int | None = None) -> FakeConnection:
        self.timeouts.append(connect_timeout_seconds)
        return self.connection


def check_live_database_contract() -> list[str]:
    errors: list[str] = []
    database_url = "postgresql://agentfoundry:agentfoundry@localhost:5432/agentfoundry"
    environment = {DATABASE_URL_ENV_VAR: database_url}
    original_driver_check = database_module.is_postgres_driver_available
    original_factory = database_module.create_postgres_database
    try:
        database_module.is_postgres_driver_available = lambda: True

        cursor = FakeCursor()
        connection = FakeConnection(cursor)
        database = FakeDatabase(connection)
        database_module.create_postgres_database = lambda _url: database
        readiness = database_module.inspect_configured_database_readiness(environment)
        if not readiness.ready or not readiness.connected:
            errors.append("a successful SELECT 1 must make the database ready")
        if cursor.executed != ["SELECT 1"]:
            errors.append("database readiness must execute exactly SELECT 1")
        if database.timeouts != [3]:
            errors.append("database readiness must use the documented 3-second connect timeout")
        if not connection.closed:
            errors.append("database readiness must close successful probe connections")

        failed_cursor = FakeCursor(failure=RuntimeError(f"leaked DSN: {database_url}"))
        failed_connection = FakeConnection(failed_cursor)
        failed_database = FakeDatabase(failed_connection)
        database_module.create_postgres_database = lambda _url: failed_database
        failed_readiness = database_module.inspect_configured_database_readiness(environment)
        if failed_readiness.ready or failed_readiness.connected:
            errors.append("query failures must fail database readiness closed")
        if failed_readiness.message != "PostgreSQL connection check failed.":
            errors.append("database readiness failures must use a safe generic message")
        if database_url in failed_readiness.message or "leaked DSN" in failed_readiness.message:
            errors.append("database readiness failures must not expose connection details")
        if not failed_connection.closed:
            errors.append("database readiness must close connections after query failures")
    finally:
        database_module.is_postgres_driver_available = original_driver_check
        database_module.create_postgres_database = original_factory
    return errors


def check_documentation_and_gate() -> list[str]:
    readme = BACKEND_README.read_text(encoding="utf-8")
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    for phrase in (
        "`GET /health`",
        "`GET /ready`",
        "`SELECT 1`",
        "3 秒连接超时",
        "`database.connected=true`",
        "HTTP 503",
    ):
        if phrase not in readme:
            errors.append(f"backend/README.md is missing probe documentation: {phrase}")
    if "scripts/check_phase6_health_probes.py" not in gate:
        errors.append("Phase 6 backend gate must run the health probe check")
    return errors


def main() -> int:
    errors = check_behavior() + check_live_database_contract() + check_documentation_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-health-probes] {error}", file=sys.stderr)
        return 1
    print("[phase6-health-probes] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
