"""Health check endpoints for production deployment probes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Response, status

from backend.persistence.database import (
    DatabaseReadinessStatus,
    inspect_configured_database_readiness,
)


def create_health_router(
    database_readiness: Callable[[], DatabaseReadinessStatus] | None = None,
) -> APIRouter:
    """Return a router with liveness and readiness probes."""

    router = APIRouter(tags=["health"])
    readiness_probe = database_readiness or inspect_configured_database_readiness

    @router.get("/health")
    async def health_check() -> dict[str, str]:
        """Liveness probe: returns 200 if the process is running."""
        return {"status": "ok"}

    @router.get("/ready")
    def readiness_check(response: Response) -> dict[str, Any]:
        """Readiness probe: checks live production database connectivity."""
        readiness = readiness_probe()
        db_status = readiness.configuration
        if not readiness.ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "ready" if readiness.ready else "not_ready",
            "database": {
                "configured": db_status.configured,
                "backend": db_status.backend,
                "production_ready": db_status.production_ready,
                "runtime_ready": db_status.runtime_ready,
                "connected": readiness.connected,
                "message": readiness.message,
            },
        }

    return router
