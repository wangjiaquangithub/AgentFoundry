"""Service-layer orchestration for enterprise platform members."""

from datetime import datetime, timezone
from typing import Any, Callable, Protocol
from uuid import uuid4

from backend.persistence import AuditEventRecord
from repositories.members import MemberRepositoryProtocol


class PlatformMemberServiceError(ValueError):
    """Raised when a member registry operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class AuditEventWriteRepository(Protocol):
    """Write tenant-scoped governance audit events."""

    def append_audit_event(self, record: AuditEventRecord) -> AuditEventRecord:
        """Persist one audit event."""


class PlatformMemberService:
    """Manage enterprise platform member registry records."""

    def __init__(
        self,
        *,
        repository: MemberRepositoryProtocol,
        tenant_hint_from_user_id: Callable[[str], str | None],
        audit_event_writer: AuditEventWriteRepository | None = None,
        now: Callable[[], str] | None = None,
    ) -> None:
        self._repository = repository
        self._tenant_hint_from_user_id = tenant_hint_from_user_id
        self._audit_event_writer = audit_event_writer
        self._now = now or _utc_now_iso

    def load_config(self) -> dict[str, Any]:
        try:
            return self._repository.load_config()
        except ValueError as exc:
            raise PlatformMemberServiceError(500, str(exc)) from exc

    def save_config(self, config: dict[str, Any]) -> None:
        self._repository.save_config(config)

    def resolve_mutation_actor(self, actor: str | None) -> str:
        return str(actor or "acme:alice").strip() or "acme:alice"

    def normalize_member(
        self,
        raw: dict[str, Any],
        *,
        fallback_user_id: str | None = None,
        updated_by: str | None = None,
        now: str | None = None,
    ) -> dict[str, Any]:
        timestamp = now or self._now()
        user_id = str(raw.get("user_id") or fallback_user_id or "").strip()
        if not user_id:
            raise PlatformMemberServiceError(400, "成员 user_id 不能为空。")

        tenant = str(
            raw.get("tenant") or self._tenant_hint_from_user_id(user_id) or "acme",
        ).strip()
        role = str(raw.get("role") or "Enterprise user").strip()
        status = str(raw.get("status") or "active").strip().lower()
        if status not in {"active", "inactive"}:
            raise PlatformMemberServiceError(400, "成员状态只能是 active 或 inactive。")

        updated_at = timestamp if updated_by is not None else str(
            raw.get("updated_at") or timestamp,
        )

        return {
            "user_id": user_id,
            "tenant": tenant,
            "display_name": str(raw.get("display_name") or user_id).strip(),
            "role": role,
            "status": status,
            "sample_questions": list(raw.get("sample_questions") or []),
            "created_at": str(raw.get("created_at") or timestamp),
            "updated_at": updated_at,
            "updated_by": str(updated_by or raw.get("updated_by") or user_id),
            "source": str(raw.get("source") or "member_registry"),
        }

    def normalize_import_members(
        self,
        value: Any,
        *,
        actor: str,
    ) -> list[dict[str, Any]]:
        raw_members = value.get("members", value) if isinstance(value, dict) else value
        if raw_members is None:
            return []
        if not isinstance(raw_members, list):
            raise PlatformMemberServiceError(
                400,
                "members must be a JSON array.",
            )
        return [
            self.normalize_member(raw, updated_by=actor)
            for raw in raw_members
            if isinstance(raw, dict)
        ]

    def merge_import_members(
        self,
        existing: list[dict[str, Any]],
        imported: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return _merge_by_key(existing, imported, "user_id")

    def import_members_payload(self, value: Any, *, actor: str, mode: str) -> None:
        imported_members = self.normalize_import_members(value, actor=actor)
        existing_members = self.list_members(include_inactive=True)
        members = (
            imported_members
            if mode == "replace"
            else self.merge_import_members(
                existing_members,
                imported_members,
            )
        )
        self.save_config({"members": members})
        for member in imported_members:
            self._append_member_audit_event(
                member=member,
                actor=actor,
                event_type="platform_member.imported",
                extra_payload={"mode": mode},
            )

    def list_members(self, *, include_inactive: bool = True) -> list[dict[str, Any]]:
        members = self._normalized_members()
        if not include_inactive:
            members = [member for member in members if member["status"] == "active"]
        members.sort(key=lambda item: (item["tenant"], item["user_id"]))
        return members

    def get_member_by_user(
        self,
        user_id: str,
        *,
        include_inactive: bool = True,
    ) -> dict[str, Any] | None:
        for member in self.list_members(include_inactive=include_inactive):
            if member["user_id"] == user_id:
                return member
        return None

    def roles(self, members: list[dict[str, Any]]) -> list[str]:
        return sorted(
            {
                str(member.get("role") or "").strip()
                for member in members
                if str(member.get("role") or "").strip()
            },
        )

    def identity_metadata_payload(
        self,
        *,
        current_user_id: str,
        current_tenant: str,
        connector_identities: list[dict[str, Any]],
        tenant_for_user: Callable[[str], str],
        current_tenant_sample_questions: Callable[[], list[Any]],
        authorization_policy: Any,
        tool_names: list[str],
    ) -> list[dict[str, Any]]:
        normalized_by_user: dict[str, dict[str, Any]] = {}

        for identity in connector_identities:
            user_id = str(identity.get("user_id") or "").strip()
            if not user_id:
                continue
            tenant = str(identity.get("tenant") or "").strip()
            if not tenant:
                tenant = tenant_for_user(user_id)

            normalized_by_user[user_id] = {
                "user_id": user_id,
                "tenant": tenant,
                "display_name": str(identity.get("display_name") or user_id),
                "role": str(identity.get("role") or "Enterprise user"),
                "status": "active",
                "source": "demo_connector",
                "sample_questions": list(identity.get("sample_questions") or []),
            }

        for member in self.list_members(include_inactive=True):
            normalized_by_user[member["user_id"]] = {
                **normalized_by_user.get(member["user_id"], {}),
                **member,
            }

        if current_user_id not in normalized_by_user:
            normalized_by_user[current_user_id] = {
                "user_id": current_user_id,
                "tenant": current_tenant,
                "display_name": current_user_id,
                "role": "Current request user",
                "status": "active",
                "source": "current_request",
                "sample_questions": current_tenant_sample_questions(),
            }

        normalized: list[dict[str, Any]] = []
        for identity in normalized_by_user.values():
            user_id = str(identity.get("user_id") or "").strip()
            tenant = str(identity.get("tenant") or current_tenant).strip()
            normalized.append(
                {
                    **identity,
                    "tenant": tenant,
                    "tool_policy": {
                        "mode": authorization_policy.mode,
                        "decisions": authorization_policy.describe_for_user(
                            tenant,
                            user_id,
                            tool_names,
                        ),
                    },
                },
            )

        normalized.sort(
            key=lambda item: (
                0 if item.get("user_id") == current_user_id else 1,
                str(item.get("tenant") or ""),
                str(item.get("user_id") or ""),
            ),
        )
        return normalized

    def registry_payload(
        self,
        *,
        identities: list[dict[str, Any]],
        registry_path: Any,
    ) -> dict[str, Any]:
        return {
            "members": self.list_members(include_inactive=True),
            "identities": identities,
            "roles": self.roles(identities),
            "path": str(registry_path),
        }

    def registry_response_payload(
        self,
        *,
        user_id: str | None,
        request_context: Callable[[str | None], dict[str, Any]],
        registry_path: Any,
    ) -> dict[str, Any]:
        context = request_context(user_id)
        return self.registry_payload(
            identities=context["identities"],
            registry_path=registry_path,
        )

    def mutation_payload(
        self,
        *,
        member: dict[str, Any],
        members: list[dict[str, Any]],
        identities: list[dict[str, Any]],
        registry_path: Any,
    ) -> dict[str, Any]:
        return {
            "member": member,
            "members": members,
            "roles": self.roles(identities),
            "path": str(registry_path),
        }

    def mutation_response_payload(
        self,
        *,
        actor: str,
        member: dict[str, Any],
        members: list[dict[str, Any]],
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
        registry_path: Any,
    ) -> dict[str, Any]:
        return self.mutation_payload(
            member=member,
            members=members,
            identities=identity_metadata(actor, member["tenant"]),
            registry_path=registry_path,
        )

    def create_member_response_payload(
        self,
        *,
        payload: dict[str, Any],
        actor: str | None,
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
        registry_path: Any,
    ) -> dict[str, Any]:
        resolved_actor = self.resolve_mutation_actor(actor)
        member, members = self.upsert_member(payload, actor=resolved_actor)
        return self.mutation_response_payload(
            actor=resolved_actor,
            member=member,
            members=members,
            identity_metadata=identity_metadata,
            registry_path=registry_path,
        )

    def update_member_response_payload(
        self,
        *,
        user_id: str,
        payload: dict[str, Any],
        actor: str | None,
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
        registry_path: Any,
    ) -> dict[str, Any]:
        resolved_actor = self.resolve_mutation_actor(actor)
        member, members = self.patch_member(
            user_id,
            payload,
            actor=resolved_actor,
        )
        return self.mutation_response_payload(
            actor=resolved_actor,
            member=member,
            members=members,
            identity_metadata=identity_metadata,
            registry_path=registry_path,
        )

    def deactivate_member_response_payload(
        self,
        *,
        user_id: str,
        actor: str | None,
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
        registry_path: Any,
    ) -> dict[str, Any]:
        resolved_actor = self.resolve_mutation_actor(actor)
        member, members = self.deactivate_member(user_id, actor=resolved_actor)
        return self.mutation_response_payload(
            actor=resolved_actor,
            member=member,
            members=members,
            identity_metadata=identity_metadata,
            registry_path=registry_path,
        )

    def upsert_member(
        self,
        payload: dict[str, Any],
        *,
        actor: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        members = self._normalized_members()
        member = self.normalize_member(payload, updated_by=actor)
        replaced = False
        for index, existing in enumerate(members):
            if existing["user_id"] == member["user_id"]:
                member["created_at"] = existing.get("created_at") or member["created_at"]
                members[index] = member
                replaced = True
                break
        if not replaced:
            members.append(member)

        self.save_config({"members": members})
        self._append_member_audit_event(
            member=member,
            actor=actor,
            event_type="platform_member.upserted",
        )
        return member, self.list_members(include_inactive=True)

    def patch_member(
        self,
        user_id: str,
        payload: dict[str, Any],
        *,
        actor: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        members = self._normalized_members()
        for index, existing in enumerate(members):
            if existing["user_id"] == user_id:
                member = self.normalize_member(
                    {
                        **existing,
                        **payload,
                        "user_id": user_id,
                    },
                    fallback_user_id=user_id,
                    updated_by=actor,
                )
                member["created_at"] = existing.get("created_at") or member["created_at"]
                members[index] = member
                break
        else:
            member = self.normalize_member(
                {**payload, "user_id": user_id},
                fallback_user_id=user_id,
                updated_by=actor,
            )
            members.append(member)

        self.save_config({"members": members})
        self._append_member_audit_event(
            member=member,
            actor=actor,
            event_type="platform_member.updated",
        )
        return member, self.list_members(include_inactive=True)

    def deactivate_member(
        self,
        user_id: str,
        *,
        actor: str,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        members = self._normalized_members()
        existing = next((member for member in members if member["user_id"] == user_id), None)
        if existing is None:
            existing = self.normalize_member(
                {
                    "user_id": user_id,
                    "tenant": self._tenant_hint_from_user_id(user_id) or "acme",
                    "display_name": user_id,
                    "role": "Enterprise user",
                },
                updated_by=actor,
            )
            members.append(existing)

        existing["status"] = "inactive"
        existing["updated_at"] = self._now()
        existing["updated_by"] = actor
        self.save_config({"members": members})
        self._append_member_audit_event(
            member=existing,
            actor=actor,
            event_type="platform_member.deactivated",
        )
        return existing, self.list_members(include_inactive=True)

    def _normalized_members(self) -> list[dict[str, Any]]:
        members: list[dict[str, Any]] = []
        for raw in self.load_config().get("members", []):
            if not isinstance(raw, dict):
                continue
            members.append(self.normalize_member(raw))
        return members

    def _append_member_audit_event(
        self,
        *,
        member: dict[str, Any],
        actor: str,
        event_type: str,
        extra_payload: dict[str, Any] | None = None,
    ) -> None:
        if self._audit_event_writer is None:
            return

        tenant = str(member.get("tenant") or "").strip()
        user_id = str(member.get("user_id") or "").strip()
        payload = {
            "schema_version": 1,
            **(extra_payload or {}),
            "tenant": tenant,
            "user_id": user_id,
            "display_name": str(member.get("display_name") or user_id),
            "role": str(member.get("role") or "Enterprise user"),
            "status": str(member.get("status") or "active"),
            "source": str(member.get("source") or "member_registry"),
            "updated_by": str(member.get("updated_by") or actor),
        }
        try:
            persisted_audit_event = self._audit_event_writer.append_audit_event(
                AuditEventRecord(
                    id=str(uuid4()),
                    tenant_id=tenant,
                    actor_user_id=str(actor or "platform-admin").strip()
                    or "platform-admin",
                    event_type=event_type,
                    target_type="platform_member",
                    target_id=user_id,
                    payload=payload,
                    created_at=self._now(),
                ),
            )
            if not persisted_audit_event.id:
                raise PlatformMemberServiceError(
                    500,
                    "PostgreSQL audit event write did not return a persisted id.",
                )
        except ValueError:
            raise
        except Exception as exc:
            raise PlatformMemberServiceError(500, str(exc)) from exc


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _merge_by_key(
    existing: list[dict[str, Any]],
    imported: list[dict[str, Any]],
    key: str,
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in [*existing, *imported]:
        item_key = str(item.get(key) or "").strip()
        if not item_key:
            continue
        if item_key not in merged:
            order.append(item_key)
        merged[item_key] = item
    return [merged[item_key] for item_key in order]
