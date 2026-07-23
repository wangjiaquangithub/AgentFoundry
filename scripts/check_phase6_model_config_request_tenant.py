#!/usr/bin/env python3
"""Validate Model Config routes against the authenticated request tenant."""

from __future__ import annotations

from pathlib import Path
import sys
from types import ModuleType
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

from api.model_configs import _resolve_tenant  # noqa: E402
from fastapi import HTTPException  # noqa: E402


MODEL_CONFIGS_API = BACKEND_DIR / "api" / "model_configs.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def tenant_hint(user_id: str) -> str | None:
    if ":" not in user_id:
        return None
    return user_id.split(":", 1)[0]


def assert_request_identity_tenant_is_authoritative() -> None:
    assert _resolve_tenant(
        tenant=None,
        user_id="acme:alice",
        identity_tenant_id="globex",
        tenant_hint_from_user_id=tenant_hint,
    ) == "globex"
    assert _resolve_tenant(
        tenant="globex",
        user_id="acme:alice",
        identity_tenant_id="globex",
        tenant_hint_from_user_id=tenant_hint,
    ) == "globex"

    try:
        _resolve_tenant(
            tenant="acme",
            user_id="acme:alice",
            identity_tenant_id="globex",
            tenant_hint_from_user_id=tenant_hint,
        )
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-tenant Model Config payload must be rejected")


def assert_user_id_tenant_hint_remains_compatible() -> None:
    assert _resolve_tenant(
        tenant=None,
        user_id="acme:alice",
        identity_tenant_id=None,
        tenant_hint_from_user_id=tenant_hint,
    ) == "acme"


def assert_route_wiring_passes_request_tenant() -> None:
    source = MODEL_CONFIGS_API.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    assert source.count("identity_tenant_id=identity.tenant_id,") == 3
    assert "scripts/check_phase6_model_config_request_tenant.py" in gate_source


def main() -> int:
    assert_request_identity_tenant_is_authoritative()
    assert_user_id_tenant_hint_remains_compatible()
    assert_route_wiring_passes_request_tenant()
    print("[phase6-model-config-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
