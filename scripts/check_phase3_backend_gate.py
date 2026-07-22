#!/usr/bin/env python3
"""Run the Phase 3 enterprise knowledge assistant backend checks."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

CHECKS = (
    ("backend compile", (sys.executable, "-m", "compileall", "backend")),
    ("knowledge bases API", (sys.executable, "scripts/check_phase3_knowledge_bases_api.py")),
    ("knowledge documents API", (sys.executable, "scripts/check_phase3_knowledge_documents_api.py")),
    (
        "document chunks API",
        (sys.executable, "scripts/check_phase3_knowledge_document_chunks_api.py"),
    ),
    ("embedding records API", (sys.executable, "scripts/check_phase3_embedding_records_api.py")),
    ("retrieval events API", (sys.executable, "scripts/check_phase3_retrieval_events_api.py")),
    ("knowledge readiness API", (sys.executable, "scripts/check_phase3_knowledge_readiness_api.py")),
    ("retrieval readiness", (sys.executable, "scripts/check_phase3_retrieval_readiness.py")),
    (
        "document readiness",
        (sys.executable, "scripts/check_phase3_knowledge_document_readiness.py"),
    ),
    (
        "agent document readiness",
        (sys.executable, "scripts/check_phase3_agent_document_readiness.py"),
    ),
    (
        "knowledge ingestion API",
        (sys.executable, "scripts/check_phase3_knowledge_ingestion_api.py"),
    ),
    (
        "knowledge ingestion service",
        (sys.executable, "scripts/check_phase3_knowledge_ingestion_service.py"),
    ),
    (
        "knowledge repository composition",
        (
            sys.executable,
            "scripts/check_phase3_knowledge_repository_composition.py",
        ),
    ),
    (
        "knowledge retrieval API",
        (sys.executable, "scripts/check_phase3_knowledge_retrieval_api.py"),
    ),
    (
        "knowledge retrieval audit",
        (sys.executable, "scripts/check_phase3_knowledge_retrieval_audit.py"),
    ),
    (
        "agent run knowledge readiness",
        (sys.executable, "scripts/check_phase3_agent_run_knowledge_readiness.py"),
    ),
    (
        "agent run retrieval evidence",
        (sys.executable, "scripts/check_phase3_agent_run_retrieval_evidence.py"),
    ),
)


def run_check(label: str, command: tuple[str, ...]) -> None:
    print(f"[phase3-backend-gate] {label}: {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    for label, command in CHECKS:
        run_check(label, command)
    print("[phase3-backend-gate] passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
