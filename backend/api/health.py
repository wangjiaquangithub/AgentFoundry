"""Health check endpoints for production deployment probes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from backend.persistence.database import inspect_configured_database_status


def create_health_router() -> APIRouter:
    """Return a router with liveness and readiness probes."""

    router = APIRouter(tags=["health"])

    @router.get("/health")
    async def health_check() -> dict[str, str]:
        """Liveness probe: returns 200 if the process is running."""
        return {"status": "ok"}

    @router.get("/ready")
    async def readiness_check() -> dict[str, Any]:
        """Readiness probe: checks database configuration status."""
        db_status = inspect_configured_database_status()
        return {
            "status": "ready" if db_status.runtime_ready else "not_ready",
            "database": {
                "configured": db_status.configured,
                "backend": db_status.backend,
                "production_ready": db_status.production_ready,
                "runtime_ready": db_status.runtime_ready,
                "message": db_status.message,
            },
        }

    return router
