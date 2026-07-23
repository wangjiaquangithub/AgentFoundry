#!/usr/bin/env python3
"""Validate Tool Policy runtime lookups are bound to the request tenant."""

from __future__ import annotations

from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from permissions import ToolAuthorizationPolicy  # noqa: E402
from services.tools import PlatformToolPolicyService  # noqa: E402


MAIN = BACKEND_DIR / "main.py"
SERVICE = BACKEND_DIR / "services" / "tools.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"


def build_service(
    *,
    policy_path: Path,
    runtime_context: Any,
    identity_calls: list[dict[str, str]],
) -> PlatformToolPolicyService:
    return PlatformToolPolicyService(
        policy_path=lambda: policy_path,
        default_policy={"defaults": {"allow": []}, "tenants": {}},
        policy_mode=lambda: "permissive",
        enterprise_tool_names=[],
        runtime_context=runtime_context,
        identity_metadata=lambda user_id, tenant: (
            identity_calls.append({"user_id": user_id, "tenant": tenant}) or []
        ),
    )


def assert_request_tenant_is_forwarded() -> None:
    runtime_calls: list[dict[str, str | None]] = []
    identity_calls: list[dict[str, str]] = []

    def runtime_context(
        user_id: str,
        *,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        runtime_calls.append({"user_id": user_id, "tenant": tenant})
        return {"tenant": "globex"}

    with TemporaryDirectory() as temp_dir:
        service = build_service(
            policy_path=Path(temp_dir) / "policy.json",
            runtime_context=runtime_context,
            identity_calls=identity_calls,
        )
        payload = service.policy_payload(
            authorization_policy=ToolAuthorizationPolicy({}),
            user_id="acme:alice",
            tenant="acme",
        )

    assert runtime_calls == [{"user_id": "acme:alice", "tenant": "acme"}]
    assert identity_calls == [{"user_id": "acme:alice", "tenant": "acme"}]
    assert payload["selected"]["tenant"] == "acme"


def assert_legacy_unscoped_call_remains_compatible() -> None:
    identity_calls: list[dict[str, str]] = []

    with TemporaryDirectory() as temp_dir:
        service = build_service(
            policy_path=Path(temp_dir) / "policy.json",
            runtime_context=lambda user_id: {"tenant": user_id.split(":", 1)[0]},
            identity_calls=identity_calls,
        )
        payload = service.policy_payload(
            authorization_policy=ToolAuthorizationPolicy({}),
            user_id="acme:alice",
        )

    assert identity_calls == [{"user_id": "acme:alice", "tenant": "acme"}]
    assert payload["selected"]["tenant"] == "acme"


def assert_application_wiring_forwards_tenant() -> None:
    service_source = SERVICE.read_text(encoding="utf-8")
    main_source = MAIN.read_text(encoding="utf-8")
    gate_source = PHASE6_GATE.read_text(encoding="utf-8")

    assert "self._runtime_context(resolved_user_id, tenant=tenant)" in service_source
    tool_policy_factory = main_source[
        main_source.index("def _platform_tool_policy_service()") :
        main_source.index("def _raise_platform_tool_policy_service_error(")
    ]
    assert "tenant: str | None = None," in tool_policy_factory
    assert "tenant=tenant," in tool_policy_factory
    assert (
        "scripts/check_phase6_tool_policy_runtime_lookup_request_tenant.py"
        in gate_source
    )


def main() -> int:
    assert_request_tenant_is_forwarded()
    assert_legacy_unscoped_call_remains_compatible()
    assert_application_wiring_forwards_tenant()
    print("[phase6-tool-policy-runtime-lookup-request-tenant] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
