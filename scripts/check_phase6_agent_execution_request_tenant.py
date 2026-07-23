#!/usr/bin/env python3
"""Validate Agent execution runtime against the authenticated request tenant."""

from __future__ import annotations

from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep this contract gate runnable without the optional web stack.
fastapi_module = ModuleType("fastapi")


class StubHTTPException(Exception):
    def __init__(self, *, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class StubAPIRouter:
    def get(self, *_args: Any, **_kwargs: Any) -> Any:
        return lambda fn: fn

    post = get
    delete = get


fastapi_module.APIRouter = StubAPIRouter
fastapi_module.HTTPException = StubHTTPException
fastapi_module.Request = Any
sys.modules.setdefault("fastapi", fastapi_module)

from api.agent_runtime import _request_tenant  # noqa: E402
from fastapi import HTTPException  # noqa: E402


AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def tenant_hint(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    return user_id.split(":", 1)[0]


def request(*, tenant_id: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        state=SimpleNamespace(
            authenticated_user_id="acme:alice",
            authenticated_tenant_id=tenant_id,
            identity_authenticated=True,
            identity_source="trusted_proxy_hmac",
        )
    )


def assert_request_identity_tenant_is_authoritative() -> None:
    assert _request_tenant(
        request=request(tenant_id="globex"),
        tenant="globex",
        tenant_hint_from_user_id=tenant_hint,
    ) == "globex"

    try:
        _request_tenant(
            request=request(tenant_id="globex"),
            tenant="acme",
            tenant_hint_from_user_id=tenant_hint,
        )
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-tenant Agent execution runtime must be rejected")


def assert_user_id_tenant_hint_remains_compatible() -> None:
    assert _request_tenant(
        request=request(tenant_id=None),
        tenant="acme",
        tenant_hint_from_user_id=tenant_hint,
    ) == "acme"


def assert_execution_route_validates_runtime_tenant() -> None:
    source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")
    execution_route = source[
        source.index('@router.post("/enterprise/platform/agent/run")') :
        source.index('@router.get("/enterprise/platform/agent/runs")')
    ]

    assert execution_route.count("_request_tenant(") == 1
    assert "tenant=agent_run_service.runtime_tenant(runtime)," in execution_route
    assert "tenant_hint_from_user_id=deps.tenant_hint_from_user_id," in execution_route
    assert "scripts/check_phase6_agent_execution_request_tenant.py" in gate_source


def main() -> int:
    assert_request_identity_tenant_is_authoritative()
    assert_user_id_tenant_hint_remains_compatible()
    assert_execution_route_validates_runtime_tenant()
    print("[phase6-agent-execution-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
