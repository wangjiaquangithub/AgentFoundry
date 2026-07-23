#!/usr/bin/env python3
"""Validate the Phase 6 correlated API error response contract."""

from __future__ import annotations

import asyncio
import ast
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MAIN_MODULE = BACKEND_DIR / "main.py"
ERROR_MODULE = BACKEND_DIR / "api" / "error_handling.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class StubHTTPException(Exception):
    def __init__(
        self,
        status_code: int,
        detail: Any,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.headers = headers


class StubJSONResponse:
    def __init__(
        self,
        *,
        status_code: int,
        content: Any,
        headers: dict[str, str],
    ) -> None:
        self.status_code = status_code
        self.content = content
        self.headers = headers


# Keep the gate runnable in the repository's dependency-minimal CI environment.
starlette_module = ModuleType("starlette")
starlette_exceptions_module = ModuleType("starlette.exceptions")
starlette_requests_module = ModuleType("starlette.requests")
starlette_responses_module = ModuleType("starlette.responses")
starlette_exceptions_module.HTTPException = StubHTTPException
starlette_requests_module.Request = type("Request", (), {})
starlette_responses_module.JSONResponse = StubJSONResponse
sys.modules.setdefault("starlette", starlette_module)
sys.modules.setdefault("starlette.exceptions", starlette_exceptions_module)
sys.modules.setdefault("starlette.requests", starlette_requests_module)
sys.modules.setdefault("starlette.responses", starlette_responses_module)

request_logging_stub = ModuleType("api.request_logging")
request_logging_stub.REQUEST_ID_HEADER = "X-Request-ID"
sys.modules.setdefault("api.request_logging", request_logging_stub)

from api.error_handling import (  # noqa: E402
    INTERNAL_ERROR_DETAIL,
    http_exception_handler,
    register_error_handlers,
    unhandled_exception_handler,
)


def _request(request_id: str = "req-error-123") -> Any:
    return SimpleNamespace(
        state=SimpleNamespace(request_id=request_id),
        method="GET",
        url=SimpleNamespace(path="/platform/missing"),
    )


def check_http_exception_response() -> list[str]:
    response = asyncio.run(
        http_exception_handler(
            _request(),
            StubHTTPException(
                404,
                "Resource not found.",
                headers={"Cache-Control": "no-store"},
            ),
        )
    )
    expected = {"detail": "Resource not found.", "request_id": "req-error-123"}
    errors: list[str] = []
    if response.status_code != 404 or response.content != expected:
        errors.append(f"HTTP error response mismatch: {response.__dict__!r}")
    if response.headers.get("X-Request-ID") != "req-error-123":
        errors.append("HTTP error response must expose the request ID header")
    if response.headers.get("Cache-Control") != "no-store":
        errors.append("HTTP error response must preserve exception headers")
    return errors


def check_unhandled_exception_response() -> list[str]:
    secret = "database password leaked"
    response = asyncio.run(
        unhandled_exception_handler(_request("req-failed-456"), RuntimeError(secret))
    )
    expected = {
        "detail": INTERNAL_ERROR_DETAIL,
        "request_id": "req-failed-456",
    }
    errors: list[str] = []
    if response.status_code != 500 or response.content != expected:
        errors.append(f"unhandled error response mismatch: {response.__dict__!r}")
    if secret in repr(response.content):
        errors.append("unhandled error response leaked the internal exception detail")
    if response.headers.get("X-Request-ID") != "req-failed-456":
        errors.append("unhandled error response must expose the request ID header")
    return errors


def check_handler_registration() -> list[str]:
    calls: list[tuple[Any, Any]] = []
    app = SimpleNamespace(
        add_exception_handler=lambda exception_type, handler: calls.append(
            (exception_type, handler)
        )
    )
    register_error_handlers(app)
    expected = [
        (StubHTTPException, http_exception_handler),
        (Exception, unhandled_exception_handler),
    ]
    if calls != expected:
        return [f"error handler registration mismatch: {calls!r}"]
    return []


def check_main_registers_handlers() -> list[str]:
    tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))
    imported = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "api.error_handling"
        and any(alias.name == "register_error_handlers" for alias in node.names)
        for node in ast.walk(tree)
    )
    registered = any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "register_error_handlers"
        for node in ast.walk(tree)
    )
    errors: list[str] = []
    if not imported:
        errors.append("backend/main.py must import register_error_handlers")
    if not registered:
        errors.append("backend/main.py must register the API error handlers")
    return errors


def check_server_side_exception_logging() -> list[str]:
    source = ERROR_MODULE.read_text(encoding="utf-8")
    required = ('"request_id": request_id', "exception_type", "exc_info=")
    missing = [fragment for fragment in required if fragment not in source]
    if missing:
        return [f"server-side exception logging is incomplete: {missing}"]
    return []


def check_phase6_gate_wires_check() -> list[str]:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_error_handling.py" not in source:
        return ["Phase 6 backend gate must run check_phase6_error_handling.py"]
    return []


def main() -> int:
    errors: list[str] = []
    errors.extend(check_http_exception_response())
    errors.extend(check_unhandled_exception_response())
    errors.extend(check_handler_registration())
    errors.extend(check_main_registers_handlers())
    errors.extend(check_server_side_exception_logging())
    errors.extend(check_phase6_gate_wires_check())

    if errors:
        for error in errors:
            print(f"[phase6-error-handling] {error}", file=sys.stderr)
        return 1

    print("[phase6-error-handling] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
