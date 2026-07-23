"""Structured request logging middleware for production observability."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

LOGGER = logging.getLogger("agentfoundry.requests")


class StructuredRequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log each HTTP request as a structured JSON record.

    Captures method, path, status, duration in milliseconds, and the
    tenant/user context from request headers when available.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start = time.perf_counter()
        response: Response | None = None
        error_detail: str | None = None

        try:
            response = await call_next(request)
        except Exception as exc:
            error_detail = str(exc)
            raise
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            record = self._build_record(request, response, duration_ms, error_detail)
            LOGGER.info(json.dumps(record, ensure_ascii=False))

        return response

    @staticmethod
    def _build_record(
        request: Request,
        response: Response | None,
        duration_ms: float,
        error_detail: str | None,
    ) -> dict[str, Any]:
        record: dict[str, Any] = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code if response else 500,
            "duration_ms": duration_ms,
        }

        tenant = request.headers.get("X-Tenant-ID")
        if tenant:
            record["tenant"] = tenant

        user = request.headers.get("X-User-ID")
        if user:
            record["user"] = user

        if error_detail:
            record["error"] = error_detail

        return record
