#!/usr/bin/env python3
"""Validate the Phase 6 trusted request identity authentication boundary."""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from types import ModuleType
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
MAIN_MODULE = BACKEND_DIR / "main.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep this production contract gate runnable without the optional web stack.
starlette_module = ModuleType("starlette")
starlette_middleware_module = ModuleType("starlette.middleware")
starlette_base_module = ModuleType("starlette.middleware.base")
starlette_requests_module = ModuleType("starlette.requests")
starlette_responses_module = ModuleType("starlette.responses")
starlette_base_module.BaseHTTPMiddleware = type("BaseHTTPMiddleware", (), {})
starlette_base_module.RequestResponseEndpoint = Any
starlette_requests_module.Request = type("Request", (), {})
starlette_responses_module.JSONResponse = type("JSONResponse", (), {})
starlette_responses_module.Response = type("Response", (), {})
sys.modules.setdefault("starlette", starlette_module)
sys.modules.setdefault("starlette.middleware", starlette_middleware_module)
sys.modules.setdefault("starlette.middleware.base", starlette_base_module)
sys.modules.setdefault("starlette.requests", starlette_requests_module)
sys.modules.setdefault("starlette.responses", starlette_responses_module)

from api.request_authentication import (  # noqa: E402
    AUTHENTICATION_EXEMPT_PATHS,
    IDENTITY_SIGNATURE_HEADER,
    IDENTITY_TIMESTAMP_HEADER,
    RequestAuthenticationError,
    authenticate_proxy_identity,
    build_identity_signature,
)


SECRET = "replace-with-local-secret"
NOW = 1_800_000_000


def _signed_headers(
    *,
    user_id: str = "acme:alice",
    tenant_id: str = "acme",
    timestamp: int = NOW,
) -> dict[str, str]:
    timestamp_text = str(timestamp)
    signature = build_identity_signature(
        shared_secret=SECRET,
        timestamp=timestamp_text,
        user_id=user_id,
        tenant_id=tenant_id,
    )
    return {
        "X-User-ID": user_id,
        "X-Tenant-ID": tenant_id,
        IDENTITY_TIMESTAMP_HEADER: timestamp_text,
        IDENTITY_SIGNATURE_HEADER: signature,
    }


def check_signature_contract() -> list[str]:
    identity = authenticate_proxy_identity(
        _signed_headers(),
        shared_secret=SECRET,
        now=NOW,
    )
    if identity.user_id != "acme:alice" or identity.tenant_id != "acme":
        return [f"valid signed identity was not preserved: {identity!r}"]
    return []


def check_rejected_assertions() -> list[str]:
    cases: list[tuple[dict[str, str], str]] = []
    cases.append(({"X-User-ID": "acme:alice"}, "unsigned identity"))

    forged = _signed_headers()
    forged["X-User-ID"] = "globex:bob"
    cases.append((forged, "forged user"))
    forged_tenant = _signed_headers()
    forged_tenant["X-Tenant-ID"] = "globex"
    cases.append((forged_tenant, "forged tenant"))
    cases.append(
        (
            _signed_headers(timestamp=NOW - 301),
            "expired identity",
        )
    )
    cases.append(
        (
            _signed_headers(timestamp=NOW + 301),
            "identity too far in the future",
        )
    )
    malformed = _signed_headers(user_id="acme:alice")
    malformed["X-Tenant-ID"] = "invalid tenant"
    cases.append((malformed, "invalid tenant"))

    errors: list[str] = []
    for headers, label in cases:
        try:
            authenticate_proxy_identity(headers, shared_secret=SECRET, now=NOW)
        except RequestAuthenticationError:
            continue
        errors.append(f"{label} must be rejected")

    try:
        authenticate_proxy_identity(_signed_headers(), shared_secret="", now=NOW)
    except RequestAuthenticationError:
        pass
    else:
        errors.append("an unconfigured identity proxy secret must be rejected")
    return errors


def check_probe_exemptions() -> list[str]:
    if AUTHENTICATION_EXEMPT_PATHS != frozenset({"/health", "/ready"}):
        return [f"only health probes may be exempt: {AUTHENTICATION_EXEMPT_PATHS!r}"]
    return []


def check_main_wiring() -> list[str]:
    source = MAIN_MODULE.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(MAIN_MODULE))
    imported = any(
        isinstance(node, ast.ImportFrom)
        and node.module == "api.request_authentication"
        and any(alias.name == "RequestIdentityAuthenticationMiddleware" for alias in node.names)
        for node in ast.walk(tree)
    )
    required_fragments = (
        "RequestIdentityAuthenticationMiddleware",
        "production_mode=server_config.production_mode",
        "shared_secret=server_config.identity_proxy_secret",
    )
    errors: list[str] = []
    if not imported:
        errors.append("backend/main.py must import the identity authentication middleware")
    for fragment in required_fragments:
        if fragment not in source:
            errors.append(f"backend/main.py is missing authentication wiring: {fragment}")

    middleware_names = [
        node.args[0].id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "Middleware"
        and node.args
        and isinstance(node.args[0], ast.Name)
        and node.args[0].id
        in {
            "StructuredRequestLoggingMiddleware",
            "CORSMiddleware",
            "RequestIdentityAuthenticationMiddleware",
        }
    ]
    expected_order = [
        "StructuredRequestLoggingMiddleware",
        "CORSMiddleware",
        "RequestIdentityAuthenticationMiddleware",
    ]
    if middleware_names != expected_order:
        errors.append(
            "request middleware order must be logging, CORS, then authentication: "
            f"{middleware_names!r}"
        )
    return errors


def check_documentation_and_gate() -> list[str]:
    readme = (BACKEND_DIR / "README.md").read_text(encoding="utf-8")
    env_example = (BACKEND_DIR / ".env.example").read_text(encoding="utf-8")
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    errors: list[str] = []
    for phrase in (
        "AGENTFOUNDRY_IDENTITY_PROXY_SECRET",
        "X-AgentFoundry-Identity-Timestamp",
        "X-AgentFoundry-Identity-Signature",
        "HMAC-SHA256",
    ):
        if phrase not in readme:
            errors.append(f"backend/README.md is missing {phrase!r}")
    if "AGENTFOUNDRY_IDENTITY_PROXY_SECRET=" not in env_example:
        errors.append("backend/.env.example must declare the identity proxy secret")
    if "scripts/check_phase6_request_authentication.py" not in gate:
        errors.append("Phase 6 backend gate must run the authentication check")
    return errors


def main() -> int:
    errors = (
        check_signature_contract()
        + check_rejected_assertions()
        + check_probe_exemptions()
        + check_main_wiring()
        + check_documentation_and_gate()
    )
    if errors:
        for error in errors:
            print(f"[phase6-request-authentication] {error}", file=sys.stderr)
        return 1
    print("[phase6-request-authentication] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
