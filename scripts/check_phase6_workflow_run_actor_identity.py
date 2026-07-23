#!/usr/bin/env python3
"""Validate Workflow runs use the authenticated request actor."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
WORKFLOWS_API = BACKEND_DIR / "api" / "workflows.py"
PHASE6_GATE = ROOT / "scripts" / "check_phase6_backend_gate.py"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.services.workflows import PlatformWorkflowRunService  # noqa: E402


class UnusedWorkflowRunRepository:
    def list(self, **_: Any) -> list[dict[str, Any]]:
        raise AssertionError("run request construction must not access persistence")


def build_payload(*, user_id: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        workflow_type="daily_ops_brief",
        inputs={"department": "engineering"},
        agent_id=None,
        user_id=user_id,
        approval_id=None,
    )


def assert_authenticated_actor_is_authoritative() -> None:
    service = PlatformWorkflowRunService(repository=UnusedWorkflowRunRepository())
    request_payload = service.build_run_request_payload(
        payload=build_payload(user_id="acme:alice"),
        actor="globex:bob",
    )

    assert request_payload["user_id"] == "globex:bob"


def assert_internal_fallback_remains_compatible() -> None:
    service = PlatformWorkflowRunService(repository=UnusedWorkflowRunRepository())

    payload_actor = service.build_run_request_payload(
        payload=build_payload(user_id="globex:bob"),
        actor=None,
    )
    default_actor = service.build_run_request_payload(
        payload=build_payload(user_id=None),
        actor=None,
    )

    assert payload_actor["user_id"] == "globex:bob"
    assert default_actor["user_id"] == "acme:alice"


def assert_route_passes_canonical_request_actor() -> None:
    source = WORKFLOWS_API.read_text(encoding="utf-8")
    route_start = source.index(
        '    @router.post("/enterprise/platform/workflows/run")'
    )
    route = source[route_start : source.index("    return router", route_start)]
    build_start = route.index("workflow_run_service.build_run_request_payload(")
    build_end = route.index("\n        )", build_start)
    build_call = route[build_start:build_end]

    assert route.index("identity = get_request_identity(request)") < build_start
    assert "actor=identity.user_id," in build_call


def assert_phase6_gate_includes_check() -> None:
    source = PHASE6_GATE.read_text(encoding="utf-8")
    assert "check_phase6_workflow_run_actor_identity.py" in source


def main() -> int:
    assert_authenticated_actor_is_authoritative()
    assert_internal_fallback_remains_compatible()
    assert_route_passes_canonical_request_actor()
    assert_phase6_gate_includes_check()
    print("[phase6-workflow-run-actor-identity] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
