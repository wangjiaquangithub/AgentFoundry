#!/usr/bin/env python3
"""Validate approval decisions use the authenticated request actor."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
WORKFLOWS_API = BACKEND_DIR / "api" / "workflows.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.approvals import PlatformApprovalService  # noqa: E402


def build_service() -> PlatformApprovalService:
    return PlatformApprovalService(
        repository=SimpleNamespace(),
        now=lambda: "2026-07-23T00:00:00+00:00",
    )


def assert_authenticated_actor_is_authoritative() -> None:
    payload = build_service().build_decision_payload(
        payload=SimpleNamespace(
            decided_by="acme:alice",
            decision_note="approved",
        ),
        actor="globex:bob",
    )

    assert payload == {
        "decided_by": "globex:bob",
        "decision_note": "approved",
    }


def assert_internal_fallback_remains_compatible() -> None:
    service = build_service()
    payload_actor = service.build_decision_payload(
        payload=SimpleNamespace(
            decided_by="globex:bob",
            decision_note=None,
        ),
        actor=None,
    )
    default_actor = service.build_decision_payload(
        payload=SimpleNamespace(decided_by=None, decision_note=None),
        actor=None,
    )

    assert payload_actor == {
        "decided_by": "globex:bob",
        "decision_note": None,
    }
    assert default_actor == {
        "decided_by": "platform-admin",
        "decision_note": None,
    }


def assert_route_passes_canonical_request_actor(route_path: str) -> None:
    source = WORKFLOWS_API.read_text(encoding="utf-8")
    route_start = source.index(f'    @router.post("{route_path}")')
    route_end = source.index("\n    @router.", route_start + 1)
    route = source[route_start:route_end]
    build_start = route.index("approval_service.build_decision_payload(")
    build_end = route.index("\n        )", build_start)
    build_call = route[build_start:build_end]

    assert route.index("identity = get_request_identity(request)") < build_start
    assert "actor=identity.user_id," in build_call


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_approval_decision_actor_identity.py" in source


def main() -> int:
    assert_authenticated_actor_is_authoritative()
    assert_internal_fallback_remains_compatible()
    assert_route_passes_canonical_request_actor(
        "/enterprise/platform/approvals/{approval_id}/approve"
    )
    assert_route_passes_canonical_request_actor(
        "/enterprise/platform/approvals/{approval_id}/reject"
    )
    assert_phase6_gate_includes_check()
    print("[phase6-approval-decision-actor-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
