# -*- coding: utf-8 -*-
"""Tenant/user tool authorization for the enterprise assistant example."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal


ToolPolicyMode = Literal["permissive", "strict"]

ENTERPRISE_TOOL_NAMES = [
    "enterprise_lookup_policy",
    "enterprise_get_ticket_status",
    "enterprise_summarize_department_metrics",
    "enterprise_get_weather_forecast",
    "enterprise_submit_leave_request",
]

DEFAULT_TOOL_POLICY: dict[str, Any] = {
    "defaults": {
        "allow": ["enterprise_lookup_policy"],
    },
    "tenants": {
        "acme": {
            "allow": ENTERPRISE_TOOL_NAMES,
            "users": {
                "acme:alice": {
                    "allow": ENTERPRISE_TOOL_NAMES,
                },
            },
        },
        "globex": {
            "allow": ENTERPRISE_TOOL_NAMES,
            "users": {
                "globex:bob": {
                    "allow": ENTERPRISE_TOOL_NAMES,
                },
            },
        },
    },
}


@dataclass(frozen=True)
class ToolAuthorizationDecision:
    """Result of evaluating an enterprise tool authorization policy."""

    allowed: bool
    reason: str


class ToolAuthorizationPolicy:
    """Evaluate tenant and user level allow/deny rules for enterprise tools."""

    def __init__(
        self,
        policy: dict[str, Any],
        *,
        mode: ToolPolicyMode = "permissive",
    ) -> None:
        if mode not in {"permissive", "strict"}:
            raise ValueError(
                "ENTERPRISE_TOOL_POLICY_MODE must be permissive or strict.",
            )
        self._policy = policy
        self._mode = mode

    @classmethod
    def from_env(
        cls,
        default_policy: dict[str, Any],
    ) -> "ToolAuthorizationPolicy":
        """Load a JSON authorization policy from env or use the default."""
        mode = os.getenv("ENTERPRISE_TOOL_POLICY_MODE", "permissive")
        mode = mode.strip().lower()
        path = os.getenv("ENTERPRISE_TOOL_POLICY_PATH")

        if path:
            policy = json.loads(Path(path).expanduser().read_text(encoding="utf-8"))
            if not isinstance(policy, dict):
                raise ValueError("Enterprise tool policy JSON must be an object.")
        else:
            policy = json.loads(json.dumps(default_policy))

        return cls(policy, mode=mode)  # type: ignore[arg-type]

    def is_allowed(self, tenant: str, user_id: str, tool_name: str) -> bool:
        """Return whether a user can call a tool in a tenant."""
        return self.authorize(tenant, user_id, tool_name).allowed

    @property
    def mode(self) -> ToolPolicyMode:
        """Return the active fallback behavior for unmatched tools."""
        return self._mode

    def describe_for_user(
        self,
        tenant: str,
        user_id: str,
        tool_names: list[str],
    ) -> list[dict[str, Any]]:
        """Return frontend-friendly authorization decisions for a user."""
        decisions: list[dict[str, Any]] = []
        for tool_name in tool_names:
            decision = self.authorize(tenant, user_id, tool_name)
            decisions.append(
                {
                    "name": tool_name,
                    "allowed": decision.allowed,
                    "reason": decision.reason,
                },
            )
        return decisions

    def authorize(
        self,
        tenant: str,
        user_id: str,
        tool_name: str,
    ) -> ToolAuthorizationDecision:
        """Evaluate default, tenant, and user policy sections.

        Deny always wins over allow. If no section matches, permissive mode
        allows the call while strict mode denies it.
        """
        scopes = self._matching_scopes(tenant, user_id)
        denied_by: list[str] = []
        allowed_by: list[str] = []

        for scope_name, section in scopes:
            if _tool_matches(section.get("deny"), tool_name, f"{scope_name}.deny"):
                denied_by.append(scope_name)
            if _tool_matches(section.get("allow"), tool_name, f"{scope_name}.allow"):
                allowed_by.append(scope_name)

        if denied_by:
            return ToolAuthorizationDecision(
                allowed=False,
                reason=(
                    "Denied by enterprise tool policy "
                    f"({', '.join(denied_by)})."
                ),
            )

        if allowed_by:
            return ToolAuthorizationDecision(
                allowed=True,
                reason=(
                    "Allowed by enterprise tool policy "
                    f"({', '.join(allowed_by)})."
                ),
            )

        if self._mode == "permissive":
            return ToolAuthorizationDecision(
                allowed=True,
                reason="Allowed by permissive enterprise tool policy mode.",
            )

        return ToolAuthorizationDecision(
            allowed=False,
            reason=(
                "Denied by strict enterprise tool policy mode because no "
                "matching allow rule was found."
            ),
        )

    def _matching_scopes(
        self,
        tenant: str,
        user_id: str,
    ) -> list[tuple[str, dict[str, Any]]]:
        scopes: list[tuple[str, dict[str, Any]]] = []
        defaults = _policy_section(self._policy, "defaults", "defaults")
        scopes.append(("defaults", defaults))

        tenants = _policy_section(self._policy, "tenants", "tenants")
        tenant_section = _policy_section(
            tenants,
            tenant,
            f"tenants.{tenant}",
            required=False,
        )
        if tenant_section:
            scopes.append((f"tenant:{tenant}", tenant_section))

        users = _policy_section(
            tenant_section,
            "users",
            f"tenants.{tenant}.users",
            required=False,
        )
        user_section = _policy_section(
            users,
            user_id,
            f"tenants.{tenant}.users.{user_id}",
            required=False,
        )
        if user_section:
            scopes.append((f"user:{user_id}", user_section))

        return scopes


def _policy_section(
    source: dict[str, Any],
    key: str,
    path: str,
    *,
    required: bool = False,
) -> dict[str, Any]:
    value = source.get(key)
    if value is None:
        if required:
            raise ValueError(f"Missing enterprise tool policy section: {path}.")
        return {}
    if not isinstance(value, dict):
        raise ValueError(f"Enterprise tool policy section {path} must be an object.")
    return value


def _tool_matches(value: Any, tool_name: str, path: str) -> bool:
    if value is None:
        return False
    if not isinstance(value, list):
        raise ValueError(f"Enterprise tool policy field {path} must be a list.")
    for item in value:
        if not isinstance(item, str):
            raise ValueError(
                f"Enterprise tool policy field {path} must contain strings.",
            )
        if item == "*" or item == tool_name:
            return True
    return False
