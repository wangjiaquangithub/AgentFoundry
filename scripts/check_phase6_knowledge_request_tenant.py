#!/usr/bin/env python3
"""Validate Knowledge API routes against the authenticated request tenant."""

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
    def post(self, *_args: Any, **_kwargs: Any) -> Any:
        return lambda fn: fn


fastapi_module.APIRouter = StubAPIRouter
fastapi_module.HTTPException = StubHTTPException
fastapi_module.Request = Any
sys.modules.setdefault("fastapi", fastapi_module)

from api.knowledge import _resolve_tenant  # noqa: E402
from fastapi import HTTPException  # noqa: E402


KNOWLEDGE_API = BACKEND_DIR / "api" / "knowledge.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def tenant_hint(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    return user_id.split(":", 1)[0]


def request(*, user_id: str | None, tenant_id: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        state=SimpleNamespace(
            authenticated_user_id=user_id,
            authenticated_tenant_id=tenant_id,
            identity_authenticated=True,
            identity_source="test",
        )
    )


def assert_request_identity_tenant_is_authoritative() -> None:
    authenticated_request = request(user_id="acme:alice", tenant_id="globex")
    assert _resolve_tenant(
        tenant=None,
        request=authenticated_request,
        tenant_hint_from_user_id=tenant_hint,
    ) == "globex"
    assert _resolve_tenant(
        tenant="globex",
        request=authenticated_request,
        tenant_hint_from_user_id=tenant_hint,
    ) == "globex"

    try:
        _resolve_tenant(
            tenant="acme",
            request=authenticated_request,
            tenant_hint_from_user_id=tenant_hint,
        )
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-tenant Knowledge API payload must be rejected")


def assert_user_id_tenant_hint_remains_compatible() -> None:
    assert _resolve_tenant(
        tenant=None,
        request=request(user_id="acme:alice", tenant_id=None),
        tenant_hint_from_user_id=tenant_hint,
    ) == "acme"


def assert_route_wiring_uses_request_identity_tenant() -> None:
    source = KNOWLEDGE_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    assert "identity_tenant = (identity.tenant_id or \"\").strip()" in source
    assert "tenant does not match X-User-ID tenant boundary." not in source
    assert "scripts/check_phase6_knowledge_request_tenant.py" in gate_source


def main() -> int:
    assert_request_identity_tenant_is_authoritative()
    assert_user_id_tenant_hint_remains_compatible()
    assert_route_wiring_uses_request_identity_tenant()
    print("[phase6-knowledge-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
