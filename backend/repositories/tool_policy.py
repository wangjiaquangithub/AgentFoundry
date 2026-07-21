"""Tool policy persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any, Callable, Protocol


class ToolPolicyWriteRepository(Protocol):
    """Write tenant tool policy records to production persistence."""

    def save_policy(
        self,
        policy: dict[str, Any],
        *,
        enterprise_tool_catalog: dict[str, dict[str, Any]],
        approval_required_tools: set[str],
        timestamp: str,
    ) -> None:
        """Persist tenant-scoped tool policy records."""


class ToolPolicyReadRepository(Protocol):
    """Read tenant tool policy records from production persistence."""

    def load_policy_snapshot(
        self,
        *,
        fallback_policy: dict[str, Any],
    ) -> dict[str, Any]:
        """Return an authorization policy snapshot from production persistence."""


class ToolPolicyRepository:
    """Load and save enterprise tool authorization policy configuration."""

    def __init__(self, path: Path, default_policy: dict[str, Any]) -> None:
        self._path = path
        self._default_policy = default_policy

    def load(self) -> dict[str, Any]:
        if self._path.exists():
            value = json.loads(self._path.read_text(encoding="utf-8"))
        else:
            value = json.loads(json.dumps(self._default_policy))

        if not isinstance(value, dict):
            raise ValueError("Enterprise tool policy JSON must be an object.")
        return value

    def save(self, policy: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(policy, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


class PostgresToolPolicyWriteThroughRepository:
    """Use PostgreSQL as the authoritative tool policy store when configured."""

    def __init__(
        self,
        *,
        postgres_writer: ToolPolicyWriteRepository,
        postgres_reader: ToolPolicyReadRepository | None = None,
        fallback_repository: ToolPolicyRepository,
        enterprise_tool_catalog: dict[str, dict[str, Any]],
        approval_required_tools: set[str],
        now: Callable[[], str],
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer
        self._fallback_repository = fallback_repository
        self._enterprise_tool_catalog = enterprise_tool_catalog
        self._approval_required_tools = approval_required_tools
        self._now = now

    def load(self) -> dict[str, Any]:
        if self._postgres_reader is None:
            return self._fallback_repository.load()

        fallback_policy = self._fallback_repository.load()
        snapshot = self._postgres_reader.load_policy_snapshot(
            fallback_policy=fallback_policy,
        )
        return snapshot

    def save(self, policy: dict[str, Any]) -> None:
        self._postgres_writer.save_policy(
            policy,
            enterprise_tool_catalog=self._enterprise_tool_catalog,
            approval_required_tools=self._approval_required_tools,
            timestamp=self._now(),
        )
