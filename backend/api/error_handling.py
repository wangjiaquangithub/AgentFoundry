"""Central API error responses with request correlation."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse

from api.request_logging import REQUEST_ID_HEADER


LOGGER = logging.getLogger("agentfoundry.errors")
INTERNAL_ERROR_DETAIL = "Internal server error."


def _request_id(request: Request) -> str:
    request_id = str(getattr(request.state, "request_id", "") or "").strip()
    if request_id:
        return request_id

    request_id = uuid4().hex
    request.state.request_id = request_id
    return request_id


def _error_response(
    *,
    detail: Any,
    status_code: int,
    request_id: str,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    response_headers = dict(headers or {})
    response_headers[REQUEST_ID_HEADER] = request_id
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail, "request_id": request_id},
        headers=response_headers,
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Preserve HTTP error semantics while attaching the correlation ID."""

    return _error_response(
        detail=exc.detail,
        status_code=exc.status_code,
        request_id=_request_id(request),
        headers=exc.headers,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Return a safe 500 response and retain exception context server-side."""

    request_id = _request_id(request)
    LOGGER.error(
        json.dumps(
            {
                "event": "unhandled_exception",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "exception_type": type(exc).__name__,
            },
            ensure_ascii=False,
        ),
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return _error_response(
        detail=INTERNAL_ERROR_DETAIL,
        status_code=500,
        request_id=request_id,
    )


def register_error_handlers(app: Any) -> None:
    """Install AgentFoundry's correlated error response handlers."""

    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
