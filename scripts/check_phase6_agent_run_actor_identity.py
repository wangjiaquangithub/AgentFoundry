#!/usr/bin/env python3
"""Validate Agent runs use the authenticated request actor."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
AGENT_RUNTIME_API = BACKEND_DIR / "api" / "agent_runtime.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.agent_runs import PlatformAgentRunService  # noqa: E402


def assert_authenticated_actor_is_authoritative() -> None:
    user_id = PlatformAgentRunService.run_request_user_id(
        payload_user_id="acme:alice",
        header_user_id="globex:bob",
    )

    assert user_id == "globex:bob"


def assert_internal_fallback_remains_compatible() -> None:
    payload_actor = PlatformAgentRunService.run_request_user_id(
        payload_user_id="globex:bob",
        header_user_id=None,
    )
    default_actor = PlatformAgentRunService.run_request_user_id(
        payload_user_id=None,
        header_user_id=None,
    )

    assert payload_actor == "globex:bob"
    assert default_actor == "acme:alice"


def assert_route_passes_canonical_request_actor() -> None:
    source = AGENT_RUNTIME_API.read_text(encoding="utf-8")
    route_start = source.index(
        '    @router.post("/enterprise/platform/agent/run")'
    )
    route = source[route_start : source.index("    return router", route_start)]
    build_start = route.index("agent_run_service.run_request_payload(")
    build_end = route.index("\n        )", build_start)
    build_call = route[build_start:build_end]

    assert route.index("identity = get_request_identity(request)") < build_start
    assert "header_user_id=identity.user_id," in build_call


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_agent_run_actor_identity.py" in source


def main() -> int:
    assert_authenticated_actor_is_authoritative()
    assert_internal_fallback_remains_compatible()
    assert_route_passes_canonical_request_actor()
    assert_phase6_gate_includes_check()
    print("[phase6-agent-run-actor-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
