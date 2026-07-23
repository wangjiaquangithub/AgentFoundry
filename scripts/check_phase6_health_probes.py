#!/usr/bin/env python3
"""Validate liveness and readiness HTTP status semantics for Phase 6."""

from __future__ import annotations

import asyncio
import sys
from dataclasses import replace
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
from backend.persistence.database import inspect_configured_database_status  # noqa: E402


def _route_endpoint(path: str):
    router = health_module.create_health_router()
    for route in router.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"health router is missing {path}")


def check_behavior() -> list[str]:
    errors: list[str] = []
    health_endpoint = _route_endpoint("/health")
    ready_endpoint = _route_endpoint("/ready")

    health_payload = asyncio.run(health_endpoint())
    if health_payload != {"status": "ok"}:
        errors.append("/health must remain a pure liveness response")

    base_status = inspect_configured_database_status({})
    original_inspector = health_module.inspect_configured_database_status
    try:
        health_module.inspect_configured_database_status = lambda: base_status
        unavailable_response = StubResponse()
        unavailable_payload = asyncio.run(ready_endpoint(unavailable_response))
        if unavailable_response.status_code != 503:
            errors.append("/ready must return HTTP 503 when the database runtime is unavailable")
        if unavailable_payload.get("status") != "not_ready":
            errors.append("unavailable /ready payload must report not_ready")

        ready_status = replace(
            base_status,
            configured=True,
            backend="postgresql",
            production_ready=True,
            driver_package="psycopg",
            driver_available=True,
            runtime_ready=True,
            operator_ready=True,
            message="Configured for PostgreSQL production persistence.",
        )
        health_module.inspect_configured_database_status = lambda: ready_status
        ready_response = StubResponse()
        ready_payload = asyncio.run(ready_endpoint(ready_response))
        if ready_response.status_code != 200:
            errors.append("/ready must return HTTP 200 when the database runtime is ready")
        if ready_payload.get("status") != "ready":
            errors.append("available /ready payload must report ready")
    finally:
        health_module.inspect_configured_database_status = original_inspector

    return errors


def check_documentation_and_gate() -> list[str]:
    readme = BACKEND_README.read_text(encoding="utf-8")
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    for phrase in (
        "`GET /health`",
        "`GET /ready`",
        "HTTP 503",
    ):
        if phrase not in readme:
            errors.append(f"backend/README.md is missing probe documentation: {phrase}")
    if "scripts/check_phase6_health_probes.py" not in gate:
        errors.append("Phase 6 backend gate must run the health probe check")
    return errors


def main() -> int:
    errors = check_behavior() + check_documentation_and_gate()
    if errors:
        for error in errors:
            print(f"[phase6-health-probes] {error}", file=sys.stderr)
        return 1
    print("[phase6-health-probes] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
