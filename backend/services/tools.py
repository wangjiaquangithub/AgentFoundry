"""Service-layer orchestration for enterprise tool policy configuration."""

import json
from pathlib import Path
from typing import Any, Callable

from permissions import ToolAuthorizationPolicy
from repositories.tool_policy import ToolPolicyRepository


class PlatformToolPolicyServiceError(ValueError):
    """Raised when a tool policy operation cannot be completed."""

    def __init__(self, status_code: int, detail: Any) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


class PlatformToolPolicyService:
    """Manage enterprise tool authorization policy configuration."""

    def __init__(
        self,
        *,
        policy_path: Callable[[], Path],
        default_policy: dict[str, Any],
        policy_mode: Callable[[], str],
        enterprise_tool_names: list[str],
        runtime_context: Callable[[str], dict[str, Any]],
        identity_metadata: Callable[[str, str], list[dict[str, Any]]],
    ) -> None:
        self._policy_path = policy_path
        self._default_policy = default_policy
        self._policy_mode = policy_mode
        self._enterprise_tool_names = enterprise_tool_names
        self._runtime_context = runtime_context
        self._identity_metadata = identity_metadata

    def load_policy(self) -> dict[str, Any]:
        try:
            return self._repository().load()
        except ValueError as exc:
            raise PlatformToolPolicyServiceError(500, str(exc)) from exc

    def save_policy(self, policy: dict[str, Any]) -> None:
        self._repository().save(policy)

    def build_authorization_policy(self) -> ToolAuthorizationPolicy:
        return ToolAuthorizationPolicy(
            self.load_policy(),
            mode=self._policy_mode(),  # type: ignore[arg-type]
        )

    def normalize_policy_tools(self, value: list[str] | None) -> list[str]:
        if not value:
            return []

        seen: set[str] = set()
        result: list[str] = []
        allowed_names = set(self._enterprise_tool_names)
        for item in value:
            name = str(item or "").strip()
            if name in allowed_names and name not in seen:
                seen.add(name)
                result.append(name)
        return result

    def policy_payload(
        self,
        *,
        authorization_policy: ToolAuthorizationPolicy,
        user_id: str | None = None,
        tenant: str | None = None,
    ) -> dict[str, Any]:
        resolved_user_id = user_id or "acme:alice"
        runtime = self._runtime_context(resolved_user_id)
        resolved_tenant = tenant or str(runtime["tenant"])
        identities = self._identity_metadata(resolved_user_id, resolved_tenant)
        return {
            "mode": authorization_policy.mode,
            "path": str(self._policy_path()),
            "policy": self.load_policy(),
            "identities": identities,
            "selected": {
                "tenant": resolved_tenant,
                "user_id": resolved_user_id,
            },
        }

    def update_user_policy(
        self,
        *,
        tenant: str,
        user_id: str,
        allow: list[str] | None,
        deny: list[str] | None,
    ) -> ToolAuthorizationPolicy:
        normalized_tenant = tenant.strip()
        normalized_user_id = user_id.strip()
        if not normalized_tenant or not normalized_user_id:
            raise PlatformToolPolicyServiceError(
                400,
                "tenant and user_id are required.",
            )

        normalized_allow = self.normalize_policy_tools(allow)
        normalized_deny = self.normalize_policy_tools(deny)
        deny_set = set(normalized_deny)
        normalized_allow = [
            name for name in normalized_allow if name not in deny_set
        ]

        policy = self.load_policy()
        tenants = policy.setdefault("tenants", {})
        tenant_policy = tenants.setdefault(normalized_tenant, {})
        users = tenant_policy.setdefault("users", {})
        users[normalized_user_id] = {
            "allow": normalized_allow,
            "deny": normalized_deny,
        }

        self.save_policy(policy)
        return self.build_authorization_policy()

    def _repository(self) -> ToolPolicyRepository:
        return ToolPolicyRepository(
            self._policy_path(),
            json.loads(json.dumps(self._default_policy)),
        )
