# -*- coding: utf-8 -*-
"""Platform configuration constants and small runtime helpers."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PLATFORM_AGENTS_PATH = DATA_DIR / "platform_agents.json"
PLATFORM_CONNECTOR_CONFIGS_PATH = DATA_DIR / "platform_connector_configs.json"
PLATFORM_WORKFLOW_TEMPLATES_PATH = DATA_DIR / "platform_workflow_templates.json"
PLATFORM_WORKFLOW_RUNS_PATH = DATA_DIR / "platform_workflow_runs.jsonl"
PLATFORM_AGENT_RUNS_PATH = DATA_DIR / "platform_agent_runs.jsonl"
PLATFORM_APPROVAL_REQUESTS_PATH = DATA_DIR / "platform_approval_requests.jsonl"
PLATFORM_TOOL_POLICY_PATH = DATA_DIR / "platform_tool_policy.json"
PLATFORM_MEMBERS_PATH = DATA_DIR / "platform_members.json"
PLATFORM_DEV_KNOWLEDGE_PATH = DATA_DIR / "platform_dev_knowledge.json"
PLATFORM_MEMORY_DIR = DATA_DIR / "platform_memory"
PLATFORM_VERSION = "0.1.0"
PLATFORM_DEV_KNOWLEDGE_PROVIDER = "agentfoundry-dev-local"
ROUTING_SOURCE_MODEL = "model"
ROUTING_SOURCE_RULES = "rules"
PLATFORM_MEMORY_MAX_RECORDS = 200
PLATFORM_MEMORY_SEARCH_LIMIT = 4


def load_local_env() -> None:
    """Load example-local .env values before building service components."""
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    try:
        from dotenv import load_dotenv
    except ModuleNotFoundError:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
        return

    load_dotenv(env_path, override=False)


def safe_path_part(value: str) -> str:
    """Turn an external id into a filesystem-safe path segment."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("_") or "unknown"


def now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()
