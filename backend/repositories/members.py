"""Platform member persistence for AgentFoundry."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from backend.persistence.tenancy import (
    MembershipRecord,
    PostgresTenancyReadRepository,
    PostgresTenancyWriteRepository,
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
    """Read and write member registry records through PostgreSQL.

    The production tenancy model stores members as users joined through
    memberships. This adapter presents that data in the legacy registry shape.
    """

    def __init__(
        self,
        *,
        postgres_reader: PostgresTenancyReadRepository,
        postgres_writer: PostgresTenancyWriteRepository,
        fallback_repository: MemberRepository,
    ) -> None:
        self._postgres_reader = postgres_reader
        self._postgres_writer = postgres_writer
        self._fallback_repository = fallback_repository

    def load_config(self) -> dict[str, Any]:
        memberships = self._postgres_reader.list_memberships()
        users_by_id = {user.id: user for user in self._postgres_reader.list_users()}
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

    def save_config(self, config: dict[str, Any]) -> None:
        members = config.get("members")
        if not isinstance(members, list):
            raise ValueError("PostgreSQL member config must include a members array.")

        for raw_member in members:
            if not isinstance(raw_member, dict):
                continue
            member = _normalized_member_for_postgres(raw_member)
            self._postgres_writer.upsert_member(
                tenant_id=member["tenant"],
                user_id=member["user_id"],
                display_name=member["display_name"],
                role=member["role"],
                status=member["status"],
                created_at=member["created_at"],
                updated_at=member["updated_at"],
            )


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


def _normalized_member_for_postgres(raw: dict[str, Any]) -> dict[str, str]:
    timestamp = datetime.now(timezone.utc).isoformat()
    tenant = str(raw.get("tenant") or "").strip()
    user_id = str(raw.get("user_id") or "").strip()
    if not tenant:
        raise ValueError("Member tenant is required for PostgreSQL writes.")
    if not user_id:
        raise ValueError("Member user_id is required for PostgreSQL writes.")

    display_name = str(raw.get("display_name") or user_id).strip()
    role = str(raw.get("role") or "Enterprise user").strip()
    status = str(raw.get("status") or "active").strip().lower()
    if status not in {"active", "inactive"}:
        raise ValueError("Member status must be active or inactive.")

    return {
        "tenant": tenant,
        "user_id": user_id,
        "display_name": display_name,
        "role": role,
        "status": status,
        "created_at": str(raw.get("created_at") or timestamp).strip(),
        "updated_at": str(raw.get("updated_at") or timestamp).strip(),
    }
