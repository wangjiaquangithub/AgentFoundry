"""Service-layer orchestration for platform long-term memory."""

from pathlib import Path
from typing import Any

from repositories.memories import PlatformMemoryRepository


class PlatformMemoryService:
    """Manage tenant-scoped long-term memory records."""

    def __init__(self, *, repository: PlatformMemoryRepository) -> None:
        self._repository = repository

    def path_for(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
    ) -> Path:
        return self._repository.path_for(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
        )

    def list_memories(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        return self._repository.list(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            limit=limit,
        )

    def append_capped(
        self,
        *,
        tenant: str,
        user_id: str,
        agent_id: str,
        record: dict[str, Any],
        max_records: int,
    ) -> dict[str, Any]:
        self._repository.append_capped(
            tenant=tenant,
            user_id=user_id,
            agent_id=agent_id,
            record=record,
            max_records=max_records,
        )
        return record
