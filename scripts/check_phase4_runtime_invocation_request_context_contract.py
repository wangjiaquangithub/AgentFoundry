#!/usr/bin/env python3
"""Validate runtime invocation request payload context round-trip."""

from __future__ import annotations

import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))


def main() -> None:
    from backend.runtime import (
        build_runtime_invocation_request_from_payload,
        build_runtime_invocation_request_payload,
    )

    metadata = {
        "source": "enterprise_agent_run",
        "runtime_invocation_id": "runtime-invocation-phase-4-context",
        "policy_decision_id": "policy-decision-001",
        "approval_required": False,
    }
    payload = build_runtime_invocation_request_payload(
        tenant="acme",
        user_id="acme:alice",
        session_id="session-phase-4-context-roundtrip",
        agent_id="agent-enterprise-support",
        agent_name="Enterprise Support",
        question="Summarize runtime governance context.",
        instructions="Use tenant-scoped tools and cite enterprise knowledge.",
        tools=("crm_lookup", "knowledge_search"),
        knowledge_base_ids=("kb-enterprise-handbook", "kb-security-policy"),
        memory_enabled=True,
        metadata=metadata,
    )

    request = build_runtime_invocation_request_from_payload(payload)
    round_tripped = request.to_dict()

    assert round_tripped["context"]["tenant"] == "acme"
    assert round_tripped["context"]["user_id"] == "acme:alice"
    assert round_tripped["context"]["session_id"] == (
        "session-phase-4-context-roundtrip"
    )
    assert round_tripped["context"]["agent_id"] == "agent-enterprise-support"
    assert round_tripped["context"]["agent_name"] == "Enterprise Support"
    assert round_tripped["question"] == "Summarize runtime governance context."
    assert round_tripped["instructions"] == (
        "Use tenant-scoped tools and cite enterprise knowledge."
    )
    assert round_tripped["tools"] == ["crm_lookup", "knowledge_search"]
    assert round_tripped["knowledge_base_ids"] == [
        "kb-enterprise-handbook",
        "kb-security-policy",
    ]
    assert round_tripped["memory_enabled"] is True
    assert round_tripped["metadata"] == metadata
    assert round_tripped["context"]["metadata"] == metadata
    assert (
        round_tripped["metadata"]["runtime_invocation_id"]
        == "runtime-invocation-phase-4-context"
    )
    assert (
        round_tripped["context"]["metadata"]["runtime_invocation_id"]
        == "runtime-invocation-phase-4-context"
    )

    print("phase 4.x runtime invocation request context contract checks passed")


if __name__ == "__main__":
    main()
