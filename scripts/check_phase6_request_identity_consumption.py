#!/usr/bin/env python3
"""Validate canonical request identity consumption in migrated API domains."""

from __future__ import annotations

import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
IDENTITY_MODULE = BACKEND_DIR / "api" / "request_identity.py"
PLATFORM_ADMIN_MODULE = BACKEND_DIR / "api" / "platform_admin.py"
AGENTS_MODULE = BACKEND_DIR / "api" / "agents.py"
TOOLS_MODULE = BACKEND_DIR / "api" / "tools.py"
MODEL_CONFIGS_MODULE = BACKEND_DIR / "api" / "model_configs.py"
KNOWLEDGE_MODULE = BACKEND_DIR / "api" / "knowledge.py"
WORKFLOWS_MODULE = BACKEND_DIR / "api" / "workflows.py"
AGENT_RUNTIME_MODULE = BACKEND_DIR / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep this contract gate runnable without the optional web stack.
fastapi_module = ModuleType("fastapi")


class StubHTTPException(Exception):
    def __init__(self, *, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


fastapi_module.HTTPException = StubHTTPException
fastapi_module.Request = Any
sys.modules.setdefault("fastapi", fastapi_module)

from api.request_identity import get_request_identity  # noqa: E402
from fastapi import HTTPException  # noqa: E402


def check_accessor_contract() -> list[str]:
    errors: list[str] = []
    request = SimpleNamespace(
        state=SimpleNamespace(
            authenticated_user_id="acme:alice",
            authenticated_tenant_id="acme",
            identity_authenticated=True,
            identity_source="trusted_proxy_hmac",
        )
    )
    identity = get_request_identity(request)
    if (
        identity.user_id != "acme:alice"
        or identity.tenant_id != "acme"
        or identity.authenticated is not True
        or identity.source != "trusted_proxy_hmac"
    ):
        errors.append(f"canonical identity state was not preserved: {identity!r}")

    development_request = SimpleNamespace(
        state=SimpleNamespace(
            authenticated_user_id=None,
            authenticated_tenant_id=None,
            identity_authenticated=False,
            identity_source="development_headers",
        )
    )
    development_identity = get_request_identity(development_request)
    if development_identity.user_id is not None:
        errors.append("development identity without headers must remain optional")

    try:
        get_request_identity(SimpleNamespace(state=SimpleNamespace()))
    except HTTPException as exc:
        if exc.status_code != 401:
            errors.append(f"missing middleware state returned {exc.status_code}, not 401")
    else:
        errors.append("missing middleware identity state must fail closed")
    return errors


def check_platform_admin_consumption() -> list[str]:
    source = PLATFORM_ADMIN_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("platform_admin.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("platform_admin.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 13:
        errors.append(
            "platform_admin.py must resolve canonical identity for all 13 identity-aware routes"
        )
    return errors


def check_agents_consumption() -> list[str]:
    source = AGENTS_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("agents.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("agents.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 4:
        errors.append(
            "agents.py must resolve canonical identity for all 4 identity-aware routes"
        )
    return errors


def check_tools_consumption() -> list[str]:
    source = TOOLS_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("tools.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("tools.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 3:
        errors.append(
            "tools.py must resolve canonical identity for all 3 identity-aware routes"
        )
    return errors


def check_model_configs_consumption() -> list[str]:
    source = MODEL_CONFIGS_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("model_configs.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("model_configs.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 3:
        errors.append(
            "model_configs.py must resolve canonical identity for all 3 routes"
        )
    return errors


def check_knowledge_consumption() -> list[str]:
    source = KNOWLEDGE_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("knowledge.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("knowledge.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 2:
        errors.append(
            "knowledge.py must resolve canonical identity at both identity consumption points"
        )
    return errors


def check_workflows_consumption() -> list[str]:
    source = WORKFLOWS_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("workflows.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("workflows.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 8:
        errors.append(
            "workflows.py must preserve all 8 canonical identity consumption points"
        )
    return errors


def check_agent_runtime_consumption() -> list[str]:
    source = AGENT_RUNTIME_MODULE.read_text(encoding="utf-8")
    errors: list[str] = []
    if "from api.request_identity import get_request_identity" not in source:
        errors.append("agent_runtime.py must import the canonical identity accessor")
    if 'request.headers.get("X-User-ID")' in source or "request.headers" in source:
        errors.append("agent_runtime.py must not consume raw request identity headers")
    if source.count("get_request_identity(request)") != 2:
        errors.append(
            "agent_runtime.py must resolve canonical identity for execution and history routes"
        )
    if "requested_by=identity.user_id" not in source:
        errors.append(
            "agent_runtime.py must pass the canonical actor to approval processing"
        )
    return errors


def check_gate_wiring() -> list[str]:
    gate = PHASE6_GATE.read_text(encoding="utf-8")
    if "scripts/check_phase6_request_identity_consumption.py" not in gate:
        return ["Phase 6 backend gate must run the request identity consumption check"]
    return []


def main() -> int:
    errors = (
        check_accessor_contract()
        + check_platform_admin_consumption()
        + check_agents_consumption()
        + check_tools_consumption()
        + check_model_configs_consumption()
        + check_knowledge_consumption()
        + check_workflows_consumption()
        + check_agent_runtime_consumption()
        + check_gate_wiring()
    )
    if errors:
        for error in errors:
            print(f"[phase6-request-identity-consumption] {error}", file=sys.stderr)
        return 1
    print("[phase6-request-identity-consumption] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
