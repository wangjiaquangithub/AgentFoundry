#!/usr/bin/env python3
"""Validate the Phase 6 structured request logging contract."""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MAIN_MODULE = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep the gate runnable in the repository's dependency-minimal CI environment.
starlette_module = ModuleType("starlette")
starlette_middleware_module = ModuleType("starlette.middleware")
starlette_base_module = ModuleType("starlette.middleware.base")
starlette_requests_module = ModuleType("starlette.requests")
starlette_responses_module = ModuleType("starlette.responses")
starlette_base_module.BaseHTTPMiddleware = type("BaseHTTPMiddleware", (), {})
starlette_base_module.RequestResponseEndpoint = Any
starlette_requests_module.Request = type("Request", (), {})
starlette_responses_module.Response = type("Response", (), {})
sys.modules.setdefault("starlette", starlette_module)
sys.modules.setdefault("starlette.middleware", starlette_middleware_module)
sys.modules.setdefault("starlette.middleware.base", starlette_base_module)
sys.modules.setdefault("starlette.requests", starlette_requests_module)
sys.modules.setdefault("starlette.responses", starlette_responses_module)

from api.request_logging import StructuredRequestLoggingMiddleware  # noqa: E402


def _request(*, tenant: str | None = None, user: str | None = None) -> Any:
    headers = {}
    if tenant is not None:
        headers["X-Tenant-ID"] = tenant
    if user is not None:
        headers["X-User-ID"] = user
    return SimpleNamespace(
        method="POST",
        url=SimpleNamespace(path="/platform/agents/run"),
        headers=headers,
    )


def check_success_record() -> list[str]:
    record = StructuredRequestLoggingMiddleware._build_record(
        _request(tenant="acme", user="acme:alice"),
        SimpleNamespace(status_code=201),
        12.34,
        None,
    )
    expected = {
        "method": "POST",
        "path": "/platform/agents/run",
        "status": 201,
        "duration_ms": 12.34,
        "tenant": "acme",
        "user": "acme:alice",
    }
    if record != expected:
        return [f"successful request record mismatch: {record!r}"]
    return []


def check_optional_context() -> list[str]:
    record = StructuredRequestLoggingMiddleware._build_record(
        _request(),
        SimpleNamespace(status_code=204),
        0.5,
        None,
    )
    unexpected = sorted({"tenant", "user", "error"}.intersection(record))
    if unexpected:
        return [f"request record includes absent optional fields: {unexpected}"]
    return []


def check_error_record() -> list[str]:
    record = StructuredRequestLoggingMiddleware._build_record(
        _request(),
        None,
        3.21,
        "runtime unavailable",
    )
    errors: list[str] = []
    if record.get("status") != 500:
        errors.append(f"failed request status must be 500: {record!r}")
    if record.get("error") != "runtime unavailable":
        errors.append(f"failed request must include the error detail: {record!r}")
    return errors


def check_main_registers_middleware() -> list[str]:
    tree = ast.parse(MAIN_MODULE.read_text(encoding="utf-8"), filename=str(MAIN_MODULE))
    imported = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "api.request_logging"
        and any(alias.name == "StructuredRequestLoggingMiddleware" for alias in node.names)
        for node in ast.walk(tree)
    )
    registered = any(
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "Middleware"
        and node.args
        and isinstance(node.args[0], ast.Name)
        and node.args[0].id == "StructuredRequestLoggingMiddleware"
        for node in ast.walk(tree)
    )

    errors: list[str] = []
    if not imported:
        errors.append("backend/main.py must import StructuredRequestLoggingMiddleware")
    if not registered:
        errors.append("backend/main.py must register StructuredRequestLoggingMiddleware")
    return errors


def check_phase6_gate_wires_check() -> list[str]:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_request_logging.py" not in source:
        return ["Phase 6 backend gate must run check_phase6_request_logging.py"]
    return []


def main() -> int:
    errors: list[str] = []
    errors.extend(check_success_record())
    errors.extend(check_optional_context())
    errors.extend(check_error_record())
    errors.extend(check_main_registers_middleware())
    errors.extend(check_phase6_gate_wires_check())

    if errors:
        for error in errors:
            print(f"[phase6-request-logging] {error}", file=sys.stderr)
        return 1

    print("[phase6-request-logging] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
