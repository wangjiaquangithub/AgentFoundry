#!/usr/bin/env python3
"""Run the backend-focused production gate for Phase 6."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("backend compile", [sys.executable, "-m", "compileall", "backend"]),
    (
        "tenant access boundary",
        [sys.executable, "scripts/check_phase6_tenant_access_boundary.py"],
    ),
    (
        "agent catalog request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_catalog_request_tenant.py",
        ],
    ),
    (
        "platform config export request tenant",
        [
            sys.executable,
            "scripts/check_phase6_platform_config_export_request_tenant.py",
        ],
    ),
    (
        "platform config Agent import request tenant",
        [
            sys.executable,
            "scripts/check_phase6_platform_config_agent_import_request_tenant.py",
        ],
    ),
    (
        "platform Agent import authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_agent_import_actor_audit.py",
        ],
    ),
    (
        "platform Agent publish authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_agent_publish_actor_audit.py",
        ],
    ),
    (
        "platform Agent update authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_agent_update_actor_audit.py",
        ],
    ),
    (
        "platform Agent archive authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_agent_archive_actor_audit.py",
        ],
    ),
    (
        "model config request tenant",
        [
            sys.executable,
            "scripts/check_phase6_model_config_request_tenant.py",
        ],
    ),
    (
        "model config upsert authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_model_config_actor_audit.py",
        ],
    ),
    (
        "knowledge request tenant",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_request_tenant.py",
        ],
    ),
    (
        "knowledge base upsert authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_base_actor_audit.py",
        ],
    ),
    (
        "knowledge embedding record upsert authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_embedding_record_actor_audit.py",
        ],
    ),
    (
        "knowledge document upsert authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_document_actor_audit.py",
        ],
    ),
    (
        "knowledge document chunk upsert authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_document_chunk_actor_audit.py",
        ],
    ),
    (
        "knowledge ingestion authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_ingestion_actor_audit.py",
        ],
    ),
    (
        "knowledge retrieval evidence fail closed",
        [
            sys.executable,
            "scripts/check_phase6_knowledge_retrieval_evidence_fail_closed.py",
        ],
    ),
    (
        "agent-run knowledge retrieval evidence fail closed",
        [
            sys.executable,
            "scripts/check_phase6_agent_run_retrieval_evidence_fail_closed.py",
        ],
    ),
    (
        "agent-run memory read audit fail closed",
        [
            sys.executable,
            "scripts/check_phase6_agent_run_memory_read_audit_fail_closed.py",
        ],
    ),
    (
        "agent-run memory expiry fail closed",
        [
            sys.executable,
            "scripts/check_phase6_agent_run_memory_expiry_fail_closed.py",
        ],
    ),
    (
        "memory-item get expiry fail closed",
        [
            sys.executable,
            "scripts/check_phase6_memory_item_get_expiry_fail_closed.py",
        ],
    ),
    (
        "memory-item write expiry fail closed",
        [
            sys.executable,
            "scripts/check_phase6_memory_item_write_expiry_fail_closed.py",
        ],
    ),
    (
        "memory-item write created time fail closed",
        [
            sys.executable,
            "scripts/check_phase6_memory_item_write_created_at_fail_closed.py",
        ],
    ),
    (
        "agent-run memory audit fail closed",
        [
            sys.executable,
            "scripts/check_phase6_agent_run_memory_audit_fail_closed.py",
        ],
    ),
    (
        "agent-run memory persistence fail closed",
        [
            sys.executable,
            "scripts/check_phase6_agent_run_memory_persistence_fail_closed.py",
        ],
    ),
    (
        "tool request tenant",
        [
            sys.executable,
            "scripts/check_phase6_tool_request_tenant.py",
        ],
    ),
    (
        "tool runtime lookup request tenant",
        [
            sys.executable,
            "scripts/check_phase6_tool_runtime_lookup_request_tenant.py",
        ],
    ),
    (
        "tool policy runtime lookup request tenant",
        [
            sys.executable,
            "scripts/check_phase6_tool_policy_runtime_lookup_request_tenant.py",
        ],
    ),
    (
        "enterprise tool execution request tenant",
        [
            sys.executable,
            "scripts/check_phase6_enterprise_tool_execution_request_tenant.py",
        ],
    ),
    (
        "tool run authenticated actor identity",
        [sys.executable, "scripts/check_phase6_tool_run_actor_identity.py"],
    ),
    (
        "workflow request tenant",
        [
            sys.executable,
            "scripts/check_phase6_workflow_request_tenant.py",
        ],
    ),
    (
        "workflow template import authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_workflow_template_import_actor_audit.py",
        ],
    ),
    (
        "workflow template update authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_workflow_template_update_actor_audit.py",
        ],
    ),
    (
        "workflow template enable authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_workflow_template_enable_actor_audit.py",
        ],
    ),
    (
        "workflow runtime lookup request tenant",
        [
            sys.executable,
            "scripts/check_phase6_workflow_runtime_lookup_request_tenant.py",
        ],
    ),
    (
        "workflow Agent lookup request tenant",
        [
            sys.executable,
            "scripts/check_phase6_workflow_agent_lookup_request_tenant.py",
        ],
    ),
    (
        "workflow run authenticated actor identity",
        [
            sys.executable,
            "scripts/check_phase6_workflow_run_actor_identity.py",
        ],
    ),
    (
        "workflow tool execution request tenant",
        [
            sys.executable,
            "scripts/check_phase6_workflow_tool_execution_request_tenant.py",
        ],
    ),
    (
        "agent execution request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_execution_request_tenant.py",
        ],
    ),
    (
        "agent run authenticated actor identity",
        [sys.executable, "scripts/check_phase6_agent_run_actor_identity.py"],
    ),
    (
        "agent runtime lookup request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_runtime_lookup_request_tenant.py",
        ],
    ),
    (
        "agent tool execution request tenant",
        [
            sys.executable,
            "scripts/check_phase6_agent_tool_execution_request_tenant.py",
        ],
    ),
    (
        "audit event immutability",
        [sys.executable, "scripts/check_phase6_audit_event_immutability.py"],
    ),
    (
        "structured request logging",
        [sys.executable, "scripts/check_phase6_request_logging.py"],
    ),
    (
        "production request identity authentication",
        [sys.executable, "scripts/check_phase6_request_authentication.py"],
    ),
    (
        "canonical request identity consumption",
        [sys.executable, "scripts/check_phase6_request_identity_consumption.py"],
    ),
    (
        "tool policy import authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_tool_policy_import_actor_audit.py",
        ],
    ),
    (
        "tool policy update authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_tool_policy_update_actor_audit.py",
        ],
    ),
    (
        "platform member import authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_member_import_actor_audit.py",
        ],
    ),
    (
        "connector config save authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_connector_config_save_actor_audit.py",
        ],
    ),
    (
        "connector config import authenticated actor audit",
        [
            sys.executable,
            "scripts/check_phase6_connector_config_import_actor_audit.py",
        ],
    ),
    (
        "backend logging configuration",
        [sys.executable, "scripts/check_phase6_logging_config.py"],
    ),
    (
        "correlated API error responses",
        [sys.executable, "scripts/check_phase6_error_handling.py"],
    ),
    (
        "secret hygiene",
        [sys.executable, "scripts/check_phase6_secret_hygiene.py"],
    ),
    (
        "deployment environment contract",
        [sys.executable, "scripts/check_phase6_deployment_env_contract.py"],
    ),
    (
        "production-safe server configuration",
        [sys.executable, "scripts/check_phase6_server_config.py"],
    ),
    (
        "health probe HTTP semantics",
        [sys.executable, "scripts/check_phase6_health_probes.py"],
    ),
    (
        "completed agent run audit contract",
        [sys.executable, "scripts/check_phase6_agent_run_audit.py"],
    ),
    (
        "Agent run clear authenticated actor audit",
        [sys.executable, "scripts/check_phase6_agent_run_clear_actor_audit.py"],
    ),
    (
        "approval mutation audit contract",
        [sys.executable, "scripts/check_phase6_approval_audit.py"],
    ),
    (
        "approval creation authenticated actor identity",
        [
            sys.executable,
            "scripts/check_phase6_approval_create_actor_identity.py",
        ],
    ),
    (
        "approval decision authenticated actor identity",
        [
            sys.executable,
            "scripts/check_phase6_approval_decision_actor_identity.py",
        ],
    ),
    (
        "model config mutation audit contract",
        [sys.executable, "scripts/check_phase6_model_config_audit.py"],
    ),
    (
        "tool call audit contract",
        [sys.executable, "scripts/check_phase6_tool_call_audit.py"],
    ),
    (
        "README bootstrap",
        [sys.executable, "scripts/check_phase6_readme_bootstrap.py"],
    ),
    (
        "backend production gates CI workflow",
        [sys.executable, "scripts/check_phase6_backend_ci_workflow.py"],
    ),
    (
        "runtime provider health",
        [sys.executable, "scripts/check_phase4_runtime_provider_health.py"],
    ),
    (
        "agent document readiness",
        [sys.executable, "scripts/check_phase3_agent_document_readiness.py"],
    ),
)


def main() -> int:
    for label, command in CHECKS:
        printable = " ".join(command)
        print(f"[phase6-backend-gate] {label}: {printable}")
        subprocess.run(command, cwd=ROOT, check=True)

    print("[phase6-backend-gate] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
