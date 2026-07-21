"""Platform member persistence for AgentFoundry."""

import json
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.tenancy import (
    MembershipRecord,
    PostgresTenancyReadRepository,
    TenantRecord,
    UserRecord,
)


class MemberRepositoryProtocol(Protocol):
    """Repository contract used by the platform member service."""

    def load_config(self) -> dict[str, Any]:
        ...

    def save_config(self, config: dict[str, Any]) -> None:
        ...


class MemberRepository:
    """Load and save enterprise platform member configuration."""

    def __init__(self, path: Path) -> None:
        self._path = path

    def load_config(self) -> dict[str, Any]:
        if not self._path.exists():
            return {"members": []}

        config = json.loads(self._path.read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            raise ValueError("Enterprise platform members JSON must be an object.")

        members = config.get("members")
        if not isinstance(members, list):
            config["members"] = []
        return config

    def save_config(self, config: dict[str, Any]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(config, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


class PostgresMemberReadThroughRepository:
    """Read member registry records from PostgreSQL with a JSON fallback.

    The production tenancy model stores members as users joined through
    memberships. This adapter presents that data in the legacy registry shape
    while member writes are migrated in a later slice.
    """

    def __init__(
        self,
        *,
        postgres_reader: PostgresTenancyReadRepository,
        fallback_repository: MemberRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._fallback_repository = fallback_repository

    def load_config(self) -> dict[str, Any]:
        try:
            memberships = self._postgres_reader.list_memberships()
            if not memberships:
                return self._fallback_repository.load_config()

            users_by_id = {
                user.id: user for user in self._postgres_reader.list_users()
            }
            tenants_by_id = {
                tenant.id: tenant for tenant in self._postgres_reader.list_tenants()
            }
            return {
                "members": [
                    _postgres_membership_to_member(
                        membership,
                        user=users_by_id.get(membership.user_id),
                        tenant=tenants_by_id.get(membership.tenant_id),
                    )
                    for membership in memberships
                ],
            }
        except Exception:
            return self._fallback_repository.load_config()

    def save_config(self, config: dict[str, Any]) -> None:
        self._fallback_repository.save_config(config)


def _postgres_membership_to_member(
    membership: MembershipRecord,
    *,
    user: UserRecord | None,
    tenant: TenantRecord | None,
) -> dict[str, Any]:
    user_status = (user.status if user else "active").strip().lower()
    tenant_status = (tenant.status if tenant else "active").strip().lower()
    status = (
        "active"
        if user_status == "active" and tenant_status == "active"
        else "inactive"
    )

    return {
        "user_id": membership.user_id,
        "tenant": membership.tenant_id,
        "display_name": user.display_name if user else membership.user_id,
        "role": membership.role,
        "status": status,
        "sample_questions": [],
        "created_at": membership.created_at,
        "updated_at": membership.updated_at,
        "updated_by": membership.user_id,
        "source": "postgres",
    }
