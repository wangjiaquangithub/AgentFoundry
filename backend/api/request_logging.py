"""Structured request logging middleware for production observability."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

LOGGER = logging.getLogger("agentfoundry.requests")
REQUEST_ID_HEADER = "X-Request-ID"
VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


class StructuredRequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log each HTTP request as a structured JSON record.

    Captures method, path, status, duration in milliseconds, and the
    tenant/user context from request headers when available.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start = time.perf_counter()
        request_id = self._resolve_request_id(request)
        request.state.request_id = request_id
        response: Response | None = None
        error_detail: str | None = None

        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = request_id
        except Exception as exc:
            error_detail = str(exc)
            raise
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            record = self._build_record(
                request,
                response,
                duration_ms,
                error_detail,
                request_id=request_id,
            )
            LOGGER.info(json.dumps(record, ensure_ascii=False))

        return response

    @staticmethod
    def _build_record(
        request: Request,
        response: Response | None,
        duration_ms: float,
        error_detail: str | None,
        *,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        record: dict[str, Any] = {
            "request_id": request_id
            or StructuredRequestLoggingMiddleware._resolve_request_id(request),
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

    @staticmethod
    def _resolve_request_id(request: Request) -> str:
        request_id = str(request.headers.get(REQUEST_ID_HEADER) or "").strip()
        if VALID_REQUEST_ID.fullmatch(request_id):
            return request_id
        return uuid4().hex
