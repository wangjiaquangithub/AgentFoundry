"""Service-layer access to development knowledge fixtures."""

from typing import Any

from repositories.dev_knowledge import DevKnowledgeRepository


class PlatformDevKnowledgeService:
    """Load development knowledge records used by the local fallback path."""

    def __init__(self, *, repository: DevKnowledgeRepository) -> None:
        self._repository = repository

    def list_records(self) -> list[dict[str, Any]]:
        return self._repository.list()
